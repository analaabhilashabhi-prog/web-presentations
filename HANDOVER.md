# Handover — technicalhub.io

Written for the deployment team, and for whoever maintains this next.

---

## 1. Do this before reading further

**The AWS access key `AKIA2S2B…XX6SQ` must be deleted, not rotated later.**

It was pasted into a chat, which means it exists in at least one transcript
outside your control. An access key with write permission on a bucket is enough
to delete every image in it, or to run up a bill against the account. Assume it
is compromised, because it is.

    IAM -> Users -> (that user) -> Security credentials -> Access keys -> Delete

Then read section 3 before creating a replacement — for this application the
correct number of long-lived access keys is **zero**, so you may not need one at
all.

Nothing in this repository contains that key. It is not in the working tree and
not in the git history; both were checked. `.gitignore` already excludes `.env`
and `.env.*`, so a key placed in a local env file cannot be committed by
accident.

---

## 2. There is a real secret already in the repository

`backend/data/db.json` is the application's datastore, it is committed, and it
contains the sign-in details for five live third-party platforms — TAG, the AI
Ready Engineer LMS, MYNA, OwlCoder and Torii Minds — including their Admin and
Super Admin accounts.

This was a deliberate decision made earlier, when the audience for the repo was
one person. Handing the repository to a deployment team changes who can read it,
and if the repo is public on GitHub it is readable by anyone who finds it.

Rewriting history will not help: those passwords have been in pushed commits for
some time and must be assumed captured. **The fix is to change the passwords on
those five platforms**, and then decide where the new ones live:

- **Best**: the Platforms page keeps the role names and the URLs, and drops the
  credentials entirely. A presenter signs in by hand, or from a password manager.
- **Acceptable**: credentials move to environment variables the server reads at
  boot and serves only to an authenticated admin, never to a presenter.

Say which and I will do it. Until then, treat those five accounts as public.

---

## 3. Where the media should live, and why no key is needed

The images and films are public marketing material. Nothing about them is
confidential, which makes the simplest architecture also the most secure:

    S3 bucket (private) -> CloudFront distribution (public) -> the deck

- Bucket policy grants read **only** to the CloudFront origin access identity.
  The bucket itself stays private; no object is world-readable directly.
- The application stores plain `https://cdn.technicalhub.io/...` URLs.
- **The application holds no AWS credentials at all.** Nothing to leak, nothing
  to rotate, nothing to put in an env var.

**Step-by-step instructions are in `CLOUDFRONT.md`**, written against the real
bucket: the exact origin endpoint, the bucket policy with the SourceArn
condition, the price class that actually includes India, and the two places the
process usually stalls.

Uploading new media is then an operations task, not an application feature:
`aws s3 sync` from a laptop with an SSO session or a short-lived role, or a
GitHub Action using an OIDC role. Neither needs a long-lived key.

**Do not** put an access key in the frontend. Anything the browser can read, a
visitor can read — a key in JavaScript is a published key, whatever the bucket
policy says.

### What has to change in the code

Media paths are stored in `db.json` as `/uploads/...` and are served by the Node
process from `backend/uploads/`. Introduce one setting:

    MEDIA_BASE_URL=https://cdn.technicalhub.io

Empty or unset, the app serves from `backend/uploads` exactly as it does today,
so nothing breaks and local development needs no AWS account. Set, every media
URL is prefixed with it. That is a small change in one helper rather than a
rewrite, and it keeps the offline path working — which matters, see section 5.

---

## 4. Configuration the deployment team needs

Copy `.env.example` to `.env`, at the repository root or inside `backend/` —
both are read, and `backend/.env` wins a key present in both. Better still, set
these in the platform's own environment panel, and then they are not on disk.

| Variable | Why | If unset |
| --- | --- | --- |
| `PORT` | Port to listen on | `4173` |
| `HOST` | `0.0.0.0` in a container | `127.0.0.1` |
| `SESSION_TTL_HOURS` | How long a sign-in lasts | `12` |
| `COOKIE_SECURE` | `1` behind HTTPS | off |
| `MEDIA_BASE_URL` | CDN prefix (section 3) | serves from disk |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeds the admin account | the documented defaults |
| `PRESENTER_EMAIL` / `PRESENTER_PASSWORD` | Seeds the presenter account | the documented defaults |

There is deliberately no `SESSION_SECRET`. Sessions are random tokens held in
`db.json` rather than signed cookies, so there is nothing to sign — an earlier
draft of these notes claimed otherwise and was wrong. Sessions do end at a
redeploy, because `db.json` is restored from the repository; that is the
datastore, not a missing secret.

**Change the two seeded passwords.** `Admin@123` and `Present@123` are in this
repository's README and in every commit of it. On a public URL they are not a
login, they are an invitation.

---

## 5. The three things that will actually go wrong in front of an audience

Ranked by how likely they are to happen and how bad they look.

### 5.1 The films need the internet — 19 of the 20 are YouTube embeds

Programs and Testimonials play their films from YouTube. On a venue's wifi, a
slow or blocked connection means a card opens onto a black rectangle in front of
a room. `CLAUDE.md` states the deck is presented with no internet, and these
embeds are the one thing in it that cannot honour that.

**Fix**: download the 19 films, put them in `backend/uploads/`, and they play
from the CDN or from disk like `Programs Videos/SkillUp.mp4` already does. They
should be re-encoded on the way in — the platform recordings went from 38MB to
4.5MB with no visible loss, and the same treatment applies here.

### 5.2 Sixteen images in each of two sections are 206×206 thumbnails

Success Stories and Centers of Excellence both contain files that are 206px
square and 8–13KB. They are fine as small tiles. Success Stories opens its
images at three quarters of the screen, where a 206px source is visibly soft.

These are not recoverable by processing — upscaling invents detail that was
never photographed. The originals have to be re-copied from wherever they were
first saved. I searched the machine for higher-resolution versions and there are
none.

### 5.3 `db.json` is a file, and the platform it deploys to has no disk

Render's free tier gives no persistent storage, so every restart resets
`db.json` to whatever is in the repository. Anything an admin changes through
the UI — releasing a section to presenters, for instance — is lost on the next
deploy or idle restart unless it is committed.

This is survivable because the content is authored by committing, not by typing
into the app. But the deployment team should know that:

- **Releasing a section must be committed** or it will revert.
- Two admins editing at once will overwrite each other; there is no locking.
- If content should be editable in production and stick, the datastore needs to
  move — Postgres, or S3 with a write path — and that is a real piece of work,
  not a setting.

---

## 6. Cold start, and why the first visitor waits

On Render's free plan the service sleeps after about 15 minutes idle and takes
roughly 50 seconds to wake. The first person to open the link after a quiet
period watches a blank loading screen for the better part of a minute, and will
assume the site is broken.

Two ways out:

- **Paid instance.** No sleeping. For a site that a college might open at any
  time, this is the honest answer.
- **Keep-alive.** A cron job hitting `https<domain>/api/health` every 10 minutes.
  Free, and it has been the outstanding item for weeks.

`/api/health` also returns a `build` fingerprint, which the frontend polls: when
the fingerprint changes, open tabs reload themselves. That is why a deploy no
longer leaves someone looking at stale code.

---

## 7. Security, as a checklist

Things already true, so nobody spends time on them:

- **No dependencies.** Zero npm packages at runtime, so no supply chain and no
  `npm audit` backlog.
- **No inline user HTML.** Text is set through `textContent`; the few rich fields
  go through a whitelist. Link and colour values are validated server-side —
  `safeHref` drops `javascript:` and `data:` rather than trying to clean them.
- **Role enforcement is server-side.** A presenter is refused a draft section by
  the API, not merely denied the button. Checked on list, on fetch, and on write.
- **Sessions are httpOnly cookies**, and expired ones are purged at boot.

Things to do:

- [ ] Delete the leaked AWS key (section 1)
- [ ] Change the five platform passwords (section 2)
- [ ] Change `ADMIN_PASSWORD` and `PRESENTER_PASSWORD` (section 4)
- [ ] Set `COOKIE_SECURE=1` — the domain will be HTTPS
- [ ] Decide whether the repository should be private. It carries the deck's
      content and, until section 2 is done, live credentials.
- [ ] Add security headers at the edge — CloudFront or the reverse proxy is the
      right place, not the app: `Strict-Transport-Security`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a CSP. A CSP
      needs `frame-src` for `youtube-nocookie.com` or every film breaks.

---

## 8. Running it

    cd backend && node src/server.js      # http://127.0.0.1:4173

Node 20+. No build step, no install. That is deliberate and worth preserving: it
is why this can be presented from a laptop with the wifi switched off.
