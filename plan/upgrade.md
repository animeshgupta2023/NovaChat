# NovaChat — Production Upgrade & LangChain Architecture Plan

**Execution Order:** Phase 3 & 4 (Core AI + Evals) ➔ Phase 1 (Hardening) ➔ Phase 2 (Docker + CI + Tests) ➔ Phase 5 & 6 (UX Polish + README Packaging + Freeze).

---

## Phase 1 — Production Security & Hardening (Highest Screening ROI)

- [ ] **Security & Sanitization Middleware (`Backend/server.js`):**
  - Add `helmet()` for secure HTTP headers.
  - Add `express-mongo-sanitize()` to strip `$` and `.` NoSQL injection payloads from `req.body`, `req.query`, and `req.params`.
- [ ] **Route Rate Limiting (`express-rate-limit`):**
  - `POST /api/chat`: `30 req / min / IP`
  - `/auth/*`: `10 req / min / IP`
  - `POST /document/upload`: `10 req / hr / IP`
- [ ] **Strict Schema & Upload Validation (`zod` + `multer`):**
  - Validate `POST /api/chat` body with Zod: `{ threadId: z.string().min(1), message: z.string().trim().min(1).max(8000) }`.
  - Harden `multer` in `Backend/routes/document.js`:
    - `limits: { fileSize: 5 * 1024 * 1024, files: 1 }` (5MB cap).
    - `fileFilter`: allow only `.pdf` and `.txt` + verify PDF magic bytes (`%PDF-`) on buffer before parsing.
- [ ] **Persistent Sessions (`connect-mongo`):**
  - Store Express sessions in MongoDB (`MongoStore.create({ mongoUrl: process.env.LOCAL_MONGODB_URI })`).
  - Set `app.set("trust proxy", 1)`, dynamic CORS origin, and `secure: process.env.NODE_ENV === "production"` on session cookies.
- [ ] **Compound MongoDB Indexes:**
  - `Backend/models/Thread.js`: `ThreadSchema.index({ owner: 1, updatedAt: -1 })`
  - `Backend/models/DocumentChunk.js`: `documentChunkSchema.index({ owner: 1, threadId: 1, docSummaryId: 1 })`

---

## Phase 2 — Docker + Monorepo CI/CD + 12 Automated Tests

- [ ] **Containerization (`Dockerfile` + `docker-compose.yml`):**
  - Create multi-stage `Backend/Dockerfile` (Node 22 LTS slim) and `Frontend/Dockerfile` (Vite build ➔ Nginx alpine).
  - Create root `docker-compose.yml` orchestrating `mongo`, `backend`, and `frontend` for one-command `docker compose up --build`.
- [ ] **Fix Monorepo GitHub Actions (`.github/workflows/ci.yml`):**
  - Configure `working-directory: ./Backend` and `working-directory: ./Frontend` on `ubuntu-latest` (Node 22.x) to run `npm ci`, `build`, and `test`.
- [ ] **Write 12 High-Signal Tests (`vitest` + `supertest` in `Backend/tests/`):**
  - **Tests 1–3 (`ragUtils.test.js`):** `chunkText` size/overlap boundaries, empty/short string filtering, `cosineSimilarity` identity (`1.0`), orthogonal (`0.0`), and zero-vector safety (`0`).
  - **Tests 4–5 (`rrf.test.js`):** Deduplication of identical chunk IDs across sub-queries and RRF rank ordering.
  - **Tests 6–7 (`auth.test.js`):** Unauthenticated `GET /api/thread` and `POST /api/chat` return `401 Unauthorized`.
  - **Tests 8–10 (`validation.test.js`):** `POST /api/chat` rejects empty/oversized message (`400`); `POST /document/upload` rejects >5MB buffer (`413`/`400`) and non-PDF/TXT extension (`400`).
  - **Tests 11–12 (`isolation.test.js`):** Tenant IDOR check — User A cannot `GET` or `DELETE` User B's `threadId` (`404`).

---

# done
## Phase 3 — LangChain Core, Smart Multi-Doc RAG Router & Evals (Your Technical Moat)

- [ ] **The 40-Query RAG & Router Eval Harness (`EVAL.md`):**
  - Build `Backend/evals/dataset.json` across 3 distinct test PDFs (**10 Single-Doc Factual**, **8 Conversational Pronoun Follow-ups**, **8 Multi-Doc Comparisons**, **8 Direct/Weather/Tavily Queries**, **6 Unanswerable Traps**).
  - Write `Backend/scripts/runEvals.js` comparing **Baseline (Naive Cosine Similarity)** vs. **NovaChat Pipeline (Zod Router + Rewrite + RRF)**.
  - Log and publish in `EVAL.md`:
    1. **Router Classification Accuracy (%)**
    2. **Hit-Rate@3 (%)**
    3. **Mean Reciprocal Rank (MRR@3)**
    4. **Unanswerable Refusal / Groundedness Rate (%)**
    5. **p50 / p95 TTFT Latency (ms)**

---

## Phase 4 — LangChain Multi-Tool Agent (Tavily Web Search + OpenWeather)

 
  - Handle client disconnects via `req.on("close", () => abortController.abort())`.

---

## Phase 5 — Senior Frontend UX Polish

- [ ] **Live SSE Status & Citation Pills (`ChatWindow.jsx` & `Chat.jsx`):**
  - Render animated status pill above the streaming response for router and tool steps.
  - Render clickable `[Source 1: filename.pdf (0.64)]` citation pills beneath assistant messages that expand to reveal the source excerpt.
- [ ] **Stream Controls & Code UX (`ChatWindow.jsx` & `Chat.jsx`):**
  - Add client-side `AbortController` wired to a **Stop Generating** button while `loading === true`.
  - Add one-click **Copy Code** button on `rehype-highlight` code blocks.
- [ ] **Non-Blocking Notifications & Thread Doc Chips:**
  - Replace browser `alert()` calls with toast notifications (`react-hot-toast` or `sonner`).
  - Display active `thread.documents` badges in the chat header/input area.

---

## Phase 6 — Observability, Portfolio Packaging & Code Freeze

- [ ] **Observability Lite (`Backend/server.js`):**
  - Add structured request logging (`pino` or request-duration middleware) and expose basic latency/RAG counters.
- [ ] **High-Impact README & Demo Artifact (`README.md`):**
  - Record a **45-second high-res GIF** demonstrating:
    1. Uploading 2 PDFs to a thread and asking a cross-document comparison question (showing live status pill + RRF citations).
    2. Asking a live weather + web search question in the same thread (showing the router bypassing PDF search and calling OpenWeather/Tavily).
  - Embed the GIF, system architecture diagram, and the **`EVAL.md` benchmark comparison table** at the top of `README.md`.
- [ ] **Freeze Codebase.**

---
