# Deploying to Render

The app is one Node process with **zero dependencies** that serves both the API
and the frontend. There is nothing to build. Deployment is: check out the repo,
run `node backend/src/server.js`.

`render.yaml` at the repo root already carries the settings; Render reads it.

---

## Before the first deploy

**Commit the content and the media.** These two must be in git or the deployed
site has no sections and no pictures:

    backend/data/db.json      the sections, blocks and asset records
    backend/uploads/          the image and video files themselves  (~65 MB)

Check `.gitignore` is not excluding them.

**Set what the presenter is allowed to see** before you hand out the link:

    node tools/presenter-visibility.cjs            # read-only: what does a presenter get?
    
    node tools/presenter-visibility.cjs --show "Placements"
    node tools/presenter-visibility.cjs --hide "Placements"

Then commit `backend/data/db.json` again — that file *is* the release.

---

## Deploy

1. Push to `https://github.com/harshavardhinijncet/Webpresentation.git`
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
65 MB deck, and the deck itself is paged, not streamed.

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
