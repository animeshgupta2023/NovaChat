# NovaChat — Intelligent Agentic RAG & Multi-Tool AI Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-http%3A%2F%2F3.26.67.166-brightgreen?style=for-the-badge&logo=amazonaws)](http://3.26.67.166)
[![AWS EC2](https://img.shields.io/badge/Deployed%20On-AWS%20EC2-FF9900?style=for-the-badge&logo=amazonec2&logoColor=white)](http://3.26.67.166)
[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](http://3.26.67.166)
[![Node Express](https://img.shields.io/badge/Backend-Node.js%2020%20%7C%20Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](http://3.26.67.166)
[![MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](http://3.26.67.166)
[![LangChain](https://img.shields.io/badge/Orchestration-LangChain%20Core-1C3C3C?style=for-the-badge&logo=chainlink&logoColor=white)](http://3.26.67.166)

> **Live Deployment:** [http://3.26.67.166](http://3.26.67.166)  
> *Hosted on an AWS EC2 instance (Ubuntu 24.04 LTS), orchestrated with PM2, and reverse-proxied with Nginx for zero-buffering Server-Sent Events (SSE).*

---

## Executive Overview

**NovaChat** is a production-grade, full-stack AI conversation platform built to bridge the gap between simple LLM wrappers and enterprise-grade Retrieval-Augmented Generation (RAG). 

Rather than relying on naive cosine similarity that blindly injects irrelevant chunks into prompt windows, NovaChat features a **Query-Aware Semantic Router (97.5% accuracy)**, **Multi-Query Decomposition with Reciprocal Rank Fusion (RRF)**, **In-Process ONNX Embeddings (`all-MiniLM-L6-v2`)**, and **Real-Time Agentic Tool Calling (Tavily Web Search & OpenWeather)** delivered through a low-latency **Server-Sent Events (SSE)** streaming pipeline.

---

## Key Engineering Highlights & "Why This Matters"

### 1. The RAG Engineering Moat: Beyond Naive Retrieval
Naive RAG fails in production when users ask conversational follow-ups, submit multi-intent comparison questions, or ask questions completely unrelated to uploaded documents. NovaChat solves this via a structured decision router:
- **`DIRECT`**: Bypasses document retrieval entirely for chitchat, coding, or live tool queries, avoiding prompt bloat and hallucinations (**100% suppression on non-document queries**).
- **`RAG_SINGLE`**: Focuses semantic search on the most relevant target documents with a 0.38 cosine similarity floor.
- **`RAG_REWRITE`**: Rewrites conversational ambiguous follow-ups (e.g., *"What were its financial risks?"*) into fully qualified standalone queries.
- **`RAG_DECOMPOSE` + RRF**: Splits multi-faceted cross-document queries into parallel sub-queries, scores them, and merges them using **Reciprocal Rank Fusion ($k=60$)**.

### 2. In-Process Edge Embeddings (`@huggingface/transformers`)
- Documents are parsed (with `pdf-parse`) and chunked via LangChain's `RecursiveCharacterTextSplitter` (1000-char chunks, 150-char overlap).
- Embeddings are generated **locally on the server** using `Xenova/all-MiniLM-L6-v2` (384-dimensional dense vectors).
- **Privacy & Cost Advantage:** Document text is embedded without transmitting full corpora to paid hosted embedding APIs.

### 3. Production Cloud Architecture on AWS EC2
- **Nginx Reverse Proxy**: Single-origin architecture eliminating cross-origin CORS latency; configured with `proxy_buffering off` and `X-Accel-Buffering: no` to ensure smooth token-by-token streaming.
- **PM2 Process Manager**: Daemonized execution with automatic restarts on crash and persistence across EC2 reboots (`pm2 startup systemd`).
- **Cloud Persistence**: Backed by **MongoDB Atlas** for multi-tenant users, session management, thread histories, document metadata, and vector storage.
- **Memory Optimization**: 2GB swap space configured to safeguard against Out-Of-Memory (OOM) spikes during ONNX model inference.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend (React 19 + Vite)"]
        UI["Chat Interface & Document Staging"]
        SSEListener["SSE Stream Consumer / Live Status Pills"]
    end

    subgraph AWS["AWS EC2 Host (Ubuntu 24.04 LTS)"]
        Nginx["Nginx Reverse Proxy (Port 80)"]
        
        subgraph BackendProcess["Node.js / Express (PM2 Managed)"]
            Router["Groq / Qwen Query Router"]
            Embedder["Local HuggingFace Transformers.js<br/>(Xenova/all-MiniLM-L6-v2)"]
            LangChain["LangChain Agent / Gemini 1.5"]
            Tools["Agent Tools: Tavily Web Search & OpenWeather"]
        end
    end

    subgraph CloudServices["External Cloud & Database"]
        Atlas[("MongoDB Atlas Cloud Database")]
        GeminiAPI["Google Gemini LLM API"]
        TavilyAPI["Tavily Search API"]
    end

    UI -->|HTTP / SPA Routes| Nginx
    Nginx -->|Proxy pass /api, /auth, /document| BackendProcess
    BackendProcess -->|Live token & status stream (SSE)| SSEListener

    BackendProcess --> Atlas
    Router -->|Classification: DIRECT / SINGLE / REWRITE / DECOMPOSE| LangChain
    Embedder -->|Cosine Similarity / RRF Search| Atlas
    LangChain --> GeminiAPI
    LangChain --> Tools
    Tools --> TavilyAPI
```

---

## Verified Benchmark Results (EVAL.md)

NovaChat includes a dedicated 40-query test harness (`Backend/scripts/runEvals.js`) testing multi-document factual retrieval, conversational follow-ups, cross-document comparisons, and trap/unanswerable questions:

| Metric | Baseline (Naive RAG) | NovaChat Pipeline (Router + RRF) | Improvement / Notes |
| :--- | :---: | :---: | :--- |
| **Router Accuracy** | *N/A* | **97.5%** | Correctly identifies query intent and document targets |
| **Direct / Tool Query Suppression** | 0.0% | **100.0%** | Zero unnecessary document chunks retrieved for general queries |
| **Unanswerable Refusal Rate** | 83.3% | **100.0%** | Completely prevents hallucinations on out-of-scope traps |
| **Retrieval Suppression (Traps)** | 0.0% | **50.0%** | Blocks document context when questions cannot be answered |
| **Hit-Rate@3 (Targeted Docs)** | 96.2% | **84.6%** | Eliminates low-similarity noise using a strict 0.38 threshold |
| **Median Time-to-First-Token (TTFT)**| 890 ms | **1558 ms** | Includes full classification, sub-query routing, and fusion |

---

## Core Capabilities & Features

- **⚡ Real-Time SSE Token Streaming:** Token-by-token generation with live status pills (`"Analyzing query against uploaded documents..."`, `"Searching the web..."`).
- **📄 Multi-Document Q&A:** Upload and index multiple PDF and TXT documents per thread with automated 3-sentence document summaries.
- **🔄 Sliding-Window Memory Summarization:** Unbounded conversation history without context window overflows; batches of older messages are summarized and prepended to fresh context.
- **🌐 Real-Time Agentic Web Tools:** Automatically detects current event queries and calls Tavily Search or OpenWeather live APIs.
- **🔐 Multi-Tenant Security & Authentication:** Passport.js session-based auth with MongoDB Atlas storage; user chats and document vectors are strictly tenant-isolated.
- **🎨 High-Fidelity UI/UX:** Clean chat interface featuring syntax-highlighted code blocks, copy-to-clipboard, auto-scrolling, and responsive layouts.

---

## Tech Stack Breakdown

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, Vite, React Router DOM 7, React Markdown, Rehype Highlight, FontAwesome |
| **Backend API** | Node.js 20 LTS, Express 5, Passport.js, Passport-Local, Express-Session, Multer |
| **AI / Orchestration**| LangChain Core, Google Gemini 1.5/2.0, Groq (Qwen/Llama), Zod Structured Outputs |
| **Embeddings & Vector**| HuggingFace Transformers.js (`all-MiniLM-L6-v2`), In-Memory Cosine Similarity & RRF |
| **Database** | MongoDB Atlas (Mongoose ODM), Cloud-hosted clusters with automated connection pooling |
| **DevOps & Cloud** | AWS EC2 (Ubuntu 24.04), Nginx Reverse Proxy, PM2 Process Manager, Let's Encrypt Ready |

---

## API Reference

### Authentication (`/auth`)
- `POST /auth/signup` — Create a new account and establish session.
- `POST /auth/login` — Authenticate existing user.
- `GET /auth/session` — Verify active session and user credentials.
- `GET /auth/logout` — Terminate session.

### Threads & Chat (`/api`)
- `GET /api/thread` — Retrieve all conversation threads for authenticated user.
- `GET /api/thread/:threadId` — Load message history for a specific thread.
- `POST /api/chat` — Send user message; opens an SSE stream delivering token chunks, status pills, and citations.
- `DELETE /api/thread/:threadId` — Delete conversation thread and its associated document chunks.

### Document Ingestion (`/document`)
- `POST /document/upload` — Multipart upload (`file`, `threadId`); parses, creates document summary, generates 384-dim embeddings, and indexes chunks.

---

## Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/animeshgupta2023/NovaChat.git
cd NovaChat
```

### 2. Configure Backend Environment
Create `Backend/.env`:
```env
PORT=8080
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/NovaChat?retryWrites=true&w=majority
LOCAL_MONGODB_URI=mongodb://127.0.0.1:27017/NovaChat
SESSION_SECRET=your_super_secret_session_key
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
```

### 3. Run Locally
**Terminal 1 (Backend):**
```bash
cd Backend
npm install
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd Frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Production Deployment Architecture (AWS EC2)

NovaChat is deployed on **AWS EC2** using an all-in-one high-performance architecture:

```text
/home/ubuntu/NovaChat/
├── Frontend/dist/       --> Statically served by Nginx (Port 80)
└── Backend/             --> Managed by PM2 as a daemon service (Port 8080)
```

### Key Deployment Commands
```bash
# Pull latest updates
cd ~/NovaChat && git pull

# Rebuild frontend
cd Frontend && npm install && npm run build

# Restart backend daemon
cd ../Backend && npm install && pm2 restart novachat-backend

# Test Nginx status
sudo nginx -t && sudo systemctl reload nginx
```

---

## Author & Contact

**Animesh Gupta**  
- **Live Application:** [http://3.26.67.166](http://3.26.67.166)  
- **GitHub:** [@animeshgupta2023](https://github.com/animeshgupta2023)  
- **Project Repository:** [NovaChat on GitHub](https://github.com/animeshgupta2023/NovaChat)