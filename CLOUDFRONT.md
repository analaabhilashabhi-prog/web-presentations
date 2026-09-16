# Putting CloudFront in front of the media bucket

The deck's images and films are already in S3. This connects them to a CDN so
that a college opening the link from anywhere gets them from a nearby edge
instead of from the single Node instance.

**Who can do this:** somebody with CloudFront and S3-policy permissions on
account `727596873106`. The IAM user currently in use, `harshavardhini_Mam`, is
**not** one of them — it has no CloudFront permissions at all, not even list. So
either an account administrator runs this, or that user is granted
`cloudfront:*` and `s3:PutBucketPolicy` first.

**Current state, verified:**

| | |
| --- | --- |
| Bucket | `babji-neelam-727596873106-ap-south-2-an` |
| Region | `ap-south-2` (Hyderabad — an opt-in region, see step 3) |
| Objects under `uploads/` | 341, 52.4 MB — complete |
| Bucket policy | none |
| Block Public Access | **all four settings off** — fix in step 1 |
| Existing distribution | none |

The application asks for paths like `/uploads/coe/aws.png`, and the objects are
at key `uploads/coe/aws.png`. So the mapping is direct and **no origin path is
needed** — do not set one, or the prefix gets doubled.

---

## Step 1 — Turn Block Public Access on

Counter-intuitive but correct: with Origin Access Control, CloudFront reads the
bucket as a *service principal*, which is not public access. Blocking public
access costs nothing and removes the possibility of someone later flipping an
object to world-readable by mistake.

    aws s3api put-public-access-block \
      --bucket babji-neelam-727596873106-ap-south-2-an \
      --region ap-south-2 \
      --public-access-block-configuration \
        BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

Console: S3 → the bucket → Permissions → Block public access → Edit → tick all
four.

Do this **before** step 4. `BlockPublicPolicy=true` still permits the OAC policy,
because that policy grants a service principal rather than `"Principal": "*"`.

---

## Step 2 — Create the Origin Access Control

    aws cloudfront create-origin-access-control \
      --origin-access-control-config '{
        "Name": "technicalhub-media",
        "Description": "Reads the presentation deck media bucket",
        "SigningProtocol": "sigv4",
        "SigningBehavior": "always",
        "OriginAccessControlOriginType": "s3"
      }'

Keep the `Id` it returns. Console: CloudFront → Origin access → Create control
setting → S3 → Sign requests (recommended).

Use OAC, **not** the older Origin Access Identity. OAI is legacy, and it does not
support the newer regions properly — which matters here, see the next step.

---

## Step 3 — Create the distribution

Console: CloudFront → Create distribution.

| Setting | Value | Why |
| --- | --- | --- |
| Origin domain | `babji-neelam-727596873106-ap-south-2-an.s3.ap-south-2.amazonaws.com` | **The regional endpoint.** `ap-south-2` is an opt-in region; the global `bucket.s3.amazonaws.com` form does not resolve for it and the origin returns errors that look like permission failures. |
| Origin access | Origin access control → `technicalhub-media` | From step 2 |
| Origin path | *leave empty* | Keys already begin `uploads/` |
| Viewer protocol policy | Redirect HTTP to HTTPS | |
| Allowed methods | GET, HEAD | The deck only reads |
| Cache policy | `CachingOptimized` (managed) | Forwards no cookies or headers, so the hit rate stays high |
| Compress objects | Yes | |
| Price class | **`PriceClass_200`** | `PriceClass_100` **excludes India.** Your audience is Indian colleges; 100 would send every Indian viewer to a European edge and undo the point of this. 200 covers India and most of the world; `All` adds South America and Australia. |
| Default root object | *leave empty* | This serves media, not a site |
| WAF | Not needed | Public read-only marketing files |

Note the distribution's **ID** and its **domain name** (`dxxxxxxxxxxxxx.cloudfront.net`).

Deployment takes 5–15 minutes. Until step 4 is done it will answer **403 on
everything** — that is expected, not a mistake.

---

## Step 4 — Let that distribution, and only it, read the bucket

Replace `DISTRIBUTION_ID` with the real one, then apply:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::babji-neelam-727596873106-ap-south-2-an/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::727596873106:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

    aws s3api put-bucket-policy \
      --bucket babji-neelam-727596873106-ap-south-2-an \
      --region ap-south-2 \
      --policy file://bucket-policy.json

The `AWS:SourceArn` condition is the part that matters. Without it the policy
trusts *any* CloudFront distribution in *any* AWS account — someone could point
their own distribution at your bucket and serve your files. With it, only this
one distribution can read, and the bucket stays private to everything else.

The console offers to copy this policy for you when you attach the OAC. That
copy is correct; use it if you prefer.

---

## Step 5 — Test on the CloudFront domain before touching DNS

Prove the origin plumbing works while it is still easy to debug:

    curl -I https://dxxxxxxxxxxxxx.cloudfront.net/uploads/coe/aws.png

Expect `HTTP/2 200` and `content-type: image/png`. Also test a film, and check
range requests work — video seeking depends on them:

    curl -I -H "Range: bytes=0-1023" \
      https://dxxxxxxxxxxxxx.cloudfront.net/uploads/platforms/torii-minds.mp4

Expect `206 Partial Content` and an `accept-ranges: bytes` header.

If you get **403**: the bucket policy's distribution ID does not match, or the
OAC is not attached to the origin.
If you get **307 or a redirect loop**: the origin is the global endpoint instead
of the `s3.ap-south-2` regional one.

---

## Step 6 — The custom domain

1. **Certificate in `us-east-1`.** ACM → request a public certificate for
   `cdn.technicalhub.io`, validated by DNS. It *must* be in `us-east-1`
   regardless of where the bucket is — CloudFront only reads certificates from
   that region. A certificate in `ap-south-2` will not appear in the dropdown,
   and this is the single most common place this process stalls.
2. **Alternate domain name.** Distribution → Settings → Edit → add
   `cdn.technicalhub.io`, select the certificate.
3. **DNS.** At whoever hosts `technicalhub.io`, add
   `cdn` → CNAME → `dxxxxxxxxxxxxx.cloudfront.net`.
4. Re-run the step 5 checks against `https://cdn.technicalhub.io/...`.

---

## Step 7 — Security headers, while you are here

I said earlier these belong at the edge rather than in the app. This is the
edge. CloudFront → Policies → Response headers → create one with HSTS,
`X-Content-Type-Options: nosniff` and a `Referrer-Policy`, then attach it to the
default behaviour.

Do **not** put a `Content-Security-Policy` on this distribution — it serves
images and video, not HTML, so a CSP here does nothing. The CSP belongs on the
proxy in front of the *app*, and when it is added it needs
`frame-src https://www.youtube-nocookie.com` or every film on the deck stops
playing.

---

## Step 8 — Point the app at it

Only once step 5 passes on the real domain:

    MEDIA_BASE_URL=https://cdn.technicalhub.io

No trailing slash, and no `/uploads` on the end — the app appends the stored
path itself. Restart, then open the deck and confirm images and a video load
from `cdn.technicalhub.io` in the browser's network tab.

To roll back, set it empty and restart. The app serves from local disk again
with no other change. That is also how the offline projector copy runs — leave
it unset there, and the same commit works both ways.

---

## Afterwards: adding media

    aws s3 sync backend/uploads/ s3://babji-neelam-727596873106-ap-south-2-an/uploads/ \
      --region ap-south-2 --size-only

**New files need no invalidation** — nothing is cached under a name that has
never been requested.

**Replacing an existing file does.** Many assets carry a content hash in the
filename (`thub-2016-ebf815198ce844a0.png`) and are safe, but hand-placed ones
like `Programs/moon.png` do not, and CloudFront will keep serving the old copy
for up to 24 hours:

    aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID \
      --paths "/uploads/Programs/moon.png"

The first 1,000 invalidation paths each month are free. Invalidate specific
paths rather than `/*` — a full invalidation empties every edge cache and the
next visitor from each region pays the cold-fetch cost.

---

## Cost

Storage for 52 MB is a rounding error — under ₹5 a month. Delivery from Indian
edges runs around $0.11/GB, so 100 GB of viewing is roughly $11. Expect
single-digit dollars in a normal month.

---

## Still outstanding, and unrelated to this

**The access key `AKIA2S2B…XX6SQ` is still active** — I confirmed it
answers `sts:get-caller-identity` today. It was shared over chat and should be
deleted, not rotated later. Nothing in this repository needs it, and the
application never authenticates to AWS: this migration is the reason it never
will.

**19 of the 20 films are YouTube embeds, not files in the bucket.** CloudFront
does nothing for those — they still need the venue's internet. If the deck has
to survive a room with no wifi, those films need downloading and re-encoding
into `backend/uploads/` first; then the CDN covers everything uniformly.
