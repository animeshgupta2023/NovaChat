


2. **multi step reasoning** 
breadown the query if unclear
adding webserach
rag






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





break the query into sub query to before fetching the doc
automatic decision to make if we need rag or not
for each sub query get the relevant doc then for the mega improved query by ai get final set of the relevant docs

show citations

complete document summary to store and use it to generate proper query if the user query is amguious




**Main Issues** in rag
- **Chunking can create bad chunks:** In `ragUtils.js`, text shorter than `chunkSize` can be stored once as a full chunk and again as its overlapping tail. At a boundary where the last space is at index `0`, the loop may fail to advance. This can cause duplicate retrieval or a stuck upload for unusual text.
- **RAG runs on every chat message:** The chat route embeds every message and retrieves the top three chunks, even when the user has no documents or the chunks are irrelevant. That adds latency and can inject unrelated context. Add a “use documents” choice or a relevance cutoff, calibrated with test queries.
- **Documents are user-scoped, not thread-scoped:** `DocumentChunk.js` stores `owner` and `docName`, but no `threadId` or stable document ID. A user’s uploaded documents can therefore be retrieved in any of their threads, and duplicate uploads aren’t easy to distinguish or remove.
- **Uploads need limits and file validation:** `document.js` uses in-memory uploads without a size limit and treats every non-PDF file as text. Restrict accepted types to PDF/TXT and set a maximum upload size.
- **Retrieval quality isn’t evaluated yet:** `ragUtils.js` loads and scores every chunk owned by the user, then always returns the top three. That’s acceptable for a small prototype, but can get slow as documents grow. Test a small set of known questions and measure whether the right chunk appears in the top three.

The similarity calculation and user ownership filter are in place, and readable-text PDFs and TXT files go through the intended flow. Scanned PDFs still need OCR, and user-visible citations are not yet guaranteed.






# last to look at 

implement the top k search in rag in cpp for even lower latency and use it think of other fater algos to implement.

if the query is amguious use the summary of the doc and generate improved query use it to find the relevant docs and send them

using the doc summary to decide if rag is needed and for the ambigious query as well 

a query may be complex, ambigous or simply need the rag, or web search is needed

automatic decision making 
Uploaded docs on this thread + question is general → maybe still no RAG if not needed
Uploaded docs on this thread + question is doc-related → RAG on