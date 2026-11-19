# ICMCP — Institutional Committee Management & Compliance Portal

A full-stack MERN application for tracking statutory committee compliance
(NAAC / NBA / UGC) at higher-education institutions.

```
icmcp-fullstack/
  client/   React 18 + Tailwind (dark mode) + Chart.js frontend (Vite)
  server/   Express + MongoDB/Mongoose REST API
```

## What's new in this round

- **Mail** — a built-in mailbox (Inbox, Starred, Sent, Drafts, Archive,
  Trash) so any signed-in user (Admin, Coordinator, or Member) can email any
  other user in the institution directly from the portal. Supports To/Cc/Bcc
  with a name-or-email recipient search, file attachments, Reply/Reply
  All/Forward with threading, saving drafts, starring, archiving, and
  search across subject/body and sender/recipient. New mail also raises an
  in-app notification. Everything is stored permanently in MongoDB (`Mail`
  + `MailState` collections) — nothing is ephemeral.
- **Dark mode** — toggle in your Profile page, saved to your account (syncs
  across devices/browsers), with a "System" option that follows your OS.
- **Real committee membership** — Admin assigns existing Coordinator/Member
  accounts to a committee via dropdowns (User Management → create accounts
  first, then Committee Registry → assign them). This is what makes
  notifications and per-user visibility actually work.
- **Notifications on scheduling** — when anyone schedules a meeting, every
  Coordinator/Member assigned to that committee, plus every Admin, gets an
  in-app notification.
- **Document preview before download** — every generated document (Notice,
  Agenda, Minutes of Meeting, Compliance Report) opens in a preview modal
  first (the real `.docx`, converted to HTML in your browser). From there
  you can **Edit** the underlying content (agenda items, minutes, action
  items, attendance) — saving regenerates the document and re-shows the
  preview — or **Download** the exact file you're looking at.
- **Meeting stats for every role** — Coordinators/Members get "My
  Committees" (scoped to what they're assigned to); Admin sees everything
  via the Dashboard and Committee Registry.
- **"All Minutes of Meeting"** (Admin) — every conducted meeting across
  every committee, sorted by meeting date (toggle newest/oldest first).
- **Profile page** — name, designation, email (password-confirmed), password
  change, photo upload, and the theme setting above.
- **Month-end activity check** — on the 1st of each month, any committee
  that had **no meeting scheduled or conducted** in the month that just
  ended automatically notifies that committee's Coordinators/Members.

## Roles

| Role | Can do |
|---|---|
| **Admin** | Everything: create Coordinator/Member accounts, register committees and assign people to them, view/manage every committee, generate any document for any committee, see all Minutes of Meeting, escalate overdue committees |
| **Coordinator** | Schedule meetings for committees they're assigned to, conduct meetings, upload documents, view "My Committees" |
| **Member** | Conduct meetings and upload documents for committees they're assigned to — cannot schedule new meetings |

The database starts **empty** except for one bootstrapped Admin account.
Nothing else is seeded — everything else is created through the app.

## Setup

```bash
cd icmcp-fullstack
cp server/.env.example server/.env
cp client/.env.example client/.env
```

In `server/.env`: set `MONGO_URI`, replace both JWT secrets with your own
random strings, and set `INSTITUTION_NAME` (appears on every generated
document's letterhead).

```bash
npm install       # installs root + client + server together (npm workspaces)
npm run seed       # creates the first Admin account (safe to re-run)
npm run dev         # starts BOTH the API and the frontend, one terminal
```

```
[SERVER] [server] ICMCP API listening on http://localhost:5000
[CLIENT]   VITE v5.4.21  ready in 628 ms
[CLIENT]   ➜  Local:   http://localhost:5173/
```

`Ctrl+C` stops both.

## First-time walkthrough

1. Sign in with the bootstrapped Admin account
2. **User Management** → create at least one Coordinator and one Member account
3. **Committee Registry** → register a committee, assigning that Coordinator and Member to it
4. Sign in as the Coordinator → **Schedule Meeting**
   - Everyone assigned to that committee (plus all Admins) gets notified immediately
5. As the Coordinator or Member → **Conduct Meeting** → fill in minutes/action items → upload the agenda/MoM PDFs + photos
6. Back as Admin (or the Coordinator, via **My Committees**) → open the committee → **Preview** the generated Notice/Agenda/Minutes documents, optionally **Edit** the content, then **Download**
7. **Profile** (top-right, any role) → try the dark mode toggle, upload a photo

## Production build

```bash
npm run build           # builds the client to client/dist
cd server && npm start   # NODE_ENV=production in server/.env
```

In production, the server refuses to start with the dev-mode default
`ACCESS_TOKEN_SECRET`/`REFRESH_TOKEN_SECRET` values, and `npm run seed`
refuses to create the bootstrap Admin with the default password unless
you explicitly set `BOOTSTRAP_ADMIN_PASSWORD`. Generate real secrets (e.g.
`openssl rand -hex 32`) and put them in `server/.env` before deploying.

## Persisting data between deployments

Two things must both survive a restart or redeploy, or previously-uploaded
photos/logos will appear broken even though nothing in the app is wrong:

1. **`server/uploads/`** — every avatar, college logo, and generated
   document lives here as a plain file on disk. It's intentionally
   `.gitignore`'d (you don't want other people's uploaded files in your git
   history), which also means a fresh `git clone` or a freshly-extracted
   zip always starts with this folder empty. If you replace your project
   folder with a new copy of the code, copy your existing `server/uploads/`
   folder over first, or point `UPLOAD_DIR` at a location outside the
   project folder that you don't wipe.
2. **MongoDB itself** — if you're pointing at an ephemeral/in-memory
   Mongo, or a Docker container without a persistent volume, every restart
   wipes the users/committees/records that reference those files. Restarting
   `npm run dev` on an already-running project does **not** touch either of
   these (verified: nothing in this codebase drops the database or clears
   the uploads folder on startup) — this only bites when the underlying
   storage itself isn't persistent.

As of this update, a stale `avatarUrl`/`collegeLogoUrl` (pointing at a file
that's missing for either reason above) now falls back gracefully to an
initials/icon placeholder in the UI instead of a broken image icon.

## Resetting all data

`npm run db:reset` (in `server/`) permanently deletes every collection —
users (including Admin), committees, meetings, notices, news/events, and
settings — plus everything in `server/uploads/`. It's interactive by
default (type `RESET` to confirm); pass `--yes` or set `CONFIRM=RESET` to
skip the prompt in a script. This is a manual, standalone script — nothing
in the running application ever calls it. After running it, `npm run seed`
recreates a fresh Admin account.

## Notes on MongoDB transactions

Conducting a meeting writes inside a transaction for atomicity, which
requires a MongoDB replica set (true for Atlas by default). Against a bare
local `mongod` (standalone), the code automatically falls back to a
sequential write — local dev works either way, no config needed.

## Intentional scope limits

- The academic-year selector in the top bar isn't wired to filter data by
  year yet — it's a UI control only.
- Document preview renders via `mammoth` (docx→HTML conversion in the
  browser). It faithfully represents text, headings, tables, and images,
  but won't be pixel-identical to opening the file in Word — fonts/spacing
  can differ slightly between a browser's HTML rendering and Word's native
  layout engine. The downloaded `.docx` itself is the real, exact file.
