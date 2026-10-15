// Backend/controllers/Chats.js
import Thread from "../models/Thread.js";
import DocumentChunk from "../models/DocumentChunk.js";
import { getEmbedding, findRelevantChunks, retrieveMultiQueryRRF } from "../utils/ragUtils.js";
import { getChatModel, getRouterModel } from "../utils/langchainModels.js";
import { routeQuery } from "../utils/queryRouter.js";
import { AGENT_TOOLS, TOOL_MAP } from "../utils/tools/index.js";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

const getAllThreads = async (req, res) => {
    try {
        const threads = await Thread.find({ owner: req.user._id })
            .select("threadId title updatedAt hasDocuments")
            .sort({ updatedAt: -1 });

        res.json(threads);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to fetch threads" });
    }
};

const ThreadInfo = async (req, res) => {
    const { threadId } = req.params;
    try {
        const thread = await Thread.findOne({ threadId, owner: req.user._id });
        if (!thread) {
            return res.status(404).json({ error: "Thread not found or unauthorized" });
        }
        res.json(thread.messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to fetch chat" });
    }
};

const deleteThread = async (req, res) => {
    const { threadId } = req.params;
    try {
        const deletedThread = await Thread.findOneAndDelete({
            threadId,
            owner: req.user._id,
        });
        await DocumentChunk.deleteMany({ threadId, owner: req.user._id });

        if (!deletedThread) {
            return res.status(404).json({ error: "Thread not found or unauthorized" });
        }
        res.status(200).json({ success: "Thread deleted Successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to delete thread" });
    }
};

// Helper to write SSE events safely
function sendSSE(res, event, dataObj) {
    if (!res.writableEnded) {
        if (event) {
            res.write(`event: ${event}\n`);
        }
        res.write(`data: ${JSON.stringify(dataObj)}\n\n`);
    }
}

const chat = async (req, res) => {
    const { threadId, message } = req.body;

    if (!threadId || !message) {
        return res.status(400).json({ error: "missing required fields" });
    }

    const MAX_HISTORY = 10;
    const BATCH_SIZE = 4;

    // Open SSE stream immediately so we can send live router/tool status pills
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const abortController = new AbortController();
    req.on("close", () => abortController.abort());

    try {
        let thread = await Thread.findOne({ threadId, owner: req.user._id });

        if (!thread) {
            thread = new Thread({
                threadId,
                title: message.slice(0, 30),
                owner: req.user._id,
                messages: [{ role: "user", content: message }],
                summary: "",
                lastSummarizedLength: 0,
            });
            await thread.save();
        } else {
            if (thread.messages.length === 0) {
                thread.title = message.slice(0, 30);
            }
            thread.messages.push({ role: "user", content: message });
            await thread.save();
        }

        // 1. Sliding-Window Conversation Summarization
        const unsummarizedCount = thread.messages.length - thread.lastSummarizedLength;
        if (unsummarizedCount >= MAX_HISTORY) {
            const batchMessages = thread.messages
                .slice(thread.lastSummarizedLength, thread.lastSummarizedLength + BATCH_SIZE)
                .map((m) => `${m.role}: ${m.content}`)
                .join("\n");

            try {
                const summaryModel = getRouterModel();
                const summaryRes = await summaryModel.invoke([
                    new SystemMessage(
                        "Summarize this conversation history concisely, retaining key facts and user preferences."
                    ),
                    new HumanMessage(
                        `Existing Summary: ${thread.summary || "None"}\n\nNew messages:\n${batchMessages}`
                    ),
                ]);
                thread.summary = String(summaryRes.content).trim();
                thread.lastSummarizedLength += BATCH_SIZE;
                console.log("summarized now");
            } catch (summaryErr) {
                console.error("Summary generation failed:", summaryErr.message);
            }
        }

        // 2. Smart RAG Routing & Retrieval (Phase 3)
        let ragContextPrompt = "";
        let retrievedChunks = [];

        if (thread.hasDocuments && thread.documents?.length > 0) {
            sendSSE(res, "status", { label: "Analyzing query against uploaded documents..." });

            const routeDecision = await routeQuery(
                message,
                thread.documents,
                thread.messages.slice(-4)
            );
            console.log("[RAG Router]:", routeDecision);

            if (routeDecision.route !== "DIRECT") {
                const queries =
                    routeDecision.searchQueries?.length > 0
                        ? routeDecision.searchQueries
                        : [message];

                sendSSE(res, "status", {
                    label:
                        routeDecision.route === "RAG_DECOMPOSE"
                            ? `Searching documents across ${queries.length} sub-queries...`
                            : `Searching ${routeDecision.targetDocNames?.join(", ") || "documents"}...`,
                });

                if (routeDecision.route === "RAG_DECOMPOSE" && queries.length > 1) {
                    retrievedChunks = await retrieveMultiQueryRRF(
                        queries,
                        req.user._id,
                        threadId,
                        routeDecision.targetDocNames,
                        4
                    );
                } else {
                    const queryEmbedding = await getEmbedding(queries[0]);
                    retrievedChunks = await findRelevantChunks(
                        queryEmbedding,
                        req.user._id,
                        threadId,
                        3,
                        0.38,
                        routeDecision.targetDocNames
                    );
                }

                if (retrievedChunks.length > 0) {
                    // Emit structured citations to the client
                    sendSSE(res, "citations", {
                        citations: retrievedChunks.map((c, idx) => ({
                            id: idx + 1,
                            docName: c.docName,
                            score: Number(c.score.toFixed(2)),
                            excerpt: c.content.slice(0, 220) + "...",
                        })),
                    });

                    const contextSnippet = retrievedChunks
                        .map((doc, idx) => `[Source ${idx + 1} (${doc.docName})]:\n${doc.content}`)
                        .join("\n\n");

                    console.log(contextSnippet)

                    ragContextPrompt = `\n\nPRIVATE DOCUMENT CONTEXT:\n${contextSnippet}\n\nInstruction: Use the document context above when relevant and cite sources as [Source X (filename)].`;
                }
            }
        }

        // 3. Build LangChain Message Array
        const lcMessages = [
            new SystemMessage(
                `You are NovaChat, an intelligent AI assistant. You have access to real-time tools (get_current_weather and web_search). ` +
                `Use get_current_weather for live weather queries, and web_search for current events or live web info.` +
                (thread.summary ? `\n\nEarlier Conversation Summary: ${thread.summary}` : "") +
                ragContextPrompt
            ),
        ];

        const recentMessages = thread.messages
            .slice(thread.lastSummarizedLength)
            .slice(-MAX_HISTORY);

        for (const m of recentMessages) {
            if (m.role === "user") lcMessages.push(new HumanMessage(m.content));
            else lcMessages.push(new AIMessage(m.content));
        }

        // 4. Phase 4: Agent Tool-Calling + Streaming Loop
        const chatModel = getChatModel("gemini").bindTools(AGENT_TOOLS);
        let assistantReply = "";

        // First pass: check if model wants to call a tool or stream directly
        const firstStream = await chatModel.stream(lcMessages, {
            signal: abortController.signal,
        });

        let gatheredChunk = null;
        for await (const chunk of firstStream) {
            gatheredChunk = gatheredChunk ? gatheredChunk.concat(chunk) : chunk;

            // If normal text tokens arrive immediately, stream them to the user
            if (chunk.content && typeof chunk.content === "string") {
                assistantReply += chunk.content;
                sendSSE(res, null, { content: chunk.content });
            }
        }

        // If the LLM decided to call tools (e.g., Weather or Tavily Web Search)
        if (gatheredChunk?.tool_calls && gatheredChunk.tool_calls.length > 0) {
            lcMessages.push(gatheredChunk);

            for (const toolCall of gatheredChunk.tool_calls) {
                const selectedTool = TOOL_MAP[toolCall.name];
                if (!selectedTool) continue;

                const statusLabel =
                    toolCall.name === "get_current_weather"
                        ? `Fetching live weather for ${toolCall.args.city}...`
                        : `Searching the web for "${toolCall.args.query}"...`;

                sendSSE(res, "status", { tool: toolCall.name, label: statusLabel });

                try {
                    const toolOutput = await selectedTool.invoke(toolCall.args);
                    lcMessages.push(
                        new ToolMessage({
                            tool_call_id: toolCall.id,
                            name: toolCall.name,
                            content: String(toolOutput),
                        })
                    );
                } catch (toolErr) {
                    lcMessages.push(
                        new ToolMessage({
                            tool_call_id: toolCall.id,
                            name: toolCall.name,
                            content: `Tool execution error: ${toolErr.message}`,
                        })
                    );
                }
            }

            // Clear status pill and stream final synthesized answer from tool outputs
            sendSSE(res, "status", { label: "" });

            const finalStream = await getChatModel("gemini").stream(lcMessages, {
                signal: abortController.signal,
            });

            for await (const chunk of finalStream) {
                if (chunk.content && typeof chunk.content === "string") {
                    assistantReply += chunk.content;
                    sendSSE(res, null, { content: chunk.content });
                }
            }
        }

        // Clear any lingering status pill
        sendSSE(res, "status", { label: "" });

        // 5. Save Final Reply to MongoDB
        if (assistantReply.trim()) {
            thread.messages.push({ role: "assistant", content: assistantReply });
            thread.updatedAt = new Date();
            await thread.save();
        }

        sendSSE(res, "done", {});
        res.end();
    } catch (err) {
        if (abortController.signal.aborted) {
            console.log("Client aborted stream");
            return res.end();
        }
        console.error("Chat error:", err);
        sendSSE(res, "error", { message: err.message || "Stream failed" });
        res.end();
    }
};

export { getAllThreads, ThreadInfo, deleteThread, chat };