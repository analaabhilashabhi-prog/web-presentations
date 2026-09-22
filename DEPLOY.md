# Deploying to Render

The app is one Node process with **zero dependencies** that serves both the API
and the frontend. There is nothing to build. Deployment is: check out the repo,
run `node backend/src/server.js`.

`render.yaml` at the repo root already carries the settings; Render reads it.

## One click, from the repo

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/analaabhilashabhi-prog/web-presentations)

That link opens Render with this repository and its `render.yaml` already
selected. Sign in (GitHub is enough), give the service a name, type the two
passwords it asks for, press **Apply**. About three minutes later the deck is at
`https://<the name you gave it>.onrender.com`. Nothing else is needed; there is
no build step and no configuration beyond that file.

## Where it stands (2026-09-22)

- `https://profile.technicalhub.io` is up and **serving a commit from before
  2026-09-20** — none of the AI Partners, Workspace or Trusted By rows exist on
  it, and its `/api/auth/me` still hands out the OLD `admin@org.local` login
  hint. Whoever runs that host needs to `git pull` and restart; nothing in this
  repository can do it for them.
- `main` on GitHub is the whole deck as of this date. Push there and any host
  that tracks `main` (Render does, automatically) is current within minutes.

## The presenter signs in with one press

`/api/auth/me` serves the **presenter's** email and password to anyone who
opens the link, and the sign-in page arrives on Presenter with both boxes
filled — pressing Sign in (or Enter) opens the deck. That was asked for: the
deck is a brochure and the presenter can only read it. `PRESENTER_PREFILL=0`
turns it off. The admin's password is **never** served this way; an admin
switches the toggle and types it. It follows that `PRESENTER_PASSWORD` on a
public deployment is public by design — choose it knowing that, and keep
`ADMIN_PASSWORD` a real secret.

---

## Set the passwords, or the deploy publishes its own

`render.yaml` declares `ADMIN_PASSWORD` and `PRESENTER_PASSWORD` as `sync: false`,
so Render asks for both when the blueprint is first applied. Give it real ones.
Left blank, the app uses the defaults in `config/env.js` — `Admin@123` and
`Present@123` — and those are written in `CLAUDE.md` in a public repository, so
the live deck would be editable by anyone who reads it.

`SHOW_LOGIN_HINT` is off by default and must stay off in production: it serves
working credentials to anonymous callers on `/api/auth/me`.

---

## Before the first deploy

**Commit the content and the media.** These two must be in git or the deployed
site has no sections and no pictures:

    backend/data/db.json      the sections, blocks and asset records
    backend/uploads/          the image and video files themselves  (283 MB)

Check `.gitignore` is not excluding them.

**Set what the presenter is allowed to see** before you hand out the link:

    node tools/presenter-visibility.cjs            # read-only: what does a presenter get?
    
    node tools/presenter-visibility.cjs --show "Placements"
    node tools/presenter-visibility.cjs --hide "Placements"

Then commit `backend/data/db.json` again — that file *is* the release.

---

## Deploy

1. Push to `main` on `https://github.com/analaabhilashabhi-prog/web-presentations`
   (the deck's own repo; an earlier draft of this file named
   `harshavardhinijncet/Webpresentation`, which is a different remote)
2. Render → **New** → **Blueprint** → pick the repo. It reads `render.yaml`.
3. Deploy. First boot takes a couple of minutes.

Verified locally with exactly the settings Render uses
(`PORT` from the platform, `HOST=0.0.0.0`, `COOKIE_SECURE=1`):

    /api/health   200
    /             200
    /uploads/...  200
    login         200, cookie HttpOnly; SameSite=Lax; Secure
    presenter     sees only released sections

---

## The one thing that will bite you when presenting

**A free Render service sleeps after ~15 minutes of no traffic, and the next
request waits roughly 50 seconds while it wakes.** In front of a room that is a
minute of silence.

Two ways to avoid it:

- **Open the link 2–3 minutes before you present.** The instance stays awake for
  as long as it is being used, so the deck is fine once it is warm.
- **Keep it awake.** Point a free uptime monitor (UptimeRobot, cron-job.org) at
  `https://<your-app>.onrender.com/api/health` every 10 minutes. This is the
  reliable option if a presenter may open the link unannounced.

Nothing else about the free plan affects presenting: bandwidth is ample for a
283 MB deck, and the deck itself is paged, not streamed — a slide fetches only
its own pictures.

---

## What the free plan does not give you

**No persistent disk.** The container's filesystem resets on every deploy and
restart. Consequences:

- Content published *from the deployed admin login* is lost on the next restart.
  Publish locally, commit, push — the same flow you already use.
- Sessions live in `db.json`, so a restart signs everyone out. They log back in.

Everything the presenter sees is read from the committed `db.json` and
`backend/uploads/`, so the deck itself is never at risk.

If you later want to publish directly from the deployed site, that needs a
persistent disk — a paid Render plan, or Railway with a volume attached. Only
then would S3 be worth adding.

---

## Not Vercel, and not any serverless host

Tried 2026-09-18; it returns `500 FUNCTION_INVOCATION_FAILED`. Four things are
wrong with it, and the first is fatal on its own:

  - **There is no handler to invoke.** `backend/src/server.js` calls
    `server.listen()` and exports the server. A Vercel function has to export a
    `(req, res)` function; Vercel invokes nothing, nothing answers, and that is
    the 500. No `vercel.json` existed either, so the platform guessed at the
    layout.
  - **Every login writes to disk.** `session.model.js` calls `persist()`, which
    rewrites `db.json`. A serverless filesystem is read-only apart from `/tmp`,
    so the first sign-in throws `EROFS` and 500s even once a handler exists.
  - **283 MB of media cannot live in a function.** The bundle limit is 250 MB,
    so `backend/uploads/` would have to be served as static assets instead —
    a second deployment shape to keep in step with the first.
  - **Containers are disposable.** Sessions are held in `db.json`, so every cold
    start signs the room out.

None of that is a fault in the app: it is one long-running process with a
writable store, which is what Render and Railway run and what serverless does
not. A serverless deployment could only ever be view-only, and would need a
handler wrapper, a static route for `/uploads`, and stateless signed cookies.
Not worth it for a link that exists so people can look at the deck — the
presentation itself runs locally, with no internet, as it always has.

---

## Railway instead

Same shape. Railway has no free tier any more — a trial credit, then usage —
but it does offer volumes on paid plans, so it is the better home if you want
to publish in production.

    Start command   node backend/src/server.js
    Variables       HOST=0.0.0.0   COOKIE_SECURE=1
    (PORT is provided by the platform)

Attach a volume at `/app/backend` if you want writes to survive restarts.

## Open tabs pick up a deploy on their own

The portal loads its ES modules once and then navigates by hash, so a tab left
open across a deploy used to keep running the old code with no sign of it. The
symptom looked like a broken release: a new section returned its data correctly
and the old renderer, which had never heard of that block type, drew
"This section is blank".

`/api/health` now returns a `build` fingerprint — a hash of the contents of every
frontend file. The page checks it on load, on focus, and once a minute, and
reloads itself when it changes. The current hash is kept, so it lands back on the
same slide.

Two things it deliberately will not do: reload while presentation mode is on (the
reload waits until the presenter leaves it), and reload because a check failed —
a sleeping free-tier server is not a new build. Identical code always hashes to
the same id, so an ordinary restart never disturbs anyone.
