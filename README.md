# Jotter

Your notes, your keys, your data. Jotter encrypts note titles and content on your device with AES-256-GCM and syncs them as ciphertext. This is client-side encryption at rest, not zero-knowledge: the server receives your password at login and stores the wrapped master key, so a malicious server could decrypt your data. See [Security model](#security-model) for exactly what is and isn't protected.

## What Jotter Does

Jotter combines the convenience of a modern notes app with client-side encryption of note content. Write rich-text notes, build checklists, clip web pages, and organize everything into notebooks and tags — content is locked down with AES-256-GCM before it leaves your device, though metadata syncs in the clear (see [Security model](#security-model)).

The app works offline by default. Notes live in IndexedDB (browser) or SQLite (mobile) and sync to the server only when you're connected. If you go offline for a week, nothing breaks.

Storage is encrypted at rest too. Whether a note is sitting in the browser vault or on your phone's SQLite file, it's ciphertext until you're actively reading it.

## Getting Jotter Running

### Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL 8.0 (credentials must be set in `backend/.env`)

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

copy .env.example .env         # Windows
# cp .env.example .env         # macOS / Linux

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`.env` is gitignored; `.env.example` is the committed template. Set `SECRET_KEY` to a unique 32+ character value before running.

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

## Running with Docker

### Prerequisites

- Docker Desktop

### Steps

1. Copy `.env.docker` and fill in real values for `SECRET_KEY` and `MYSQL_ROOT_PASSWORD`
2. `docker compose up --build`
3. App runs at http://localhost

Step 1 replaces `REPLACE_THIS_TOO` in three places — `MYSQL_ROOT_PASSWORD`, `DATABASE_URL` and `SYNC_DATABASE_URL`. Compose reads this file literally, so the password is not shared between them automatically.

To stop: `docker compose down`
To wipe the database volume: `docker compose down -v`

## How Encryption Works

Jotter uses client-side encryption. Here's the chain:

1. **Key derivation** — Your password is fed through PBKDF2 (310k iterations, SHA-256) to produce a derived key.
2. **Master key** — A random master key is generated on signup and encrypted with your derived key. The server stores this encrypted blob along with the salt used for derivation.
3. **Note encryption** — Each note is encrypted individually with AES-256-GCM using the master key.
4. **Server storage** — Note titles, content, and attachment bytes reach the backend as ciphertext, but the backend also receives your password at signup/login and holds the wrapped master key, so it can decrypt content. See [Security model](#security-model).
5. **Recovery** — A 32-byte hex recovery key lets you regain access if you forget your password, without losing data.
6. **Offline auth** — The local vault stores enough encrypted material to authenticate without the server.

### Android at-rest encryption

The native Android app applies the same client-side encryption to on-device storage:

1. **Keystore-wrapped password** — Your app password is encrypted with a hardware-backed AndroidKeyStore AES-256 key (StrongBox where available) and stored in protected prefs.
2. **Encrypted SQLite** — Note titles and content in `jotter_native.db` are AES-256-GCM encrypted with a key derived from your password via PBKDF2 (310k iterations, SHA-256).
3. **Decrypt in memory only** — Notes are decrypted for display; search and filtering run in memory over decrypted content instead of SQL.
4. **No backup leaks** — The encrypted database and the keystore-wrapped password prefs are excluded from cloud backup and device transfer.
5. **HTTPS-only sync** — Production builds default to `https://api.jotter.app/api` and reject any cleartext endpoint.
6. **Sync caveat** — The native sync client pushes notes after decrypting them, so content synced from the Android app reaches the server as plaintext. Local task, attachment, comment, and calendar-link rows are also stored unencrypted. See [Security model](#security-model).

## Security model

Jotter is client-side encrypted at rest. It is not zero-knowledge. Here is exactly what that means.

### What is protected

- Note titles and bodies, notebook titles, tag names, and attachment file names, bytes, and search text are encrypted in the client with AES-256-GCM under a random per-user master key before sync. The server stores these fields as ciphertext.
- The master key is wrapped with a key derived from your password via PBKDF2 (310k iterations, SHA-256). The browser keeps the unwrapped master key in memory only for the logged-in session.
- Local storage holds ciphertext too: the browser vault (IndexedDB) and the Android `notes` table both store encrypted titles and content.
- A 32-byte recovery key lets you unwrap the master key if you forget your password.

### What is not protected

- **The server receives your raw password.** Signup, login, and password change send the password in the request body, and the server verifies it with bcrypt. A malicious or compromised server, or anything that logs request bodies (proxies, debug tooling), can capture it.
- **The server stores the wrapped master key and the PBKDF2 salt.** Combined with a captured password, that is enough to derive the wrap key, unwrap the master key, and decrypt every synced note and attachment.
- **A database leak alone enables offline password guessing** against the wrapped master key, with each guess verified by the AES-GCM authentication tag.
- **Metadata is synced and stored in plaintext**: note type, the source URL of clipped pages, category names, colors, icons, sort order, reminder/due timestamps, pin/favorite/archive flags, notebook and tag metadata, attachment MIME type and size, your email and full name, share recipient emails, and session metadata (device name, IP address, user agent).
- **Some data types are not encrypted at all.** The backend defines plaintext columns and API routes for task titles, saved-search labels and queries, and calendar-event titles, locations, and attendees. The web app currently keeps these local-only, but anything sent through those routes is stored unencrypted.
- **The native Android app syncs decrypted content.** It decrypts note title and content before pushing them to the server, so notes synced from the Android shell are stored server-side as plaintext. Its local tasks, attachments, comments, and calendar links are also unencrypted in SQLite.
- **Google Drive tokens** are Fernet-encrypted at rest, but under the server's own `SECRET_KEY`, so the server can decrypt them.

### Known accepted risks

- No rate limiting on the auth endpoints.
- No email verification at signup.
- Auth tokens are delivered as httpOnly cookies, but the refresh and logout endpoints also accept a JWT in the JSON body, and the backend still defines an unused token-in-body response schema.
- The CSP is declared in an `index.html` meta tag, not an HTTP response header.
- PBKDF2 runs at 310k iterations, below current OWASP guidance of 600k.

**Status:** personal-use project, not deployed publicly, not independently audited.

A stronger design that never sends the password or the wrapping key to the server is being explored in a separate project called Parley.

## Security Hardening

- AES-256-GCM client-side encryption of note titles, content, and attachment data (metadata and some data types stay plaintext — see [Security model](#security-model))
- Android notes encrypted at rest (AES-256-GCM, PBKDF2-derived key; AndroidKeyStore wraps the stored password)
- httpOnly cookie auth (no tokens in localStorage)
- CSP declared in `index.html` meta tag (not an HTTP response header)
- Google Drive tokens encrypted at rest (Fernet, under the server's `SECRET_KEY`)

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
│   └── app/src/main/     Activity, encrypted DB, sync client, notifications
├── start-backend.bat     Windows shortcut to launch the API
└── start-frontend.bat    Windows shortcut to launch the dev server
```

## Configuration

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | JWT signing key (min 32 chars) | `your-secret-key-min-32-chars` |
| `DATABASE_URL` | Async MySQL connection string | `mysql+aiomysql://root:123456@localhost:3306/jotter_db` |
| `DEBUG` | Set `True` only for local development with SQLite | `True` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api` |

## Feature Rundown

| Feature | Status |
|---|---|
| Signup, login, password reset | Shipped |
| Client-side AES-256-GCM note encryption | Shipped |
| On-device note encryption (Android) | Shipped |
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
| Crypto | Web Crypto API, AndroidKeyStore (AES-256-GCM, PBKDF2) |
| Server | FastAPI, Python |
| Database | MySQL 8.0, SQLAlchemy async |
| Auth | httpOnly cookies, JWT (access + refresh), bcrypt |
| Mobile | Capacitor, Kotlin |
| PWA | vite-plugin-pwa, service workers |
