# Putting Nibras School Management System online

This system was built to run **offline**, on the school's own computer — that's still the
recommended setup for day-to-day use (see `Start Nibras School System.bat`). This document
covers the *optional* extra step of also hosting a live, internet-reachable copy with a single
shared web link, using [Render](https://render.com).

## Why Render, and what it costs

Render was chosen because it can run this app's Node.js server continuously (not just static
files), and because it offers a persistent disk — without one, the database and every uploaded
photo would be wiped every time the server restarts, which defeats the purpose.

**This is not free.** As of writing, Render's free web-service tier does *not* support a
persistent disk (uploads/data get wiped on every restart or after 15 minutes idle), so this
guide uses their smallest paid plan:

- Web service (0.5 CPU / 512 MB): **$7/month**
- 1 GB persistent disk: **$0.25/month**
- **Total: ≈ $7.25/month**, billed to whatever card you add to your Render account

Prices are Render's, not Claude's, and may change — check https://render.com/pricing before
committing.

## One-time setup (you do this — I can't create accounts or attach billing on your behalf)

1. **Create a Render account:** go to https://render.com and sign up (GitHub sign-in is
   simplest, since the code already lives at `github.com/gozeystudio/gsManagementSystem`).
2. **New Web Service:** from the Render dashboard, click **New +** → **Web Service**.
3. **Connect the repository:** authorize Render to see your GitHub account, then pick
   `gozeystudio/gsManagementSystem`.
4. **Render will detect `render.yaml`** in this repo and offer to use it as a Blueprint — accept
   that. It pre-fills the plan, region, start command, and the persistent disk for you. (If it
   doesn't offer the Blueprint automatically, click **New +** → **Blueprint** instead and point
   it at this repo.)
5. **Confirm the plan** shown is the $7/mo "Less than 1 CPU" tier with a 1 GB disk attached at
   `/var/data` — that's what `render.yaml` requests.
6. Click **Apply** / **Create Web Service**. Render will build and start the app — first deploy
   takes a few minutes. Watch the **Logs** tab; you're looking for the same startup banner you'd
   see running it locally ("NIBRAS EDUCATIONAL COMPLEX — School Management System").
7. Once live, Render shows your URL at the top of the service page, something like:
   `https://nibras-school-system.onrender.com`
   That's the one link everyone (teachers, staff, parents, accountant) bookmarks and logs into
   with their existing username and password — same login system as the offline version.

## After it's live

- **Change the default admin password immediately.** The system ships with
  `admin` / `Admin@123` printed in its startup logs — fine on an offline school PC nobody outside
  the building can reach, not fine on the public internet. Log in and change it from Settings
  before sharing the link with anyone.
- **Custom domain (optional):** Render lets you attach your own domain (e.g.
  `portal.nibraseducationalcomplex.com`) for free under the service's **Settings → Custom
  Domains** tab, once you own that domain and point its DNS at Render.
- **Redeploys:** every push to the `main` branch on GitHub auto-deploys (that's what
  `autoDeployTrigger: commit` in `render.yaml` does). The database, uploads, and backups on the
  persistent disk are untouched by a redeploy — only the app code updates.
- **Backups:** the in-app Backup feature still works online exactly as it does offline, writing
  to the persistent disk. Because that disk isn't something you can casually plug a USB stick
  into, periodically download a backup from the app and store a copy somewhere else too (Render
  disks are reliable but are not a substitute for an independent backup).

## What did *not* change

The offline installation (`Start Nibras School System.bat` on a school Windows PC) is completely
unaffected by any of this — it's the same code, and it keeps using its own local files exactly as
before. The two can run side by side (e.g. the offline copy as the primary system, cloud copy as
a remotely-reachable mirror), but they are two **separate databases** that do not sync with each
other automatically.
