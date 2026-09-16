/** Hash router: no build step, no server rewrites, refresh-safe. */
let handler = null;

export function parseRoute() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const parts = raw.split('/').filter(Boolean);

  if (parts[0] === 'login') return { name: 'login' };
  if (parts[0] === 'orgs') return { name: 'orgs' };
  if (parts[0] === 'o' && parts[1]) {
    const orgId = parts[1];
    if (parts[2] === 'settings') return { name: 'settings', orgId };
    if (!parts[2]) return { name: 'present', orgId, sectionId: null };
    if (parts[3] === 'edit') return { name: 'edit', orgId, sectionId: parts[2] };
    return { name: 'present', orgId, sectionId: parts[2] };
  }
  return { name: 'home' };
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === target) {
    handler?.();
    return;
  }
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

export function startRouter(onRoute) {
  handler = onRoute;
  window.addEventListener('hashchange', onRoute);
  onRoute();
}

export function refresh() {
  handler?.();
}
