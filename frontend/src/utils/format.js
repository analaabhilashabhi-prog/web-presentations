export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Light inline formatting for admin-entered text. Input is escaped first, so
 * only the markers below can ever produce markup.
 */
export function inlineRich(value) {
  return escapeHtml(value)
    .replace(/\[green-line:([^\]]+)\]/g, '<span class="text-brand-green-line">$1</span>')
    .replace(/\[green:([^\]]+)\]/g, '<span class="text-brand-green">$1</span>')
    .replace(/\[gold:([^\]]+)\]/g, '<span class="text-brand-gold">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br />');
}

/**
 * Mirrors safeHref() in the backend's section service. The server is the
 * authority — this stops an unsaved draft from rendering a scheme the server
 * would have refused, so preview and published output agree.
 */
export function safeHref(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;
  return '';
}

export function initials(name, max = 2) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function pluralize(count, word, plural = `${word}s`) {
  return `${count} ${count === 1 ? word : plural}`;
}
