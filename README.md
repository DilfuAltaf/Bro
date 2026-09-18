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
| Backend API | NestJS + TypeScript + Prisma |
| Database | XAMPP MySQL/MariaDB |
| AI Agent | Python + FastAPI + LangGraph |
| LLM | Gemini 2.0 Flash (Google AI) |
| Monorepo | Turborepo + pnpm |

## 📁 Project Structure

```
bro-agent/
├── apps/
│   ├── web/          # 🌐 Next.js Frontend
│   ├── api/          # ⚙️ NestJS Backend
│   └── agent/        # 🧠 Python AI Agent
├── packages/
│   ├── database/     # 🗄️ Prisma Schema (MySQL)
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
- XAMPP (MySQL)

### 1. Install Dependencies

```bash
# JS dependencies
pnpm install

# Python dependencies
cd apps/agent && python -m uv sync
```

### 2. Setup Database

1. Start **XAMPP** → Start **MySQL**
2. Open **phpMyAdmin** → Create database `bro_agent`
3. Push Prisma schema:

```bash
pnpm db:push
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY from https://aistudio.google.com
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

## 🔑 API Keys

| Service | Sign Up | Free Tier |
|---|---|---|
| [Google AI Studio](https://aistudio.google.com) | Gemini 2.0 Flash | 15 RPM, 1M TPM |

## 📄 License

MIT
