# NovaChat

NovaChat is a personal ChatGPT-style application for day-to-day conversations. It has a React/Vite frontend, an Express backend, MongoDB persistence for chat threads, and Groq-powered language model responses.

## Features

- Start a new conversation and receive streamed-looking assistant text as it is rendered word by word.
- Persist conversations in MongoDB.
- Browse previous threads sorted by most recently updated.
- Open or delete saved threads from the sidebar.
- Render assistant responses as Markdown with highlighted code blocks.
- Display a loading indicator while the backend requests an assistant response.

## Project Structure

```text
NovaChat/
├── Backend/
│   ├── models/Thread.js       # Thread and message schemas
│   ├── routes/chat.js         # Thread and chat API routes
│   ├── utils/openai.js        # Groq chat-completion request
│   ├── package.json
│   └── server.js              # Express server and MongoDB connection
├── Frontend/
│   ├── src/
│   │   ├── App.jsx            # Application state and context provider
│   │   ├── ChatWindow.jsx     # Chat input and assistant request flow
│   │   ├── Chat.jsx           # Conversation rendering
│   │   ├── Sidebar.jsx        # Thread history and controls
│   │   └── *.css              # Component styles
│   ├── package.json
│   └── vite.config.js
├── newFeatures.md             # Planned features
└── README.md
```

## Prerequisites

- Node.js 18 or later, which provides the `fetch` API used by the backend.
- A MongoDB deployment or local MongoDB instance.
- A Groq API key.

## Configuration

Create `Backend/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/novachat
GROQ_API_KEY=your_groq_api_key
```

The `.env` file is ignored by Git. Do not commit API keys or database credentials.

## Installation

Install dependencies in both application folders:

```bash
cd Backend
npm install

cd ../Frontend
npm install
```

## Running Locally

Start MongoDB, then run the backend from `Backend/`:

```bash
node server.js
```

The API listens on `http://localhost:8080`.

In a second terminal, run the frontend from `Frontend/`:

```bash
npm run dev
```

Vite serves the application at `http://localhost:5173`. The frontend currently uses this fixed backend URL:

```text
http://localhost:8080/api
```

For development with automatic backend restarts, use:

```bash
cd Backend
nodemon server.js
```

## API Reference

All routes are mounted under `/api`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/thread` | Return all threads, newest updated first. |
| `GET` | `/thread/:threadId` | Return the messages for one thread. |
| `POST` | `/chat` | Add a user message, generate an assistant response, and save both messages. |
| `DELETE` | `/thread/:threadId` | Delete a thread. |

### Create a chat message

Request body:

```json
{
	"threadId": "a-client-generated-uuid",
	"message": "Explain how async functions work"
}
```

Successful response:

```json
{
	"reply": "..."
}
```

The first message creates the thread and uses the message as its title. Later messages are appended to the same thread.

## Data Model

Each thread contains:

- `threadId`: unique client-generated UUID.
- `title`: first message, or `New Chat` by default.
- `messages`: ordered user and assistant messages with timestamps.
- `createdAt` and `updatedAt`: thread timestamps.

## Frontend Commands

Run these from `Frontend/`:

```bash
npm run dev      # Start the Vite development server
```

## Backend Notes

The backend calls Groq's OpenAI-compatible chat-completions endpoint using the `openai/gpt-oss-20b` model. CORS is currently configured for `http://localhost:5173`; update the origin in `Backend/server.js` when deploying the frontend elsewhere.


## Future Work: Production-Grade AI System

The next phase is to evolve NovaChat from an application that calls an LLM API into a production-grade AI system. The work below is ordered by priority and focuses on capabilities expected in AI Engineer, LLM Application Developer, and Machine Learning Engineer projects.

### Phase 1: Core LLM Engineering

1. **True streaming with Server-Sent Events (SSE)**
	- Enable Groq streaming with `stream: true`.
	- Change the chat endpoint to return `text/event-stream`.
	- Forward response chunks from the backend as they arrive.
	- Consume the stream with the frontend `fetch` API and `ReadableStream` reader.
	- Replace the current simulated typewriter effect with token-level updates.

2. **Context-window management**
	- Send only a sliding window of recent messages, such as the last 10 turns.
	- Add summarization when a thread exceeds a configured message threshold.
	- Preserve the summary as system context while removing older raw messages from the LLM request.
	- Track token usage so context limits and request costs remain visible.

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

### Planned Execution Order

1. **Week 1:** Implement true SSE streaming and context-window management.
2. **Week 2:** Add RAG with MongoDB Atlas Vector Search.
3. **Week 3:** Add tool calling and Langfuse observability.
4. **Week 4:** Polish the UI with cost and latency metrics, then deploy the frontend and backend.
