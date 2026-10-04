import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";

import DocumentChunk from "../models/DocumentChunk.js";
import { chunkText, getEmbedding } from "../utils/ragUtils.js";
import { isLoggedIn } from "../middlewares.js";
import getLLMResponse from "../utils/llmServe.js";
import Thread from "../models/Thread.js";

const upload = multer({storage: multer.memoryStorage()});
const router = express.Router();

router.use(isLoggedIn);

router.post("/upload", upload.single("file"), async(req, res)=>{
    try{
        if(!req.file){
            return res.status(400).json({error: "no file provided"});
        }

        const { threadId } = req.body;
        if(!threadId) {
            return res.status(400).json({error: "threadId is required"});
        }

        const thread = await Thread.findOne({threadId, owner: req.user._id});
        if (!thread) {
            return res.status(404).json({ error: "Thread not found" });
        }

        let extractedText = "";

        if (req.file.mimetype === "application/pdf") {
            const parser = new PDFParse({ data: req.file.buffer });
            try {
                const pdfData = await parser.getText();
                extractedText = pdfData.text;
            } finally {
                await parser.destroy();
            }
        } else {
            extractedText = req.file.buffer.toString("utf-8");
        }

        if(!extractedText.trim()){
            return res.status(400).json({error: "File contains no readable texts."})
        }

        // generating the doc summary
        const summaryPrompt = [
            {
                role: "system",
                content: "Summarize the primary topics and scope of this document in 2-3 concise sentences. Focus on key themes and data points.",
            },
            {
                role: "user",
                content: extractedText.slice(0, 8000)
            }
        ];
        const docSummary = await getLLMResponse(summaryPrompt, {
            provider: "gemini",
            stream: false,
            max_tokens: 300,
        });

        // saving chunks
        const chunks = chunkText(extractedText);

        // saving the document meta data summary
        const docEntry = {
            docName: req.file.originalname,
            summary: docSummary.trim()
        };
        
        thread.documents = thread.documents || [];
        thread.documents.push(docEntry);
        thread.hasDocuments = true;
        await thread.save();

        const summaryId = docEntry._id;

        for(const chunk of chunks){
            const embedding = await getEmbedding(chunk);
            await DocumentChunk.create({
                owner: req.user._id,
                threadId,
                docSummaryId: summaryId,
                docName: req.file.originalname,
                content: chunk,
                embedding,
            });
        }

        res.status(200).json({
            message: `Document "\(${req.file.originalname}" processed into\)${chunks.length} chunks.`,
        })
    }catch(err){
        console.error("RAG upload error: ", err);
        res.status(500).json({error: "Failed to process document"});
    }
});

export default router;