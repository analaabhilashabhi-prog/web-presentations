CENTERS OF EXCELLENCE — where the files go
==========================================

LOGOS  ->  backend/uploads/coe/     (or coe/logos/ — both are scanned)

Two files per centre:

  <name>.png        the mark shown on the grid card
  <name> full.png   the wordmark shown big when the card is opened

Names are matched loosely, so there is nothing to rename: spaces, hyphens and
case are all fine, and the common short forms are aliased —

  google -> Google Cloud        mongo -> MongoDB
  automation anywhere -> Automation Anywhere
  palo alto -> Palo Alto        red hat -> Red Hat

Supply only one of the two files and it is used in both places. Mile2 currently
has only a wordmark, and its card uses that.

.svg, .png and .webp all work. SVG is best — it stays sharp on a projector at
any size. Otherwise a transparent background, at least 400px on the long edge
for the card mark and 900px wide for the wordmark.

The nineteen centres:

  claude  gcp  aws  oracle  redhat  snowflake  pega  servicenow  mongodb
  github  paloalto  hubspot  openai  aa  splunk  cisco  cadence  mile2
  microsoft


PHOTOS AND VIDEOS  ->  backend/uploads/coe/<key>/

One folder per centre, already created, named with the keys above. Drop the
photos and videos for that centre straight in; filenames do not matter and the
order is alphabetical.

  backend/uploads/coe/microsoft/lab-opening.jpg
  backend/uploads/coe/microsoft/azure-bootcamp.mp4
  backend/uploads/coe/cisco/networking-lab-01.jpg

Images: .jpg .png .webp    Video: .mp4 .webm


AFTER ADDING FILES

Tell me and I will re-run the publish step, which scans these folders and
writes the manifest the page reads. A web page cannot list a directory, and an
endpoint that did would not survive being presented offline — so nothing new
appears until that runs.
