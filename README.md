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

