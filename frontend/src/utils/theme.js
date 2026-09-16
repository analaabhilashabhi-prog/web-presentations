/**
 * Applies an organization's brand tokens to the document. Only values that
 * came from the server palette are used; the text colour on top of a brand
 * fill is chosen between the two approved on-colour neutrals.
 */
const ON_LIGHT = '#111827';
const ON_DARK = '#FFFFFF';

function toRgb(hex) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function luminance(hex) {
  const { r, g, b } = toRgb(hex);
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function onColorFor(hex) {
  return luminance(hex) > 0.55 ? ON_LIGHT : ON_DARK;
}

/**
 * A brand colour used as *text* on white needs to be dark enough to read.
 * Torii's orange already is; Technical Hub's gold is not, so it is stepped
 * toward black until it clears roughly 4.5:1 — still the brand hue, legible at
 * caption size. Fills keep the true accent and pair it with `on-accent`.
 */
export function inkFor(hex) {
  const { r, g, b } = toRgb(hex);
  let scale = 1;
  let candidate = hex;
  // 0.16 clears 4.5:1 for every brand in the palette on both pane surfaces —
  // white and the tinted panel the subsections sit on — and reads as white-on-ink
  // at the same ratio, so the same value can fill a pill that carries text.
  while (luminance(candidate) > 0.16 && scale > 0.25) {
    scale -= 0.05;
    const clamp = (value) => Math.max(0, Math.min(255, Math.round(value * scale)));
    candidate = `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return candidate;
}

/**
 * Steps a brand colour toward black until it is dark enough to carry white.
 *
 * The collapsed rail leads with the colour the logo leads with rather than a flat
 * black, but a brand green at full strength is too light for white icons — 3.3:1.
 * Deepened to a luminance of 0.05 it measures better than 11:1 and is still
 * unmistakably the brand hue. A primary that is already black comes back
 * unchanged, which is what Torii wants.
 */
export function deepen(hex, target = 0.05) {
  const { r, g, b } = toRgb(hex);
  let scale = 1;
  let candidate = hex;
  while (luminance(candidate) > target && scale > 0.15) {
    scale -= 0.03;
    const clamp = (value) => Math.max(0, Math.min(255, Math.round(value * scale)));
    candidate = `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return candidate;
}

export function rgba(hex, alpha) {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyTheme(org) {
  const root = document.documentElement;
  if (!org) {
    root.removeAttribute('data-org');
    root.style.removeProperty('--font');
    root.style.removeProperty('--text-scale');
    return;
  }
  const theme = org.theme;
  const set = (name, value) => root.style.setProperty(name, value);

  root.setAttribute('data-org', org.id);

  // Typography is a brand control too, and applies to every section at once.
  if (org.font?.stack) {
    set('--font', org.font.stack);
    set('--text-scale', String(org.font.scale ?? 1));
  }
  set('--brand-primary', theme.primary);
  set('--brand-secondary', theme.secondary);
  set('--brand-accent', theme.accent);
  set('--brand-highlight', theme.highlight);
  set('--brand-on', theme.onBrand);
  set('--nav-bg', theme.navBg);
  set('--on-accent', onColorFor(theme.accent));
  set('--on-primary', onColorFor(theme.primary));
  set('--accent-ink', inkFor(theme.accent));

  /**
   * The navigation pane leads with the colour the logo leads with. Technical
   * Hub's logo is green with a gold detail, so its pane must read green even
   * though `accent` is the gold; Torii's primary is black, which cannot lead a
   * white pane, so it falls through to the orange. The second brand colour
   * carries the small details — captions, counts, the tint behind an icon.
   */
  const isNeutral = (hex) => {
    const l = luminance(hex);
    return l < 0.04 || l > 0.88;
  };
  const lead = isNeutral(theme.primary) ? theme.accent : theme.primary;
  const second = lead.toUpperCase() === theme.accent.toUpperCase() ? theme.highlight : theme.accent;
  set('--nav-accent', lead);
  set('--nav-accent-ink', inkFor(lead));
  set('--nav-on-accent', onColorFor(lead));
  set('--nav-second', second);
  set('--nav-second-ink', inkFor(second));

  /* Collapsed, the pane is a brand rail rather than a black one. It takes the
     primary — Technical Hub's green, Torii's black — deepened until white icons
     sit comfortably on it, and marks the selected section in the second brand
     colour: gold on green, which is the pairing the logo itself uses. */
  const railBase = luminance(theme.primary) > 0.88 ? lead : theme.primary;
  set('--nav-rail-bg', deepen(railBase));
  set('--nav-rail-active', second);
  set('--accent-soft', rgba(theme.accent, 0.12));
  set('--accent-line', rgba(theme.accent, 0.32));
  set('--primary-soft', rgba(theme.primary, 0.06));

  // Nav text is derived from its own fill rather than taken as given: an admin
  // may set a pale nav colour, and white-on-pale would be unreadable. Overlays
  // follow the same colour, so they stay visible either way.
  const navText = onColorFor(theme.navBg);
  set('--nav-text', navText);
  set('--nav-hover', rgba(navText, 0.1));
  set('--nav-line', rgba(navText, 0.14));
  set('--nav-dim', rgba(navText, 0.68));
}
