import { pipeline } from "@huggingface/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 150,
    separators: ["\n\n", "\n", ". ", " ", ""],
});

// text chunking utility
export async function chunkText(text){
    const docs = await splitter.createDocuments([text]);
    return docs
        .map((d) => d.pageContent.trim())
        .filter((chunk) => chunk.length > 50);
}

// HuggingFace Embeddings (384-dim)
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

export async function findRelevantChunks(queryEmbedding, userId, threadId, limit=3, minScore = 0.42, targetDocNames = []){
    const DocumentChunk = (await import("../models/DocumentChunk.js")).default;

    const filter = { owner: userId, threadId };
    if (targetDocNames.length > 0) {
        filter.docName = { $in: targetDocNames };
    }

    const userChunks = await DocumentChunk.find(filter).lean();
    if(!userChunks || userChunks.length === 0) return [];

    return userChunks
        .map((chunk) => ({
            id: String(chunk._id),
            docName: chunk.docName,
            content: chunk.content,
            score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }))
        .filter((chunk) => chunk.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}


// Multi-Query Search with Reciprocal Rank Fusion (RRF) for RAG_DECOMPOSE
export async function retrieveMultiQueryRRF(subQueries, userId, threadId, targetDocNames = [], topK = 4) {
    const k = 60; // Standard RRF constant
    const fusedScores = new Map(); // key: chunk.id -> { chunk, rrfScore }

    await Promise.all(
        subQueries.map(async (q) => {
            const emb = await getEmbedding(q);
            const results = await findRelevantChunks(emb, userId, threadId, 4, 0.35, targetDocNames);

            results.forEach((chunk, rank) => {
                const existing = fusedScores.get(chunk.id) || { chunk, rrfScore: 0 };
                existing.rrfScore += 1 / (k + rank + 1);
                // Keep the highest cosine score seen for display
                if (chunk.score > existing.chunk.score) {
                    existing.chunk.score = chunk.score;
                }
                fusedScores.set(chunk.id, existing);
            });
        })
    );

    return Array.from(fusedScores.values())
        .sort((a, b) => b.rrfScore - a.rrfScore)
        .slice(0, topK)
        .map((item) => item.chunk);
}