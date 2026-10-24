import { workerData } from "node:worker_threads";
import mongoose from "mongoose";
import { PDFParse } from "pdf-parse";
import DocumentChunk from "../models/DocumentChunk.js";
import Thread from "../models/Thread.js";
import { chunkText, getEmbedding } from "../utils/ragUtils.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel } from "../utils/langchainModels.js";

const { fileBuffer, fileName, isPdf, ownerId, threadId, documentId, mongoUri } = workerData;

const processDocument = async () => {
    await mongoose.connect(mongoUri);
    isDatabaseConnected = true;
    const statusResult = await Thread.updateOne(
        { threadId, owner: ownerId, "documents._id": documentId },
        { $set: { "documents.$.status": "processing" } }
    );
    if (statusResult.matchedCount === 0) {
        throw new Error("Document was removed before processing started.");
    }

    let extractedText = "";
    if (isPdf) {
        const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
        try {
            const pdfData = await parser.getText();
            extractedText = pdfData.text;
        } finally {
            await parser.destroy();
        }
    } else {
        extractedText = Buffer.from(fileBuffer).toString("utf-8");
    }

    if (!extractedText.trim()) {
        throw new Error("File contains no readable text.");
    }

    const summaryResponse = await getChatModel("gemini", 0)
        .bind({ maxOutputTokens: 300 })
        .invoke(
            [
                new SystemMessage(
                    "Summarize the primary topics and scope of this document in 2-3 concise sentences. Focus on key themes and data points."
                ),
                new HumanMessage(extractedText.slice(0, 8000)),
            ]
        );

    const chunks = await chunkText(extractedText);
    if (chunks.length === 0) {
        throw new Error("File contains no text suitable for indexing.");
    }

    for (const chunk of chunks) {
        const embedding = await getEmbedding(chunk);
        await DocumentChunk.create({
            owner: ownerId,
            threadId,
            docSummaryId: documentId,
            docName: fileName,
            content: chunk,
            embedding,
        });
    }

    const result = await Thread.updateOne(
        { threadId, owner: ownerId, "documents._id": documentId },
        {
            $set: {
                "documents.$.summary": String(summaryResponse.content).trim(),
                "documents.$.status": "ready",
                hasDocuments: true,
            },
        }
    );
    if (result.matchedCount === 0) {
        throw new Error("Thread was removed before document processing completed.");
    }
};

let isDatabaseConnected = false;

try {
    await processDocument();
} catch (error) {
    console.error("Document processing failed:", error);
    if (!isDatabaseConnected) {
        throw error;
    }
    try {
        await DocumentChunk.deleteMany({ docSummaryId: documentId, owner: ownerId });
        await Thread.updateOne(
            { threadId, owner: ownerId, "documents._id": documentId },
            { $set: { "documents.$.status": "failed" } }
        );
    } catch (cleanupError) {
        console.error("Failed to clean up document processing:", cleanupError);
        throw cleanupError;
    }
} finally {
    await mongoose.disconnect();
}
