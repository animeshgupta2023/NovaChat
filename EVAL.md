# NovaChat — RAG & Router Evaluation

- **Date:** 2026-10-23
- **Queries:** 40
- **Documents:** `company_policy.txt` (3 chunks), `system_architecture.txt` (3 chunks), `quarterly_financials.txt` (2 chunks)
- **Embeddings:** `Xenova/all-MiniLM-L6-v2` (384 dimensions, local)
- **Answer model:** Gemini via `getChatModel`

## Results

| Metric | Baseline | NovaChat pipeline |
| :--- | :--- | :--- |
| Router accuracy | n/a | 97.5% |
| Hit-Rate@3 (document queries, n=26) | 96.2% | 84.6% |
| MRR@3 (document queries) | 0.750 | 0.679 |
| Direct/tool queries with no RAG chunks (n=8) | n/a | 100.0% |
| Unanswerable retrieval suppression (n=6) | 0.0% | 50.0% |
| Unanswerable refusal rate | 83.3% | 100.0% |
| Retrieval latency p50 / p95 | 48 ms / 91 ms | 398 ms / 1622 ms |
| TTFT p50 / p95 | 890 ms / 2378 ms | 1558 ms / 6136 ms |

Baseline retrieves the top chunks by cosine similarity for the raw query. The pipeline includes router time, applies the production similarity threshold for single-query retrieval, and uses RRF for decomposed queries. Multi-document retrieval hits when all expected keywords appear in the top three chunks.

TTFT is retrieval time plus generation time to the first token. Latency values are specific to the machine and run. Refusal rates use phrase matching and should be reviewed alongside `Backend/evals/results.json`.
