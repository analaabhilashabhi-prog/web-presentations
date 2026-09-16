import { NEUTRALS } from '../config/themes.js';

const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function initialsOf(name, max = 2) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/**
 * Event/gallery tile. Four deterministic pattern variants so a seeded gallery
 * looks like a set of distinct photos while staying inside the brand palette.
 */
export function tileSvg({ label, sub = '', theme, index = 0 }) {
  const variant = index % 4;
  const bases = [theme.primary, theme.accent, theme.primary, theme.highlight];
  const marks = [theme.accent, theme.primary, theme.highlight, theme.primary];
  const base = bases[variant];
  const mark = marks[variant];
  const w = 960;
  const h = 640;

  const patterns = [
    `<circle cx="800" cy="140" r="210" fill="${mark}" opacity="0.85"/>
     <circle cx="640" cy="470" r="120" fill="${NEUTRALS.surface}" opacity="0.12"/>
     <rect x="0" y="470" width="960" height="14" fill="${mark}"/>`,
    `<rect x="560" y="0" width="400" height="640" fill="${mark}" opacity="0.9"/>
     <rect x="60" y="60" width="150" height="150" fill="${NEUTRALS.surface}" opacity="0.16"/>
     <rect x="60" y="240" width="90" height="90" fill="${NEUTRALS.surface}" opacity="0.1"/>`,
    `<polygon points="960,0 960,420 520,0" fill="${mark}" opacity="0.9"/>
     <polygon points="0,640 340,640 0,320" fill="${NEUTRALS.surface}" opacity="0.1"/>
     <circle cx="500" cy="200" r="70" fill="${NEUTRALS.surface}" opacity="0.14"/>`,
    `<circle cx="180" cy="120" r="150" fill="${mark}" opacity="0.9"/>
     <circle cx="760" cy="520" r="200" fill="${NEUTRALS.surface}" opacity="0.12"/>
     <rect x="300" y="80" width="12" height="480" fill="${NEUTRALS.surface}" opacity="0.18"/>`,
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(label)}">
  <rect width="${w}" height="${h}" fill="${base}"/>
  ${patterns[variant]}
  <rect x="0" y="${h - 190}" width="${w}" height="190" fill="${theme.primary}" opacity="0.55"/>
  <text x="64" y="${h - 108}" font-family="${FONT}" font-size="52" font-weight="700" fill="${NEUTRALS.surface}">${escapeXml(label)}</text>
  <text x="64" y="${h - 56}" font-family="${FONT}" font-size="30" fill="${NEUTRALS.surface}" opacity="0.85">${escapeXml(sub)}</text>
</svg>`;
}

/** Team / trainer placeholder portrait: initials on a brand tile. */
export function avatarSvg({ name, role = '', theme, index = 0 }) {
  const alt = index % 2 === 0;
  const bg = alt ? theme.primary : theme.accent;
  const ring = alt ? theme.accent : theme.primary;
  const size = 520;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeXml(name)} ${escapeXml(role)}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <circle cx="${size / 2}" cy="${size / 2 - 10}" r="168" fill="${ring}" opacity="0.9"/>
  <circle cx="${size / 2}" cy="${size / 2 - 10}" r="140" fill="${NEUTRALS.surface}" opacity="0.14"/>
  <text x="50%" y="${size / 2 + 22}" text-anchor="middle" font-family="${FONT}" font-size="132" font-weight="700" fill="${NEUTRALS.surface}">${escapeXml(initialsOf(name))}</text>
  <rect x="0" y="${size - 60}" width="${size}" height="60" fill="${theme.primary}" opacity="0.5"/>
  <text x="50%" y="${size - 22}" text-anchor="middle" font-family="${FONT}" font-size="26" fill="${NEUTRALS.surface}" opacity="0.9">${escapeXml(role)}</text>
</svg>`;
}

/**
 * Organization wordmark used until a real logo is uploaded in settings.
 * The tagline is deliberately not drawn here — the side navigation and org
 * cards render it as text, and baking it in would show it twice.
 */
export function orgLogoSvg({ name, theme }) {
  const w = 720;
  const h = 200;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(name)}">
  <rect width="${w}" height="${h}" rx="26" fill="${theme.primary}"/>
  <rect x="46" y="48" width="16" height="104" fill="${theme.accent}"/>
  <rect x="78" y="48" width="16" height="104" fill="${theme.accent}" opacity="0.6"/>
  <text x="126" y="122" font-family="${FONT}" font-size="62" font-weight="700" fill="${NEUTRALS.surface}">${escapeXml(name)}</text>
</svg>`;
}

/** Partner/company mark for MOU and placement cards. */
export function partnerLogoSvg({ name, theme, index = 0 }) {
  const w = 480;
  const h = 200;
  const mark = index % 3 === 0 ? theme.primary : index % 3 === 1 ? theme.accent : theme.highlight;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(name)}">
  <rect width="${w}" height="${h}" rx="18" fill="${NEUTRALS.surface}"/>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="18" fill="none" stroke="${NEUTRALS.border}" stroke-width="2"/>
  <circle cx="72" cy="100" r="36" fill="${mark}"/>
  <text x="72" y="112" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="700" fill="${NEUTRALS.surface}">${escapeXml(initialsOf(name))}</text>
  <text x="130" y="94" font-family="${FONT}" font-size="30" font-weight="600" fill="${NEUTRALS.textPrimary}">${escapeXml(name.length > 20 ? `${name.slice(0, 19)}…` : name)}</text>
  <text x="130" y="128" font-family="${FONT}" font-size="20" fill="${NEUTRALS.textSecondary}">Sample partner mark</text>
</svg>`;
}
