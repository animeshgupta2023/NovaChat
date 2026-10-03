# top tier
must do feature
2. **multi step reasoning**
breadown the query if unclear
adding webserach
query into multiple sub queries
rag

3. One agent loop, with guardrails
Implement your TODO.md:36-40 as: planner JSON {needs_search, sub_queries} -> Tavily web search + RAG in parallel -> synthesize. Add timeout, allowlist, cost log. Shows you understand agents, not just stream:true.


## Future Work: Production-Grade AI System

The next phase is to evolve NovaChat from an application that calls an LLM API into a production-grade AI system. The work below is ordered by priority and focuses on capabilities expected in AI Engineer, LLM Application Developer, and Machine Learning Engineer projects.

### Phase 1: Core LLM Engineering


3. **Provider abstraction and model swapping**
	- Introduce an `LLMService` abstraction behind the chat route.
	- Select a provider through `LLM_PROVIDER` in the environment.
	- Add provider strategies for Groq, OpenAI, Anthropic, and local Ollama models.
	- Keep provider-specific request and streaming logic out of the route handlers.

### Phase 2: Advanced AI Capabilities

5. **Function calling and tool use**
	- Add a real-time data tool such as weather lookup or web search.
	- Define tools with JSON schemas in the model request.
	- Detect `tool_calls`, validate their arguments, and execute tools on the backend.
	- Send tool results back to the model to produce the final response.
	- Add timeouts, error handling, and an allowlist for available tools.

6. **Prompt engineering and prompt management**
	- Move system prompts into a dedicated `prompts/` directory using text or YAML files.
	- Version prompts so changes can be reviewed and evaluated.
	- Add custom personas, such as a senior Python tutor, and persist their system prompts.
	- Inject the selected persona into the provider request without exposing secrets or internal instructions.

### Phase 3: MLOps, Observability, and Production Readiness

7. **LLM tracing and metrics**
	- Integrate Langfuse or LangSmith around provider calls.
	- Capture request latency, model name, token counts, errors, and trace IDs.
	- Display the last response's latency, token usage, and estimated cost in the chat UI.

8. **Semantic caching with Redis**
	- Add Redis as a caching layer before the provider request.
	- Compare semantically similar prompts rather than only exact strings.
	- Return cached responses for high-similarity queries and record cache hit rates.
	- Add expiration and invalidation rules when prompts, personas, or retrieved documents change.




# future rag implementations

implement the top k search in rag in cpp for even lower latency and use it think of other fater algos to implement.


rag handling the images or figures in the docs.

custom embedding model for better performance

how to know if the rag is needed or not may use jev

break the query into sub query to before fetching the doc
automatic decision to make if we need rag or not
for each sub query get the relevant doc then for the mega improved query by ai get final set of the relevant docs

show citations



**Main Issues** in rag
- **Chunking can create bad chunks:** In `ragUtils.js`, text shorter than `chunkSize` can be stored once as a full chunk and again as its overlapping tail. At a boundary where the last space is at index `0`, the loop may fail to advance. This can cause duplicate retrieval or a stuck upload for unusual text.
- **RAG runs on every chat message:** The chat route embeds every message and retrieves the top three chunks, even when the user has no documents or the chunks are irrelevant. That adds latency and can inject unrelated context. Add a “use documents” choice or a relevance cutoff, calibrated with test queries.
- **Documents are user-scoped, not thread-scoped:** `DocumentChunk.js` stores `owner` and `docName`, but no `threadId` or stable document ID. A user’s uploaded documents can therefore be retrieved in any of their threads, and duplicate uploads aren’t easy to distinguish or remove.
- **Uploads need limits and file validation:** `document.js` uses in-memory uploads without a size limit and treats every non-PDF file as text. Restrict accepted types to PDF/TXT and set a maximum upload size.
- **Retrieval quality isn’t evaluated yet:** `ragUtils.js` loads and scores every chunk owned by the user, then always returns the top three. That’s acceptable for a small prototype, but can get slow as documents grow. Test a small set of known questions and measure whether the right chunk appears in the top three.

The similarity calculation and user ownership filter are in place, and readable-text PDFs and TXT files go through the intended flow. Scanned PDFs still need OCR, and user-visible citations are not yet guaranteed.