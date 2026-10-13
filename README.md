# 🤖 BroAgent

> **An AI companion you can talk to when you don't know who to talk to.**

AI Personal Education Agent — satu agent dengan banyak kemampuan dalam satu percakapan yang berkelanjutan.

## ✨ Features

- 💬 **Emotional Support** — Curhat, dengar, bantu urai masalah
- 🔎 **Research** — Riset topik dengan sumber terpercaya
- 💡 **Brainstorm** — Cari dan kembangkan ide
- 📚 **Learning** — Jelaskan materi sesuai level user
- 📝 **Assignment** — Bantu susun tugas (bukan mengerjakan!)
- 🛡️ **Safety** — Crisis detection & responsible AI

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS v4 |
| Backend API | NestJS + TypeScript + Supabase |
| LLM | Google Gemini + Groq (bisa dipilih user, OpenAI-compatible endpoint) |
| Voice input | Speech-to-text browser-native di kolom chat (ngomong → teks) |
| Database | Supabase (Postgres) |
| Monorepo | Turborepo + pnpm |

## 🏗️ Architecture

```text
Next.js Web
      ↓
NestJS API (Safety Check → Memory Retrieval → Gemini)
      ↓
Google Gemini  (generativelanguage.googleapis.com, OpenAI-compatible)
      ↓
Streaming tokens → client (SSE)
```

**Responsibilities:**
- **Next.js**: Frontend UI (consumes the SSE chat stream)
- **NestJS**: Application backend, auth, conversations, memory, safety boundary, Gemini client, research adapter
- **Gemini / Groq**: LLM provider yang bisa dipilih user dari dropdown model di chat
- **Research Tools**: Real web search via the Python agent's `ResearchTool` (DuckDuckGo / Tavily)

## 📁 Project Structure

```
bro-agent/
├── apps/
│   ├── web/          # 🌐 Next.js Frontend
│   ├── api/          # ⚙️ NestJS Backend
│   └── agent/        # 🧠 Python AI Agent (research adapter)
├── packages/
│   ├── shared-types/ # 📦 Shared TypeScript Types
│   └── tsconfig/     # ⚙️ Shared TS Configs
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- Python 3.12+
- pnpm (`npm install -g pnpm`)
- uv (`pip install uv`)

### 1. Install Dependencies

```bash
# JS dependencies
pnpm install

# Python dependencies
cd apps/agent && python -m uv sync
```

### 2. Setup Database (Supabase)

Create the tables once in the Supabase Dashboard → SQL Editor by running
`scripts/supabase_schema.sql` from this repo (creates `User`,
`ConversationThread`, `Message`, `Memory`, and `WorkflowRun` with RLS enabled).
No local database is required.

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env — set GEMINI_API_KEY (get one from https://aistudio.google.com/apikey)
# GEMINI_MODEL defaults to gemini-flash-latest.
```

### 4. Run Development

Open 3 terminals:

```bash
# Terminal 1 — NestJS API (port 4000)
pnpm --filter @bro/api dev

# Terminal 2 — Python Agent (port 8000)
cd apps/agent && python -m uv run uvicorn src.main:app --reload --port 8000

# Terminal 3 — Next.js Frontend (port 3000)
pnpm --filter @bro/web dev
```

Then open: **http://localhost:3000**

## 🔑 Configuration

BroAgent talks directly to Google Gemini through its OpenAI-compatible endpoint.
Get an API key from [Google AI Studio](https://aistudio.google.com/apikey) and set
`GEMINI_API_KEY` in `.env`. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`.

> **Free tier:** the free tier has a low daily request cap (e.g. 20/day per model
> for some models). If you hit quota limits, enable billing or switch `GEMINI_MODEL`.

| Service | Sign Up | Usage |
|---|---|---|
| [Google AI Studio](https://aistudio.google.com/apikey) | Gemini API Key | Chat + research (required) |
| [Groq Console](https://console.groq.com/keys) | Groq API Key | Model Groq di dropdown chat (optional) |

## 🔍 Health check

```bash
curl -s http://127.0.0.1:4000/gemini/health
```

Reports the configured Gemini model and whether the endpoint is reachable.
Returns no credentials.

## 📄 License

MIT
