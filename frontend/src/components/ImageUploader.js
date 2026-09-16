import { h } from '../utils/dom.js';
import { uploadFiles } from '../services/contentService.js';
import { toastError, toastSuccess } from './Toast.js';
import { pluralize } from '../utils/format.js';

const ACCEPT = {
  image: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp,image/tiff,image/avif,.psd,image/vnd.adobe.photoshop',
  video: 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/x-matroska,.mov,.mkv,.avi,.m4v',
  // Section icons are drawn small on a dark panel: PNG for raster marks, SVG
  // for line marks. Anything else would only ever look wrong at 18px.
  icon: 'image/png,image/svg+xml,.png,.svg',
  any: 'image/*,video/*,.psd',
};

/** Opens the OS file picker and resolves with the chosen files. */
export function chooseFiles({ multiple = true, accept = 'image' } = {}) {
  return new Promise((resolve) => {
    const input = h('input', {
      type: 'file',
      accept: ACCEPT[accept] || ACCEPT.any,
      multiple,
      style: { display: 'none' },
    });
    input.addEventListener('change', () => {
      resolve(input.files);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

/** Uploads files and reports the outcome; resolves with created assets. */
export async function upload(files) {
  if (!files?.length) return [];
  const list = Array.from(files);
  const notice = list.some((file) => file.size > 12 * 1024 * 1024 || file.type.startsWith('video/'))
    ? toastSuccess(`Uploading ${pluralize(list.length, 'file')} — large media can take a moment…`)
    : null;
  try {
    const assets = await uploadFiles(list);
    notice?.remove();
    toastSuccess(`Uploaded ${pluralize(assets.length, 'file')}`);
    return assets;
  } catch (err) {
    notice?.remove();
    toastError(err.message);
    return [];
  }
}

/** Click-or-drop upload target used by the gallery and block editors. */
export function UploadDropzone({
  label = 'Drop files here, or click to browse',
  multiple = true,
  accept = 'image',
  onUploaded,
}) {
  const zone = h('div', { class: 'dropzone', role: 'button', tabindex: '0', text: label });

  const run = async (files) => {
    if (!files?.length) return;
    zone.textContent = 'Uploading…';
    zone.classList.add('is-busy');
    const assets = await upload(files);
    zone.classList.remove('is-busy');
    zone.textContent = label;
    if (assets.length) onUploaded(assets);
  };

  zone.addEventListener('click', async () => run(await chooseFiles({ multiple, accept })));
  zone.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      run(await chooseFiles({ multiple, accept }));
    }
  });
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-over');
    run(event.dataTransfer?.files);
  });

  return zone;
}
