# Jotter

Your notes, your keys, your data. Jotter is a privacy-first notes application where every piece of content is encrypted on your device before it ever touches a server. Not even the backend can read what you write.

## What Jotter Does

Jotter combines the convenience of a modern notes app with genuine end-to-end encryption. Write rich-text notes, build checklists, clip web pages, and organize everything into notebooks and tags — all while keeping your data locked down with AES-256-GCM.

The app works offline by default. Notes live in IndexedDB (browser) or SQLite (mobile) and sync to the server only when you're connected. If you go offline for a week, nothing breaks.

## Getting Jotter Running

### Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL 8.0 (default credentials: root / 123456)

### 1. Database Setup

```bash
mysql -u root -p < backend/migrations/init.sql
```

This creates the `jotter_db` database and all required tables.

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` and proxies API calls to port 8000.

### 4. Android Build

```bash
cd frontend
npm run build
npx cap add android
npx cap sync
npx cap open android
```

Open the project in Android Studio and run from there.

## How Encryption Works

Jotter uses a zero-knowledge architecture. Here's the chain:

1. **Key derivation** — Your password is fed through PBKDF2 (310k iterations, SHA-256) to produce a derived key.
2. **Master key** — A random master key is generated on signup and encrypted with your derived key. The server stores this encrypted blob.
3. **Note encryption** — Each note is encrypted individually with AES-256-GCM using the master key.
4. **Server storage** — Only ciphertext reaches the backend. It has no ability to decrypt anything.
5. **Recovery** — A 32-byte hex recovery key lets you regain access if you forget your password, without losing data.
6. **Offline auth** — The local vault stores enough encrypted material to authenticate without the server.

## Project Layout

```
Jotter/
├── backend/              FastAPI server, SQLAlchemy models, JWT auth
│   ├── app/              Core application (routes, services, config)
│   └── migrations/       SQL schema and seed data
├── frontend/             React + Vite + TypeScript SPA
│   ├── src/
│   │   ├── components/   Reusable UI (cards, dialogs, buttons)
│   │   ├── hooks/        Custom React hooks
│   │   ├── lib/          Utilities (crypto, export, import, drive backup)
│   │   ├── pages/        Route-level views (dashboard, settings, auth)
│   │   ├── services/     API client layer
│   │   ├── stores/       Zustand state stores
│   │   └── db/           IndexedDB schema and vault
│   └── public/           Static assets, service worker, icons
├── AndroidApp/           Native Android shell (Kotlin, Capacitor)
│   └── app/src/main/     Activity, DB, sync client, notifications
├── start-backend.bat     Windows shortcut to launch the API
└── start-frontend.bat    Windows shortcut to launch the dev server
```

## Configuration

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | JWT signing key (min 32 chars) | `your-secret-key-min-32-chars` |
| `DATABASE_URL` | Async MySQL connection string | `mysql+aiomysql://root:123456@localhost:3306/jotter_db` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api` |

## Feature Rundown

| Feature | Status |
|---|---|
| Signup, login, password reset | Shipped |
| End-to-end AES-256-GCM encryption | Shipped |
| Offline-first with sync queue | Shipped |
| Rich text editing (TipTap) | Shipped |
| Checklists | Shipped |
| Note colors, pin, favorite, archive, trash | Shipped |
| Notebooks and tags | Shipped |
| Search with type and category filters | Shipped |
| PWA (installable, dark theme) | Shipped |
| Web clipper bookmarklet | Shipped |
| Google Drive encrypted backup | Shipped |
| Android app (Capacitor) | Shipped |
| Audio notes | Planned |
| Photo notes | Planned |
| File attachments | Planned |

## Stack at a Glance

| Layer | Technology |
|---|---|
| UI | React, TypeScript, Tailwind CSS, TipTap |
| State | Zustand, TanStack Query |
| Local storage | IndexedDB (web), SQLite (mobile) |
| Crypto | Web Crypto API (AES-GCM, PBKDF2) |
| Server | FastAPI, Python |
| Database | MySQL 8.0, SQLAlchemy async |
| Auth | JWT access + refresh tokens, bcrypt |
| Mobile | Capacitor, Kotlin |
| PWA | vite-plugin-pwa, service workers |
