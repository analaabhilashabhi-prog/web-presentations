/**
 * Tiny path router. Patterns look like '/api/orgs/:orgId/sections'.
 * Routes declare paths only — handlers live in controllers.
 */
export function createRouter() {
  const routes = [];

  function add(method, pattern, handler, auth = 'none', options = {}) {
    const keys = [];
    const regexSource = pattern
      .split('/')
      .map((segment) => {
        if (!segment) return '';
        if (segment.startsWith(':')) {
          keys.push(segment.slice(1));
          return '/([^/]+)';
        }
        return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
      })
      .join('');
    routes.push({
      method,
      auth,
      handler,
      keys,
      // `raw` routes read the request stream themselves (binary uploads).
      raw: Boolean(options.raw),
      regex: new RegExp(`^${regexSource || '/'}/?$`),
    });
  }

  return {
    get: (p, h, auth, o) => add('GET', p, h, auth, o),
    post: (p, h, auth, o) => add('POST', p, h, auth, o),
    patch: (p, h, auth, o) => add('PATCH', p, h, auth, o),
    delete: (p, h, auth, o) => add('DELETE', p, h, auth, o),
    use: (other) => routes.push(...other.list()),
    list: () => routes,
    match(method, pathname) {
      let pathExists = false;
      for (const route of routes) {
        const found = route.regex.exec(pathname);
        if (!found) continue;
        pathExists = true;
        if (route.method !== method) continue;
        const params = {};
        route.keys.forEach((key, index) => {
          params[key] = decodeURIComponent(found[index + 1]);
        });
        return { route, params };
      }
      return pathExists ? { methodMismatch: true } : null;
    },
  };
}
