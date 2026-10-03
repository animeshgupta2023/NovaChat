import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";

import DocumentChunk from "../models/DocumentChunk.js";
import { chunkText, getEmbedding } from "../utils/ragUtils.js";
import { isLoggedIn } from "../middlewares.js";

const upload = multer({storage: multer.memoryStorage()});
const router = express.Router();

router.use(isLoggedIn);

router.post("/upload", upload.single("file"), async(req, res)=>{
    try{
        if(!req.file){
            return res.status(400).json({error: "no file provided"});
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

        const chunks = chunkText(extractedText);

        for(const chunk of chunks){
            const embedding = await getEmbedding(chunk);
            await DocumentChunk.create({
                owner: req.user._id,
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