import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import mongoose from "mongoose";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import Thread from "../models/Thread.js";
import DocumentChunk from "../models/DocumentChunk.js";
import { getChatModel } from "../utils/langchainModels.js";
import {
    chunkText,
    findRelevantChunks,
    getEmbedding,
    retrieveMultiQueryRRF,
} from "../utils/ragUtils.js";
import { routeQuery } from "../utils/queryRouter.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(SCRIPT_DIR, "..");
const DATASET_PATH = path.join(BACKEND_DIR, "evals", "dataset.json");
const TEST_DOCS_DIR = path.join(BACKEND_DIR, "evals", "test_docs");
const RESULTS_PATH = path.join(BACKEND_DIR, "evals", "results.json");
const REPORT_PATH = path.resolve(BACKEND_DIR, "..", "EVAL.md");

const EVAL_USER_ID = new mongoose.Types.ObjectId("660000000000000000000001");
const EVAL_THREAD_ID = "eval-thread-benchmark";
const DOC_FILES = [
    "company_policy.txt",
    "system_architecture.txt",
    "quarterly_financials.txt",
];
const DOC_SUMMARIES = {
    "company_policy.txt": "HR policy guidelines on leave, remote work, expense reimbursement, on-call stipends, and disciplinary procedures.",
    "system_architecture.txt": "NovaChat architecture covering database replicas, backup retention, rate limits, token limits, and disaster recovery.",
    "quarterly_financials.txt": "Fiscal year 2026 report covering quarterly revenue, operating costs, infrastructure spend, and customer churn.",
};
const VALID_ROUTES = new Set(["DIRECT", "RAG_SINGLE", "RAG_REWRITE", "RAG_DECOMPOSE"]);
const DOC_CATEGORIES = new Set([
    "single_doc_factual",
    "conversational_followup",
    "multi_doc_comparison",
]);
const CATEGORIES = [
    "single_doc_factual",
    "conversational_followup",
    "multi_doc_comparison",
    "direct_tool",
    "unanswerable_trap",
];
const TOP_K = 3;
const SINGLE_THRESHOLD = 0.38;
const SKIP_GENERATION = process.env.EVAL_SKIP_GENERATION === "1";
const QUERY_PAUSE_MS = Number(process.env.EVAL_PAUSE_MS ?? 2000);
const GEMINI_REQUEST_INTERVAL_MS = 4100;
const REFUSAL_PATTERN =
    /not (mentioned|specified|found|stated|covered|included|available|provided|in the (documents|excerpts|context))|cannot (find|determine|answer)|can't (find|determine|answer)|no information|do(n't| not) (have|know)|unable to|not able to/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastGeminiRequestAt = 0;

async function waitForGeminiRequest() {
    const waitMs = GEMINI_REQUEST_INTERVAL_MS - (Date.now() - lastGeminiRequestAt);
    if (waitMs > 0) await sleep(waitMs);
    lastGeminiRequestAt = Date.now();
}

const percentage = (count, total) =>
    total ? `${((count / total) * 100).toFixed(1)}%` : "n/a";
const mean = (values) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
const formatNumber = (value) => (Number.isNaN(value) ? "n/a" : value.toFixed(3));
const formatMs = (value) =>
    value === null || Number.isNaN(value) ? "n/a" : `${Math.round(value)} ms`;

function percentile(values, percent) {
    if (!values.length) return NaN;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1)];
}

function validateDataset(dataset) {
    if (!Array.isArray(dataset) || dataset.length === 0) {
        throw new Error("evals/dataset.json must contain a non-empty array.");
    }

    const ids = new Set();
    const problems = [];
    for (const item of dataset) {
        if (!item || typeof item !== "object") {
            problems.push("each dataset entry must be an object");
            continue;
        }
        if (!item.id || ids.has(item.id)) problems.push(`missing or duplicate id "${item.id}"`);
        ids.add(item.id);
        if (!CATEGORIES.includes(item.category)) {
            problems.push(`${item.id}: unknown category "${item.category}"`);
        }
        if (!VALID_ROUTES.has(item.expectedRoute)) {
            problems.push(`${item.id}: unknown expected route "${item.expectedRoute}"`);
        }
        if (typeof item.query !== "string" || !item.query.trim()) {
            problems.push(`${item.id}: query must be a non-empty string`);
        }
        if (!Array.isArray(item.targetDocs)) {
            problems.push(`${item.id}: targetDocs must be an array`);
        } else {
            for (const docName of item.targetDocs) {
                if (!DOC_FILES.includes(docName)) {
                    problems.push(`${item.id}: unknown target document "${docName}"`);
                }
            }
        }
        if (
            DOC_CATEGORIES.has(item.category) &&
            (!item.targetDocs?.length || !item.groundTruthKeywords?.length)
        ) {
            problems.push(`${item.id}: document queries need targetDocs and groundTruthKeywords`);
        }
        if (item.category === "direct_tool" && item.expectedRoute !== "DIRECT") {
            problems.push(`${item.id}: direct_tool queries must expect DIRECT`);
        }
    }

    if (problems.length) {
        throw new Error(`Invalid evaluation dataset:\n- ${problems.join("\n- ")}`);
    }
}

function getDocPath(fileName) {
    const filePath = path.join(TEST_DOCS_DIR, fileName);
    if (!fs.existsSync(filePath)) throw new Error(`Missing evaluation document: ${filePath}`);
    return filePath;
}

async function seedEvalThread() {
    await DocumentChunk.deleteMany({ owner: EVAL_USER_ID, threadId: EVAL_THREAD_ID });
    await Thread.deleteOne({ owner: EVAL_USER_ID, threadId: EVAL_THREAD_ID });

    const thread = new Thread({
        threadId: EVAL_THREAD_ID,
        title: "RAG Evaluation Thread",
        owner: EVAL_USER_ID,
        messages: [],
        documents: [],
        hasDocuments: true,
    });

    const chunkCounts = {};
    for (const fileName of DOC_FILES) {
        thread.documents.push({ docName: fileName, summary: DOC_SUMMARIES[fileName] });
        await thread.save();
        const summaryId = thread.documents.at(-1)._id;
        const text = fs.readFileSync(getDocPath(fileName), "utf8");
        const chunks = await chunkText(text);
        chunkCounts[fileName] = chunks.length;
        console.log(`  - ${fileName}: ${chunks.length} chunks`);

        for (const content of chunks) {
            const embedding = await getEmbedding(content);
            await DocumentChunk.create({
                owner: EVAL_USER_ID,
                threadId: EVAL_THREAD_ID,
                docSummaryId: summaryId,
                docName: fileName,
                content,
                embedding,
            });
        }
    }

    await thread.save();
    return { thread, chunkCounts };
}

function createGenerator() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is missing. Set it, or use EVAL_SKIP_GENERATION=1 to run retrieval metrics only.",
        );
    }

    const model = getChatModel("gemini", 0);

    return async (query, history, chunks) => {
        const excerpts = chunks.length
            ? chunks
                  .map((chunk, index) => `[Excerpt ${index + 1} from ${chunk.docName}]\n${chunk.content}`)
                  .join("\n\n")
            : "(no document excerpts were retrieved)";
        const messages = [
            new SystemMessage(
                "Answer using only the document excerpts. If they do not contain the answer, say you cannot find it in the documents. Be concise.\n\n" +
                    excerpts,
            ),
            ...history.map((message) =>
                message.role === "assistant"
                    ? new AIMessage(message.content)
                    : new HumanMessage(message.content),
            ),
            new HumanMessage(query),
        ];

        await waitForGeminiRequest();
        const startedAt = performance.now();
        let firstTokenMs = null;
        let answer = "";
        const stream = await model.stream(messages);
        for await (const chunk of stream) {
            const text =
                typeof chunk.content === "string"
                    ? chunk.content
                    : (chunk.content ?? []).map((part) => part.text ?? "").join("");
            if (text && firstTokenMs === null) firstTokenMs = performance.now() - startedAt;
            answer += text;
        }
        return {
            answer,
            ttftMs: firstTokenMs ?? performance.now() - startedAt,
        };
    };
}

function scoreRetrieval(chunks, keywords, category) {
    const topChunks = chunks.slice(0, TOP_K);
    const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());

    if (category === "multi_doc_comparison") {
        let lastRank = 0;
        for (const keyword of normalizedKeywords) {
            const index = topChunks.findIndex((chunk) =>
                chunk.content.toLowerCase().includes(keyword),
            );
            if (index === -1) return { hit: false, reciprocalRank: 0 };
            lastRank = Math.max(lastRank, index + 1);
        }
        return { hit: true, reciprocalRank: 1 / lastRank };
    }

    for (let index = 0; index < topChunks.length; index++) {
        const content = topChunks[index].content.toLowerCase();
        if (normalizedKeywords.every((keyword) => content.includes(keyword))) {
            return { hit: true, reciprocalRank: 1 / (index + 1) };
        }
    }
    return { hit: false, reciprocalRank: 0 };
}

async function evaluateItem(item, thread, generate) {
    const history = item.history ?? [];
    const baselineStartedAt = performance.now();
    const baselineEmbedding = await getEmbedding(item.query);
    const baselineChunks = await findRelevantChunks(
        baselineEmbedding,
        EVAL_USER_ID,
        EVAL_THREAD_ID,
        TOP_K,
        0,
    );
    const baselineRetrievalMs = performance.now() - baselineStartedAt;

    const pipelineStartedAt = performance.now();
    let decision;
    let routerError = null;
    try {
        if (!process.env.GROQ_API_KEY) await waitForGeminiRequest();
        decision = await routeQuery(item.query, thread.documents, history);
        if (!VALID_ROUTES.has(decision?.route)) {
            throw new Error(`Router returned an invalid route: ${decision?.route}`);
        }
    } catch (error) {
        routerError = String(error.message ?? error).slice(0, 200);
        decision = {
            route: "RAG_SINGLE",
            targetDocNames: [],
            searchQueries: [item.query],
        };
    }

    let pipelineChunks = [];
    if (decision.route !== "DIRECT") {
        const queries = decision.searchQueries?.length ? decision.searchQueries : [item.query];
        const targetDocNames = (decision.targetDocNames ?? []).filter((name) =>
            DOC_FILES.includes(name),
        );

        if (decision.route === "RAG_DECOMPOSE" && queries.length > 1) {
            pipelineChunks = await retrieveMultiQueryRRF(
                queries,
                EVAL_USER_ID,
                EVAL_THREAD_ID,
                targetDocNames,
                TOP_K,
            );
        } else {
            const embedding = await getEmbedding(queries[0]);
            pipelineChunks = await findRelevantChunks(
                embedding,
                EVAL_USER_ID,
                EVAL_THREAD_ID,
                TOP_K,
                SINGLE_THRESHOLD,
                targetDocNames,
            );
        }
    }
    const pipelineRetrievalMs = performance.now() - pipelineStartedAt;

    let baselineGeneration = null;
    let pipelineGeneration = null;
    if (generate && item.category !== "direct_tool") {
        baselineGeneration = await generate(item.query, history, baselineChunks);
        pipelineGeneration = await generate(item.query, history, pipelineChunks);
    }

    const isDocumentQuery = DOC_CATEGORIES.has(item.category);
    const isTrap = item.category === "unanswerable_trap";
    const baselineScore = isDocumentQuery
        ? scoreRetrieval(baselineChunks, item.groundTruthKeywords, item.category)
        : null;
    const pipelineScore = isDocumentQuery
        ? scoreRetrieval(pipelineChunks, item.groundTruthKeywords, item.category)
        : null;

    const resultFor = (chunks, retrievalMs, score, generation) => ({
        chunksReturned: chunks.length,
        hit: score?.hit ?? null,
        reciprocalRank: score?.reciprocalRank ?? null,
        retrievalMs,
        ttftMs: generation ? retrievalMs + generation.ttftMs : null,
        answer: generation?.answer ?? null,
        refused: isTrap && generation ? REFUSAL_PATTERN.test(generation.answer) : null,
        suppressed: isTrap ? chunks.length === 0 : null,
    });

    return {
        id: item.id,
        category: item.category,
        query: item.query,
        expectedRoute: item.expectedRoute,
        route: decision.route,
        routerCorrect: decision.route === item.expectedRoute,
        routerError,
        baseline: resultFor(baselineChunks, baselineRetrievalMs, baselineScore, baselineGeneration),
        upgraded: resultFor(pipelineChunks, pipelineRetrievalMs, pipelineScore, pipelineGeneration),
    };
}

function buildReport(rows, chunkCounts, generated) {
    const documentRows = rows.filter((row) => DOC_CATEGORIES.has(row.category));
    const trapRows = rows.filter((row) => row.category === "unanswerable_trap");
    const directRows = rows.filter((row) => row.category === "direct_tool");
    const baselineTtft = rows.map((row) => row.baseline.ttftMs).filter(Number.isFinite);
    const pipelineTtft = rows.map((row) => row.upgraded.ttftMs).filter(Number.isFinite);
    const baselineLatency = rows.map((row) => row.baseline.retrievalMs);
    const pipelineLatency = rows.map((row) => row.upgraded.retrievalMs);
    const hitRate = (pipeline) =>
        percentage(
            documentRows.filter((row) => row[pipeline].hit).length,
            documentRows.length,
        );
    const mrr = (pipeline) =>
        formatNumber(mean(documentRows.map((row) => row[pipeline].reciprocalRank)));
    const ttft = (values) =>
        generated
            ? `${formatMs(percentile(values, 50))} / ${formatMs(percentile(values, 95))}`
            : "not measured";
    const lines = [
        "# NovaChat — RAG & Router Evaluation",
        "",
        `- **Date:** ${new Date().toISOString().slice(0, 10)}`,
        `- **Queries:** ${rows.length}`,
        `- **Documents:** ${Object.entries(chunkCounts)
            .map(([name, count]) => `\`${name}\` (${count} chunks)`)
            .join(", ")}`,
        "- **Embeddings:** `Xenova/all-MiniLM-L6-v2` (384 dimensions, local)",
        `- **Answer model:** ${generated ? "Gemini via `getChatModel`" : "not run (retrieval-only)"}`,
        "",
        "## Results",
        "",
        "| Metric | Baseline | NovaChat pipeline |",
        "| :--- | :--- | :--- |",
        `| Router accuracy | n/a | ${percentage(rows.filter((row) => row.routerCorrect).length, rows.length)} |`,
        `| Hit-Rate@${TOP_K} (document queries, n=${documentRows.length}) | ${hitRate("baseline")} | ${hitRate("upgraded")} |`,
        `| MRR@${TOP_K} (document queries) | ${mrr("baseline")} | ${mrr("upgraded")} |`,
        `| Direct/tool queries with no RAG chunks (n=${directRows.length}) | n/a | ${percentage(directRows.filter((row) => row.upgraded.chunksReturned === 0).length, directRows.length)} |`,
        `| Unanswerable retrieval suppression (n=${trapRows.length}) | ${percentage(trapRows.filter((row) => row.baseline.suppressed).length, trapRows.length)} | ${percentage(trapRows.filter((row) => row.upgraded.suppressed).length, trapRows.length)} |`,
        `| Unanswerable refusal rate | ${generated ? percentage(trapRows.filter((row) => row.baseline.refused).length, trapRows.length) : "not measured"} | ${generated ? percentage(trapRows.filter((row) => row.upgraded.refused).length, trapRows.length) : "not measured"} |`,
        `| Retrieval latency p50 / p95 | ${formatMs(percentile(baselineLatency, 50))} / ${formatMs(percentile(baselineLatency, 95))} | ${formatMs(percentile(pipelineLatency, 50))} / ${formatMs(percentile(pipelineLatency, 95))} |`,
        `| TTFT p50 / p95 | ${ttft(baselineTtft)} | ${ttft(pipelineTtft)} |`,
        "",
        "Baseline retrieves the top chunks by cosine similarity for the raw query. The pipeline includes router time, applies the production similarity threshold for single-query retrieval, and uses RRF for decomposed queries. Multi-document retrieval hits when all expected keywords appear in the top three chunks.",
        "",
        "TTFT is retrieval time plus generation time to the first token. Latency values are specific to the machine and run. Refusal rates use phrase matching and should be reviewed alongside `Backend/evals/results.json`.",
        "",
    ];
    return lines.join("\n");
}

async function main() {
    if (!process.env.LOCAL_MONGODB_URI) {
        throw new Error("LOCAL_MONGODB_URI is not set in Backend/.env");
    }

    const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
    validateDataset(dataset);
    const generate = SKIP_GENERATION ? null : createGenerator();
    console.log(`Loaded ${dataset.length} queries from ${DATASET_PATH}`);

    await mongoose.connect(process.env.LOCAL_MONGODB_URI);
    console.log("Connected to MongoDB.\n");

    try {
        console.log("Resetting the evaluation thread and indexing test documents...");
        const { thread, chunkCounts } = await seedEvalThread();
        const rows = [];

        for (let index = 0; index < dataset.length; index++) {
            const item = dataset[index];
            process.stdout.write(
                `[${index + 1}/${dataset.length}] ${item.id} (${item.category}) ${item.query.slice(0, 55)}... `,
            );
            const row = await evaluateItem(item, thread, generate);
            rows.push(row);
            console.log(
                `route=${row.route}${row.routerCorrect ? "" : ` (expected ${row.expectedRoute})`}`,
            );
            await sleep(QUERY_PAUSE_MS);
        }

        fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(rows, null, 2)}\n`);
        const report = buildReport(rows, chunkCounts, Boolean(generate));
        fs.writeFileSync(REPORT_PATH, report);
        console.log(`\nReport written to ${REPORT_PATH}`);
        console.log(`Per-query results written to ${RESULTS_PATH}`);
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error("Evaluation run failed:", error);
    process.exitCode = 1;
});
