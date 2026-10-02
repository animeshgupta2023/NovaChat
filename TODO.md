Recruiters don't hire for "built a ChatGPT clone", because thousands of candidates have that on their resume. They hire for what you can explain and defend in an interview: why you made a choice, what broke, and how you fixed it. So pick features that show real engineering skills, and do fewer of them properly.

## Tier 1: Do these first (they cover most of what interviewers ask)

1. **Authentication and multi-user support.** Sign-up and login with JWT (access and refresh tokens) or sessions, password hashing with bcrypt, a `userId` on every thread, and ownership checks on every route. This is the most common gap in student projects, and it teaches you authorization bugs (IDOR), which come up in interviews constantly.





## Tier 2: What makes you stand out for AI-related roles

6. **RAG (retrieval-augmented generation).** Let users upload a PDF or text file, chunk it, create embeddings, store them in a vector database (MongoDB Atlas Vector Search, pgvector or Qdrant), retrieve relevant chunks per question, and show citations. This is one of the most in-demand skills for AI application roles right now, and it gives you plenty to talk about: chunking strategies, embedding models, top-k, and evaluation.

7. **Tool calling / function calling.** Let the model call tools such as web search, a calculator, or fetching a URL, with a loop that executes the tools and feeds results back. This is the foundation of "agents", and it shows you can go beyond plain prompts.

8. **Provider fallback and resilience.** You already have four providers, so add retries with backoff, timeouts, and automatic failover, and log which provider served each request. It's a good system-design talking point.

9. **Conversation memory done properly.** Turn your summarization into something measurable: token counting with `tiktoken`, a background summary job, and a short write-up of the trade-offs versus just sending the full history.

## Tier 3: Skills that raise your ceiling

10. **TypeScript.** Migrating both frontend and backend is one of the highest-value upgrades, since most companies expect it.
11. **Docker and docker-compose.** One command (`docker compose up`) should run the app, API and database.
12. **Observability.** Structured logging with `pino`, request IDs, and tracking latency, token usage and error rate per provider. Even a small `/metrics` or admin page helps.
13. **Caching and queues.** Redis for rate limiting and caching, and a job queue (BullMQ) for summaries and file processing.
14. **Database design.** Move messages into their own collection with indexes and pagination, and be ready to explain why embedding them in one document stops scaling.
15. **Frontend polish.** Responsive layout, accessibility, dark and light themes, optimistic UI, error toasts, and a code-block copy button.


# top tier
must do feature
2. **multi step reasoning**
breadown the query if unclear
adding webserach
query into multiple sub queries
rag

1. Complete auth + multi-user isolation
Right now Backend/routes/chat.js:69 crashes if logged out and GET /thread leaks all users. Fix: enforce isLoggedIn from Backend/middlewares.js:1, filter every query by owner, add frontend login flow. Interview story: IDOR, session vs JWT, connect-mongo vs MemoryStore. This alone removes the "student project" tag.
2. One RAG use-case, with evals
PDF upload -> 500-token chunks -> embeddings -> Atlas Vector Search -> top-3 + citations. Add scripts/eval.js with 10 questions, report hit-rate and latency before/after RAG. For AI roles in 2026, "I can explain chunking, top-k, and why my eval went 40% -> 85%" beats any chatbot.
3. One agent loop, with guardrails
Implement your TODO.md:36-40 as: planner JSON {needs_search, sub_queries} -> Tavily web search + RAG in parallel -> synthesize. Add timeout, allowlist, cost log. Shows you understand agents, not just stream:true.
4. Ship like prod
Fix Backend/server.js:49 crash + package.json start script, add Dockerfile + docker-compose.yml, deploy frontend Vercel + backend Render/Fly + Atlas, add pino logs + /metrics with p95 latency, tokens, provider fallback.




## Future Work: Production-Grade AI System

The next phase is to evolve NovaChat from an application that calls an LLM API into a production-grade AI system. The work below is ordered by priority and focuses on capabilities expected in AI Engineer, LLM Application Developer, and Machine Learning Engineer projects.

### Phase 1: Core LLM Engineering

1. **user authentication**

3. **Provider abstraction and model swapping**
	- Introduce an `LLMService` abstraction behind the chat route.
	- Select a provider through `LLM_PROVIDER` in the environment.
	- Add provider strategies for Groq, OpenAI, Anthropic, and local Ollama models.
	- Keep provider-specific request and streaming logic out of the route handlers.

### Phase 2: Advanced AI Capabilities

4. **Retrieval-Augmented Generation (RAG)**
	- Add document upload for PDF, TXT, and CSV files.
	- Extract text and split documents into searchable chunks.
	- Generate embeddings and store chunks in MongoDB Atlas Vector Search, or a dedicated vector database such as Qdrant or Pinecone.
	- Retrieve the top three relevant chunks for each question and inject them into the model context.
	- Show citations or source references in the assistant response.

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

