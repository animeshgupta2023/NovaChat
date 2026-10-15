import {z} from "zod";
import { getRouterModel } from "./langchainModels.js";

const RouteSchema = z.object({
    route: z.enum(["DIRECT", "RAG_SINGLE", "RAG_REWRITE", "RAG_DECOMPOSE"]).describe(
        "DIRECT if unrelated to uploaded documents (e.g. greetings, general coding, live weather/news). " +
        "RAG_SINGLE if a clear question about 1 or more uploaded docs. " +
        "RAG_REWRITE if the query uses pronouns/follow-ups ('what about section 2?', 'summarize it') that need rewriting. " +
        "RAG_DECOMPOSE if comparing multiple topics or documents requiring 2-3 sub-queries."
    ),
    targetDocNames: z.array(z.string()).describe(
        "Exact docName(s) from the available documents that are relevant. Empty array if DIRECT."
    ),
    searchQueries: z.array(z.string()).describe(
        "1 standalone rewritten search query for RAG_SINGLE/RAG_REWRITE, or 2-3 specific sub-queries for RAG_DECOMPOSE. Empty if DIRECT."
    ),
});

export async function routeQuery(userMessage, threadDocuments=[], recentMessages=[]) {
    // Fast path: No documents uploaded in this thread -> skip RAG completely
    if (!threadDocuments || threadDocuments.length === 0) {
        return { route: "DIRECT", targetDocNames: [], searchQueries: [] };
    }

    const docCatalog = threadDocuments
        .map((d, i) => `[${i + 1}] docName: "${d.docName}" | Summary: ${d.summary}`)
        .join("\n");

    const historyContext = recentMessages
        .slice(-4)
        .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

    try{
        const model = getRouterModel().withStructuredOutput(RouteSchema);

        const decision = await model.invoke([
            {
                role: "system",
                content:
                    "You are an intelligent RAG routing engine. Decide whether the user's query needs information from the uploaded thread documents, or if it should be answered directly/via external tools (weather, web search).",
            },
            {
                role: "user",
                content: `Uploaded Documents in Thread:\n${docCatalog}\n\nRecent Conversation:\n${historyContext}\n\nLatest User Query: "${userMessage}"`,
            },
        ]);

        return decision;
    } catch(err){
        console.warn("Router fallback to RAG_SINGLE:", err.message);
        return {
            route: "RAG_SINGLE",
            targetDocNames: threadDocuments.map((d) => d.docName),
            searchQueries: [userMessage],
        };
    }
}