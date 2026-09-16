DROP A DESIGN HERE
==================

TARGET: Leadership -> Success Stories  (the CEO success stories page)

DECIDED: this REPLACES the existing content, in BOTH organizations.
  technical-hub  sec_28488e9d069c46e5   3 blocks: text, cards, text
  torii          sec_d4e08727d7284f44   2 blocks: text, cards
Both are currently published and visible to presenters. The current content is
in git, so the replaced version stays recoverable.

Save the .jsx / .html file into this folder and tell me the filename. If it is
for a different page than the one above, say which

I read it from disk, so there is no size limit — a paste gets cut off at about
50,000 characters, which is roughly one base64 image.

IMAGES: please supply them as real files rather than inlined data URIs.

  incoming/New Design/images/hoot.jpg
  incoming/New Design/images/internships.jpg

Two reasons. A base64 image is about a third larger than the file it encodes,
and it lands inside a JavaScript module the browser has to parse before the
slide can draw — this deck is presented from a laptop with no internet, and
that cost is paid on every visit to the page. Real files are served straight
from backend/uploads, cached by the browser, and can be re-encoded when one
turns out to be 12MB.

The design you sent already supports this: the comment at the top of IMAGES
says any value can be replaced with a path.
