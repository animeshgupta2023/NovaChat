import { pipeline } from "@huggingface/transformers";

// text chunking utility
export function chunkText(text, chunkSize=800, overlap=150){
    let chunks=[];
    let startIndex = 0;

    while(startIndex < text.length){
        let endIndex = startIndex + chunkSize;
        let chunk = text.slice(startIndex, endIndex);

        if(endIndex < text.length){
            const lastSpace = chunk.lastIndexOf(" ");
            if(lastSpace !== -1){
                chunk = chunk.slice(0, lastSpace);
                endIndex = startIndex + lastSpace;
            }
        }

        chunks.push(chunk.trim());
        startIndex = endIndex - overlap;
    }

    return chunks.filter((chunk)=>chunk.length > 50);
}




// generating embedding using xenova
 
let embedder = null;

async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return embedder;
}

export async function getEmbedding(text) {
    try {
        const pipe = await getEmbedder();
        const output = await pipe(text, { pooling: "mean", normalize: true });
        return Array.from(output.data);
    } catch (err) {
        console.error("Local embedding error:", err);
        throw err;
    }
}




// vector similarity search part
function cosineSimilarity(vecA, vecB){
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for(let i=0; i<vecA.length; i++){
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if(normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function findRelevantChunks(queryEmbedding, userId, limit=3){
    const DocumentChunk = (await import("../models/DocumentChunk.js")).default;
    const userChunks = await DocumentChunk.find({owner: userId}).lean();

    if(!userChunks || userChunks.length === 0) return [];

    const scoredChunks = userChunks.map((chunk)=>({
        docName: chunk.docName,
        content: chunk.content,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    return scoredChunks
        .sort((a, b)=>b.score - a.score)
        .slice(0, limit);
}

