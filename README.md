# GTA Portal — working prototype

A real, running version of the GTA Application rebuild: React (Vite) frontend,
Express backend, Postgres database. This replaces the earlier click-through
HTML mockup with an app that actually stores data and enforces real rules
(seat counts, eligibility caps, role-based access).

Matches the board's Option 2 architecture decision (`architecture-decision-nodejs-webapp.md`
in the Claude project) with two intentional gaps, explained below: authentication
is stubbed, and the database is driven with plain SQL instead of Prisma.

## What's real here

- **Applicant flow**: sign in, build a profile, apply to real course sections
  (live seat counts, full-time/part-time eligibility caps enforced server-side),
  see submitted applications and their status. No pre-loaded/fake data — every
  user and application in the database was created by an actual sign-in or
  submission.
- **Faculty dashboard**: live stats, search/filter/sort, CSV export, and
  Schedule Interview / Hire / Move back to pending actions that persist to
  Postgres and are visible to the applicant immediately.
- **Admin**: a minimal starting point (user list, section management) scaffolded
  ahead of the IST use cases, per the board's three-role split.

## What's stubbed, and why

**Authentication.** The architecture decision calls for Entra ID + MSAL App
Roles, but that needs an Azure AD app registration this environment has no
access to — it's explicitly flagged as the critical-path blocker in the
architecture doc (pending ASRB/Tenant Admin approval). `server/src/auth.js`
issues a signed session for whatever name/email/role you type on the login
screen. Every route downstream just trusts `req.user`, so swapping in real
auth later means replacing the `POST /api/auth/login` handler only — validate
the MSAL id_token, map its App Role claim to our `Role` enum, upsert the user
the same way the stub does. Nothing else changes.

**Database driver.** `prisma/schema.prisma` is the real target data model —
kept deliberately 1:1 with the SQL below. But this build environment's network
policy blocks Prisma's engine-binary CDN (`binaries.prisma.sh`), so
`prisma generate`/`migrate` can't run here. `prisma/schema.sql` is the same
schema written by hand and applied directly with `psql`; the server talks to
Postgres with the plain `pg` driver instead of `@prisma/client`. See
**"Swapping in real Prisma"** below — on GMU's actual infrastructure this
should be a same-day switch, not a rebuild.

## Project layout

```
gta-app/
  server/            Express API
    prisma/
      schema.prisma  target data model (for real Prisma, once network allows it)
      schema.sql      the same schema, hand-written, applied via psql
      seed.js         seeds reference course sections only — no fake people
    src/
      index.js        app entrypoint, route wiring
      db.js           Postgres connection (pg)
      auth.js         stub auth — see above
      routes/         profile, sections, applications, faculty, admin
  client/             React (Vite) frontend
    src/
      api.js          fetch wrapper for the backend
      context/AuthContext.jsx
      pages/          Login, applicant/*, faculty/*, admin/*
      index.css       Mason green/gold theme, light + dark mode
```

## Running it locally

Prerequisites: Node 20+, Postgres 14+ running locally.

**1. Database**

```bash
createdb gta_portal
psql gta_portal -f server/prisma/schema.sql
```

**2. Server**

```bash
cd server
npm install
cp .env.example .env   # edit DATABASE_URL/JWT_SECRET if needed
node prisma/seed.js    # seeds 4 reference course sections, nothing else
npm run dev            # http://localhost:4000
```

**3. Client** (separate terminal)

```bash
cd client
npm install
npm run dev             # http://localhost:5173
```

Open `http://localhost:5173`. Sign in with any name/email and pick a role
(Applicant / Faculty Reviewer / Admin) — this creates that user for real on
first sign-in.

## Swapping in real Prisma

Once this runs somewhere `binaries.prisma.sh` isn't blocked (GMU's actual
infra, or your own machine on a normal network):

```bash
cd server
npm install prisma @prisma/client --save-exact
npx prisma generate
```

The existing `prisma/schema.prisma` already matches the live database, so
`npx prisma db pull` will confirm they're in sync (it should report no
changes). From there you can either keep the hand-written SQL path or switch
`src/db.js` and the route files to `@prisma/client` calls — the schema itself
does not need to change.

## Known limitations (prototype scope)

- Resume "upload" only captures a file name client-side — no file storage
  backend yet (matches the earlier mockup's scope).
- No GMU-infra deployment config yet (GitLab mirror / Buildah / Caddy) — see
  `DEPLOY.md` for a free-tier deploy (Render + Neon Postgres) used for
  reviewer/professor demos in the meantime; moving to GMU's own infra is still
  a separate step once that access exists.
- Admin screen is intentionally minimal until IST's use cases define what it
  actually needs to do (group sync, catalog export, CLSS update, etc. — see
  the architecture doc's "Admin maintenance" note).
