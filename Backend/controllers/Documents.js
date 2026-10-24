import mongoose from "mongoose";
import { Worker } from "node:worker_threads";
import DocumentChunk from "../models/DocumentChunk.js";
import Thread from "../models/Thread.js";

const markDocumentFailed = async ({ threadId, ownerId, documentId }) => {
    try {
        await DocumentChunk.deleteMany({ docSummaryId: documentId, owner: ownerId });
    } catch (error) {
        console.error("Failed to remove incomplete document chunks:", error);
    }
    try {
        await Thread.updateOne(
            {
                threadId,
                owner: ownerId,
                "documents._id": documentId,
            },
            { $set: { "documents.$.status": "failed" } }
        );
    } catch (error) {
        console.error("Failed to mark document processing as failed:", error);
    }
};

const uploadDocument = async (req, res) => {
    let pendingDocument;

    try {
        if (!req.file) {
            return res.status(400).json({ error: "no file provided" });
        }

        const { threadId } = req.body;
        if (!threadId) {
            return res.status(400).json({ error: "threadId is required" });
        }

        const extension = req.file.originalname.split(".").pop()?.toLowerCase();
        const isPdf = extension === "pdf" && req.file.mimetype === "application/pdf";
        const isText =
            extension === "txt" &&
            ["text/plain", "application/octet-stream"].includes(req.file.mimetype);
        if (!isPdf && !isText) {
            return res.status(400).json({ error: "Only PDF and TXT files are supported." });
        }

        let thread = await Thread.findOne({ threadId, owner: req.user._id });
        if (!thread) {
            thread = new Thread({
                threadId,
                title: req.file.originalname.slice(0, 30),
                owner: req.user._id,
                messages: [],
                documents: [],
            });
        }

        thread.documents.push({
            docName: req.file.originalname,
            summary: "",
            status: "pending",
        });
        pendingDocument = thread.documents[thread.documents.length - 1];
        await thread.save();

        const worker = new Worker(
            new URL("../workers/documentProcessor.js", import.meta.url),
            {
                workerData: {
                    fileBuffer: req.file.buffer,
                    fileName: req.file.originalname,
                    isPdf,
                    ownerId: String(req.user._id),
                    threadId,
                    documentId: String(pendingDocument._id),
                    mongoUri: process.env.LOCAL_MONGODB_URI,
                },
            }
        );

        let failureHandled = false;
        const handleWorkerFailure = async (error) => {
            if (failureHandled) return;
            failureHandled = true;
            console.error("Document processing worker failed:", error);
            await markDocumentFailed({
                threadId,
                ownerId: req.user._id,
                documentId: pendingDocument._id,
            });
        };

        worker.on("error", handleWorkerFailure);
        worker.on("exit", (code) => {
            if (code !== 0) {
                void handleWorkerFailure(new Error(`Worker exited with code ${code}`));
            }
        });

        return res.status(202).json({
            documentId: pendingDocument._id,
            status: "pending",
            message: "Document queued for processing.",
        });
    } catch (error) {
        console.error("RAG upload error:", error);
        if (pendingDocument) {
            await markDocumentFailed({
                threadId: req.body.threadId,
                ownerId: req.user._id,
                documentId: pendingDocument._id,
            });
        }
        return res.status(500).json({ error: "Failed to queue document for processing" });
    }
};

const getDocumentStatus = async (req, res) => {
    const { documentId } = req.params;
    if (!mongoose.isValidObjectId(documentId)) {
        return res.status(404).json({ error: "Document not found" });
    }

    try {
        const thread = await Thread.findOne({
            owner: req.user._id,
            "documents._id": documentId,
        }).select("documents");
        const document = thread?.documents.find(
            (entry) => String(entry._id) === documentId
        );
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        return res.json({
            status: document.status || "ready",
            ...(document.status === "failed" && {
                error: "Document processing failed.",
            }),
        });
    } catch (error) {
        console.error("Failed to fetch document status:", error);
        return res.status(500).json({ error: "Failed to fetch document status" });
    }
};

export { uploadDocument, getDocumentStatus };
