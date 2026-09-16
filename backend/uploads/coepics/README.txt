CENTRE PHOTOS AND VIDEOS
========================

One folder per centre, all twenty already created. Drop the photos and videos
for a centre straight into its folder — they show up in that card's gallery
when it is opened on the slide.

  backend/uploads/coepics/microsoft/lab-opening.jpg
  backend/uploads/coepics/microsoft/azure-bootcamp.mp4
  backend/uploads/coepics/cisco/networking-lab-01.jpg

Filenames do not matter. They are ordered alphabetically, so number them if you
want a particular order: 01-..., 02-..., 03-...

  Images   .jpg  .jpeg  .png  .webp  .avif  .gif
  Video    .mp4  .webm  .mov  .m4v

The twenty folders:

  claude   gcp        aws       oracle    redhat   snowflake  pega
  servicenow  mongodb  github   paloalto  hubspot  openai     aa
  splunk   cisco      cadence   mile2     microsoft  o9

Keep the folder names lowercase exactly as they are. Windows does not care
about case but the server this deploys to does, and a folder called "Microsoft"
would 404 in front of a room.


AFTER ADDING FILES

Tell me, and I will re-run the publish step, which scans these folders and
writes the manifest the page reads. A web page cannot list a directory, and an
endpoint that did would not survive being presented offline — so nothing new
appears until that runs.

Video is worth keeping small: a 20MB clip that plays instantly on this machine
can stall on the hosted copy. Around 1-2MB per clip is plenty at the size these
tiles are drawn.
