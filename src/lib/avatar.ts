/**
 * Deterministic, Apple-style gradient avatars rendered as inline SVG data URIs.
 * Pure helpers — safe to import from client and server components.
 * (Kept out of `lib/auth.ts`, which uses `next/headers` and is server-only.)
 */

const PALETTES: Array<{ from: string; to: string }> = [
  { from: "#0A84FF", to: "#64D2FF" }, // blue → cyan
  { from: "#34C759", to: "#A8E063" }, // green
  { from: "#FF9F0A", to: "#FFD53D" }, // amber
  { from: "#5E5CE6", to: "#8E8CF0" }, // indigo
  { from: "#FF453A", to: "#FFB340" }, // sunset
  { from: "#0AB5C9", to: "#30D5C8" }, // teal
];

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function gradientFor(seed: string): { from: string; to: string } {
  return PALETTES[Math.abs(hashCode(seed)) % PALETTES.length];
}

function monogramFor(name: string): string {
  const letter = name.trim()[0];
  return letter ? letter.toUpperCase() : "A";
}

function squircle(seed: string, monogram: string): string {
  const { from, to } = gradientFor(seed);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="64" height="64" rx="16" fill="url(#g)"/>` +
    `<text x="32" y="35" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" ` +
    `font-size="28" font-weight="600" letter-spacing="0.5" fill="#FFFFFF">${monogram}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Agent avatar: gradient picked from `seed`, monogram from `name` (defaults to seed). */
export function avatarUrl(seed: string, name?: string): string {
  return squircle(seed, monogramFor(name ?? seed));
}

/** User avatar: gradient picked from the name, monogram from the name. */
export function userImage(name: string): string {
  return squircle(name, monogramFor(name));
}
