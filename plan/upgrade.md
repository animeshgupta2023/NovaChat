

## Phase 1 — Production Hardening (Highest Screening ROI)

- [ ] **Security Headers:** Add `helmet` in `Backend/server.js`.
- [ ] **Rate Limiting (`express-rate-limit`):** `POST /api/chat` (30/min/IP), `/auth/*` (10/min/IP), `POST /document/upload` (10/hr/IP).
- [ ] **Input & Upload Validation (`zod` + `multer`):**
  - Validate `POST /api/chat { threadId: z.string().uuid(), message: z.string().min(1).max(8000) }`.
  - Harden `multer` in `Backend/routes/document.js`: `{ limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: PDF/TXT + magic-byte check }`.
- [ ] **NoSQL Sanitization:** Add `express-mongo-sanitize` to strip `$` and `.` from user payloads.
- [ ] **Session Persistence (`connect-mongo`):** Persist Express sessions in MongoDB instead of memory, enable `app.set("trust proxy", 1)`, configure dynamic CORS origin, and set `secure: process.env.NODE_ENV === "production"` on cookies.
- [ ] **Compound Database Indexes:**
  - `Thread`: `{ owner: 1, updatedAt: -1 }`
  - `DocumentChunk`: `{ owner: 1, threadId: 1, docSummaryId: 1 }`
- **Interview signal:** *"Hardened stateless API layer with persistent session store, strict schema validation, and bounded file ingestion."*

---

## Phase 2 — Docker + Monorepo CI/CD + Automated Tests

- [ ] **Containerization:** Create multi-stage `Dockerfile` for `Backend/` and `Frontend/` + root `docker-compose.yml` (`api`, `web`, `mongo`) for one-command `docker compose up --build`.
- [ ] **Fix Monorepo GitHub Actions (`.github/workflows/ci.yml`):** Use `working-directory: ./Backend` and `working-directory: ./Frontend` so `npm ci`, `build`, and `test` target the correct `package.json` files.
- [ ] **Targeted Test Suite (12 tests with `vitest` + `supertest`):**
  - `RecursiveCharacterTextSplitter` / `chunkText` boundary & overlap tests.
  - `cosineSimilarity` math & zero-vector edge cases.
  - Auth guard: `401` on unauthenticated `GET /api/thread`.
  - Upload guard: rejects >5MB and non-PDF/TXT payloads.
  - Tenant isolation: User A cannot read or delete User B's `threadId`.
- **Done when:** Fresh clone boots via `docker compose up`, GitHub Actions CI is green, and status badge is live in `README.md`.

---

## Phase 3 — LangChain Core, Smart RAG Router & Evals (Your Technical Moat)

- [ ] **LangChain Model Abstraction (`Backend/utils/langchainModels.js`):**
  - Replace raw `fetch` in `llmServe.js` with `@langchain/google-genai` (`ChatGoogleGenerativeAI`) and `@langchain/groq` (`ChatGroq`) with automatic fallback and structured token caps.
  - Replace custom `chunkText` in `ragUtils.js` with `@langchain/textsplitters` (`RecursiveCharacterTextSplitter` with `chunkSize: 800, chunkOverlap: 150`).
  - Wrap `@huggingface/transformers` (`Xenova/all-MiniLM-L6-v2`) in a custom LangChain `Embeddings` class so local embeddings remain 100% free ($0 cost).
- [ ] **Smart Multi-Doc Router (`Backend/utils/queryRouter.js`):**
  - Use `model.withStructuredOutput(zodSchema)` over `query + thread.documents[].summary` to classify intent into:
    - `DIRECT`: General chat or tool query -> skip document vector search (0ms vector overhead).
    - `RAG_SINGLE`: Question targets specific uploaded file(s) -> filter `DocumentChunk` by selected `docSummaryId`s.
    - `RAG_REWRITE`: Follow-up with pronouns (*"what does section 2 say about it?"*) -> rewrite standalone query using conversation history + doc summaries.
    - `RAG_DECOMPOSE`: Complex multi-doc comparison -> generate 2–3 sub-queries, retrieve top-3 chunks each, and merge via **Reciprocal Rank Fusion (RRF)** + deduplication.
- [ ] **Grounded Citations:**
  - Emit structured SSE event `event: citations` containing `[{ id, docName, excerpt, score }]` alongside the stream.
  - Render clickable citation pills in `Chat.jsx` to inspect the source chunk.
- [ ] **Quantitative Evaluation (`EVAL.md`):**
  - Benchmark 15 test queries (factual, follow-up paraphrase, multi-doc comparison, general chit-chat, and live web/weather queries).
  - Report `Hit-Rate@3`, `MRR`, false-positive RAG trigger rate, and p50/p95 TTFT latency.

---

## Phase 4 — LangChain Multi-Tool Agent (Tavily Web Search + OpenWeather + RAG)

- [ ] **Define Structured LangChain Tools (`Backend/utils/tools/`):**
  1. **`tavilySearchTool.js` (`@langchain/tavily` or custom `tool()`):** Queries the **Tavily Search API** (`TAVILY_API_KEY`) for real-time news, live documentation, and current events.
  2. **`weatherTool.js` (`tool()` with Zod schema `{ city: z.string(), units: z.enum(["metric", "imperial"]).optional() }`):** Calls **OpenWeatherMap API** (`OPENWEATHER_API_KEY`) to fetch live temperature, humidity, wind speed, and forecast conditions.
  3. **`documentRetrievalTool.js` (Optional Agentic RAG binding):** Allows the agent to combine private PDF insights with live web/weather data in a single turn (e.g., *"Check our uploaded eventvenue.pdf and tell me the current weather in that city"*).
- [ ] **Streaming Tool Execution Loop (`Backend/utils/agentExecutor.js`):**
  - Bind tools via `llm.bindTools([tavilyTool, weatherTool])` (or `createReactAgent` via `@langchain/langgraph`).
  - Stream intermediate SSE status events to the frontend:
    - `event: tool_start` -> `data: { tool: "tavily_search", label: "Searching the web..." }`
    - `event: tool_start` -> `data: { tool: "get_weather", label: "Fetching live weather for Delhi..." }`
    - `event: tool_end` -> transitions seamlessly into `data: { content: "..." }` token streaming.
  - Handle `req.on("close")` to abort in-flight LangChain `AbortSignal` if the client disconnects.

---

## Phase 5 — Senior Frontend UX Polish

- [ ] **Live Tool & RAG Status Indicator (`ChatWindow.jsx` / `Chat.jsx`):** Render animated status pills (*"Searching web via Tavily..."*, *"Checking weather..."*, *"Reading report.pdf..."*) above the assistant message bubble before tokens arrive.
- [ ] **Stream Controls:** Add `AbortController` "Stop Generating" button, "Regenerate" response button, and one-click "Copy Code" headers on syntax-highlighted code blocks.
- [ ] **Thread Document Drawer:** Show attached `thread.documents` chips in the chat header with ability to view summary or remove a document from the thread, plus staged file attachment preview chip before sending.
- [ ] **Toast Notifications:** Replace blocking browser `alert()` calls (`ChatWindow.jsx:194,221,224`) with `react-hot-toast` or `sonner`.
- [ ] **Smart Auto-Scroll:** Smoothly stick to the bottom during SSE token streaming unless the user manually scrolls up.

---

## Phase 6 — Observability, Cloud Deploy & Portfolio Packaging

- [ ] **Structured Observability:** Add `pino` logger with `requestId` tracing and `GET /metrics` exposing p50/p95 TTFT latency, RAG hit-rate, and tool invocation counts.
- [ ] **AWS EC2 + MongoDB Atlas Production Deploy:**
  - Switch `LOCAL_MONGODB_URI` to MongoDB Atlas in production (enabling future `$vectorSearch` migration when chunk count exceeds 10k).
  - Configure Nginx reverse proxy (`proxy_buffering off;` for SSE streaming) + PM2 + GitHub Actions CD workflow.
- [ ] **Portfolio Artifacts:** Rewrite `README.md` with system architecture diagram, GIF demo of Multi-Doc RAG + Tavily/OpenWeather tool calling, and evaluation metrics table from `EVAL.md`.

---

## Updated Tech Stack & Libraries Reference

| Layer | Package | Purpose in NovaChat |
| :--- | :--- | :--- |
| **LLM & Orchestration** | `@langchain/core`, `@langchain/langgraph` | Unified message history, `bindTools`, structured outputs, and agent loop streaming. |
| **Model Providers** | `@langchain/google-genai`, `@langchain/groq` | Primary streaming LLM (Gemini) + ultra-fast low-latency router/summarizer (Groq). |
| **Text Processing** | `@langchain/textsplitters` | Structure-aware `RecursiveCharacterTextSplitter` for PDF/TXT ingestion. |
| **Local Embeddings** | `@huggingface/transformers` | $0 local 384-dim embeddings (`Xenova/all-MiniLM-L6-v2`) wrapped in LangChain `Embeddings`. |
| **Agent Tools** | `@langchain/tavily`, `OpenWeatherMap REST` | Live web search grounding and real-time meteorological data via tool calling. |
| **Security & Validation** | `helmet`, `express-rate-limit`, `zod`, `connect-mongo` | Production API hardening, payload validation, and persistent MongoDB sessions. |
| **Testing & Ops** | `vitest`, `supertest`, `pino`, `docker-compose` | Automated unit/integration testing, structured logging, and reproducible containers. |