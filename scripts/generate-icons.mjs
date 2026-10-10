// Spendly icon generator — "Soft Halo ₹", Midnight Cyan palette.
// Run: node scripts/generate-icons.mjs   (needs: npm i -D sharp)
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(out, { recursive: true });

const NAVY_TOP = '#13213F', NAVY_BOTTOM = '#070B16', CYAN = '#38BDF8';
const RUPEE = ['M 206 178 H 312', 'M 206 224 H 312',
  'M 218 178 H 252 C 302 178 302 270 252 270 H 218', 'M 218 270 L 298 348'];

// bg: 'rounded' (transparent corners) | 'full' (opaque, for maskable / iOS)
// glyphScale: >1 enlarges the ₹ (used for tiny favicons)
function svg({ bg, glyphScale = 1, halo = true }) {
  const rect = `<rect width="512" height="512" ${bg === 'rounded' ? 'rx="112" ' : ''}fill="url(#bg)"/>`;
  const paths = RUPEE.map(d => `<path d="${d}" fill="none" stroke="${CYAN}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY_TOP}"/><stop offset="1" stop-color="${NAVY_BOTTOM}"/></linearGradient></defs>
  ${rect}
  ${halo ? `<circle cx="256" cy="256" r="165" fill="${CYAN}" fill-opacity="0.14"/>` : ''}
  <g transform="translate(256 256) scale(${glyphScale}) translate(-256 -256)">${paths}</g>
</svg>`;
}

const targets = [
  { file: 'favicon.svg',              size: null, o: { bg: 'rounded', glyphScale: 1.2 } },
  { file: 'pwa-192x192.png',          size: 192,  o: { bg: 'rounded' } },
  { file: 'pwa-512x512.png',          size: 512,  o: { bg: 'rounded' } },
  { file: 'pwa-maskable-512x512.png', size: 512,  o: { bg: 'full' } },   // everything within 40% radius safe zone
  { file: 'apple-touch-icon.png',     size: 180,  o: { bg: 'full' } },   // opaque; iOS applies its own mask
];
for (const t of targets) {
  const markup = svg(t.o);
  if (!t.size) { writeFileSync(resolve(out, t.file), markup); continue; }
  let img = sharp(Buffer.from(markup), { density: 384 }).resize(t.size, t.size);
  if (t.o.bg === 'full') img = img.flatten({ background: NAVY_BOTTOM });
  await img.png({ compressionLevel: 9 }).toFile(resolve(out, t.file));
}
console.log('Icons written to', out);
