# Deploying GTA Portal so it works even when your laptop is off

The Cloudflare tunnel (`cloudflared tunnel --url ...`) only works while your
Mac, the two `npm run dev` servers, and `cloudflared` are all running — it's
a tunnel *to your laptop*, not real hosting. This guide deploys the app to
free-tier cloud hosting instead, so the link stays up on its own.

This is a **demo-grade deploy** for showing the prototype to your professor
or the board — not GMU's real production infrastructure (that still needs
the GitLab mirror / Buildah / Caddy pipeline and the Entra ID app
registration described in the architecture doc). Everything below uses free
tiers and no credit card.

What you'll end up with: one URL (e.g. `https://gta-portal.onrender.com`)
that serves the whole app — frontend and API together — backed by a real
Postgres database that doesn't depend on your computer being on.

All the commands below run in **your own Mac terminal** (same one you used
for the migration commands and `cloudflared`), not anywhere in this chat —
creating accounts and pushing to your own GitHub isn't something I can do
for you.

## 1. Push the code to GitHub

If you don't already have a GitHub account, create one at
[github.com](https://github.com) (free). Then create a new **empty** repo
(no README/license) at [github.com/new](https://github.com/new) — call it
`gta-portal` or similar, and note whether you made it public or private
(either works with Render's free tier).

In your terminal, from the `gta-app` folder:

```bash
cd gta-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(If `git push` asks you to sign in, follow its prompts — GitHub will walk
you through authenticating in the browser.)

## 2. Create a free Postgres database on Neon

Render's own free Postgres gets deleted 30 days after creation, which
defeats the point here — so the database lives on
[Neon](https://neon.tech) instead, whose free tier doesn't expire.

1. Sign up at [neon.tech](https://neon.tech) (free, no credit card).
2. Create a new project — any name/region is fine.
3. On the project dashboard, copy the **connection string** it gives you
   (starts with `postgresql://...`, ends with `?sslmode=require`). Save it
   somewhere — you'll paste it into Render in step 3.
4. Load the schema into it from your terminal (replace the connection
   string with your real one):

   ```bash
   psql "postgresql://<your-neon-connection-string>" -f server/prisma/schema.sql
   ```

5. Seed the 4 reference course sections the same way:

   ```bash
   cd server
   DATABASE_URL="postgresql://<your-neon-connection-string>" node prisma/seed.js
   ```

## 3. Deploy to Render

1. Sign up at [render.com](https://render.com) (free, no credit card) and
   connect your GitHub account when prompted.
2. Click **New** → **Blueprint**, and pick the `gta-portal` repo you just
   pushed. Render reads `render.yaml` at the repo root and sets up the web
   service automatically (build command, start command, health check).
3. It will ask you to fill in the `DATABASE_URL` value during setup — paste
   the Neon connection string from step 2. (`JWT_SECRET` is generated for
   you automatically; `NODE_ENV` is already set in `render.yaml`.)
4. Click **Apply** / **Deploy**. The first build takes a few minutes (it
   installs both `server` and `client` dependencies and runs `vite build`).

When it finishes, Render gives you a URL like
`https://gta-portal.onrender.com`. That's the link to send your professor —
it works whether or not your laptop is on.

## 4. What to expect

- **Free-tier cold starts**: after 15 minutes with no visitors, Render spins
  the service down. The next visit takes about a minute to wake back up
  (the visitor just sees a loading page, then the app). Nothing is lost —
  the database is separate and always available.
- **750 free instance-hours/month** on Render's free plan — far more than a
  demo needs.
- To change anything later, just push to `main` on GitHub — Render
  auto-deploys on every push.

## 5. After this

Once you're ready to move past the demo stage, the real target is GMU's own
infrastructure (GitLab mirror → Buildah → Caddy, per the architecture doc)
with real Entra ID/MSAL auth, not this free-tier setup — this just gets you
a durable link for board/professor review in the meantime.
