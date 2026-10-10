import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Standard CRC32 table implementation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodeRGBAtoPNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression: deflate
  ihdr[11] = 0; // Filter: none
  ihdr[12] = 0; // Interlace: none

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines with filter byte 0 (None) at the start of each line
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  let srcOffset = 0;
  let dstOffset = 0;

  for (let y = 0; y < height; y++) {
    scanlines[dstOffset++] = 0; // Filter byte 0
    rgbaBuffer.copy(scanlines, dstOffset, srcOffset, srcOffset + width * 4);
    dstOffset += width * 4;
    srcOffset += width * 4;
  }

  const compressedData = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Distance helper
function distanceSq(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

// Distance to line segment
function distToSegmentSq(px, py, x1, y1, x2, y2) {
  const l2 = distanceSq(x1, y1, x2, y2);
  if (l2 === 0) return distanceSq(px, py, x1, y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distanceSq(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1));
}

/**
 * Renders the Spendly icon to an RGBA pixel buffer.
 * @param {number} size - Width/Height
 * @param {boolean} isMaskable - If true, full-bleed background without rounded corners, scaled to 80% safe zone.
 */
function renderSpendlyIcon(size, isMaskable) {
  const buf = Buffer.alloc(size * size * 4);

  // Geometry scale factor
  // For maskable, keep glyph inside central 80% circle (diameter 0.8 * size)
  const scale = isMaskable ? 0.72 : 0.84;
  const center = size / 2;
  const cornerRadius = isMaskable ? 0 : size * 0.24;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Check card shape boundary for non-maskable icons
      if (!isMaskable) {
        // Distance from corners
        const qx = Math.max(Math.abs(x - center) - (center - cornerRadius), 0);
        const qy = Math.max(Math.abs(y - center) - (center - cornerRadius), 0);
        const cornerDist = Math.sqrt(qx * qx + qy * qy);

        if (cornerDist > cornerRadius) {
          // Transparent outside squircle
          buf[idx] = 0;
          buf[idx + 1] = 0;
          buf[idx + 2] = 0;
          buf[idx + 3] = 0;
          continue;
        }
      }

      // Base background: Dark obsidian gradient from #080c15 to #0f172a
      const vRatio = y / size;
      const hRatio = x / size;

      let bgR = Math.round(8 + 8 * vRatio);
      let bgG = Math.round(12 + 12 * vRatio);
      let bgB = Math.round(22 + 20 * vRatio);

      // Subtle ambient radial glow in upper-left
      const glowDist = Math.sqrt((x - size * 0.35) ** 2 + (y - size * 0.3) ** 2) / (size * 0.6);
      if (glowDist < 1.0) {
        const glowFactor = (1 - glowDist) * 0.25;
        bgR = Math.round(bgR + 20 * glowFactor);
        bgG = Math.round(bgG + 140 * glowFactor);
        bgB = Math.round(bgB + 220 * glowFactor);
      }

      // Card border for non-maskable
      if (!isMaskable) {
        const qx = Math.max(Math.abs(x - center) - (center - cornerRadius), 0);
        const qy = Math.max(Math.abs(y - center) - (center - cornerRadius), 0);
        const cornerDist = Math.sqrt(qx * qx + qy * qy);
        const edgeDist = Math.max(Math.abs(x - center), Math.abs(y - center));

        if (cornerDist > cornerRadius - 2 || (qx === 0 && qy === 0 && (center - edgeDist < 2))) {
          // Subtle outer glass rim
          bgR = Math.min(255, bgR + 45);
          bgG = Math.min(255, bgG + 55);
          bgB = Math.min(255, bgB + 75);
        }
      }

      // Coordinate relative to center in normalized range [-1, 1]
      const nx = (x - center) / (center * scale);
      const ny = (y - center) / (center * scale);

      // Render Spendly Emblem:
      // Stylized "S" Rupee icon composed of:
      // 1. Top horizontal bar of Rupee symbol: y in [-0.62, -0.46], x in [-0.55, 0.45]
      // 2. Second horizontal bar of Rupee symbol: y in [-0.36, -0.22], x in [-0.55, 0.25]
      // 3. Top upper curve of "S": arching from (-0.25, -0.46) through (0.42, -0.34) down to (0.1, 0.0)
      // 4. Middle diagonal spine of "S": from (0.2, -0.1) down-left to (-0.25, 0.2)
      // 5. Bottom lower loop of "S": arching from (-0.25, 0.2) down through (0.35, 0.52) ending at (0.42, 0.35)
      // 6. Upward growth spark (rhombus / diamond arrow) in upper right at (0.46, -0.56)

      let emblemAlpha = 0;
      let gradT = (nx + ny + 1.2) / 2.4; // Gradient blend parameter (0 = Cyan, 1 = Emerald)
      gradT = Math.max(0, Math.min(1, gradT));

      const strokeW = 0.13;
      const strokeWSq = strokeW * strokeW;

      // 1. Top horizontal bar: [-0.48, -0.54] to [0.38, -0.54]
      const dBar1 = distToSegmentSq(nx, ny, -0.44, -0.54, 0.38, -0.54);
      if (dBar1 < strokeWSq) {
        emblemAlpha = Math.max(emblemAlpha, 1 - Math.sqrt(dBar1) / strokeW);
      }

      // 2. Mid-upper horizontal bar: [-0.44, -0.30] to [0.18, -0.30]
      const dBar2 = distToSegmentSq(nx, ny, -0.44, -0.30, 0.18, -0.30);
      if (dBar2 < strokeWSq) {
        emblemAlpha = Math.max(emblemAlpha, 1 - Math.sqrt(dBar2) / strokeW);
      }

      // 3. Left vertical stem connector: [-0.40, -0.54] to [-0.40, 0.0]
      const dStem = distToSegmentSq(nx, ny, -0.40, -0.54, -0.40, 0.0);
      if (dStem < strokeWSq) {
        emblemAlpha = Math.max(emblemAlpha, 1 - Math.sqrt(dStem) / strokeW);
      }

      // 4. Upper right arch: from [-0.40, -0.16] to [0.34, -0.16] down to [0.34, 0.02]
      const dArchTop = distToSegmentSq(nx, ny, -0.40, -0.16, 0.30, -0.16);
      if (dArchTop < strokeWSq) {
        emblemAlpha = Math.max(emblemAlpha, 1 - Math.sqrt(dArchTop) / strokeW);
      }
      const dArchRight = distToSegmentSq(nx, ny, 0.30, -0.16, 0.30, 0.04);
      if (dArchRight < strokeWSq) {
        emblemAlpha = Math.max(emblemAlpha, 1 - Math.sqrt(dArchRight) / strokeW);
      }

      // 5. Middle crossing spine: from [0.30, 0.04] diagonally to [-0.35, 0.22]
      const dSpine = distToSegmentSq(nx, ny, 0.30, 0.04, -0.35, 0.22);
      if (dSpine < strokeWSq) {
        emblemAlpha = Math.max(emblemAlpha, 1 - Math.sqrt(dSpine) / strokeW);
      }

      // 6. Bottom curve: from [-0.35, 0.22] down to [-0.35, 0.44] across to [0.35, 0.44]
      const dBottomLeft = distToSegmentSq(nx, ny, -0.35, 0.22, -0.35, 0.48);
      if (dBottomLeft < strokeWSq) {
        emblemAlpha = Math.max(emblemAlpha, 1 - Math.sqrt(dBottomLeft) / strokeW);
      }
      const dBottomBar = distToSegmentSq(nx, ny, -0.35, 0.48, 0.35, 0.48);
      if (dBottomBar < strokeWSq) {
        emblemAlpha = Math.max(emblemAlpha, 1 - Math.sqrt(dBottomBar) / strokeW);
      }
      const dBottomRight = distToSegmentSq(nx, ny, 0.35, 0.48, 0.35, 0.26);
      if (dBottomRight < strokeWSq) {
        emblemAlpha = Math.max(emblemAlpha, 1 - Math.sqrt(dBottomRight) / strokeW);
      }

      // 7. Dynamic Growth Spark in upper-right (diamond/spark badge): center at (0.46, -0.50)
      const sparkDx = Math.abs(nx - 0.46);
      const sparkDy = Math.abs(ny - 0.50); // upper corner
      const diamondDist = sparkDx + sparkDy;
      if (diamondDist < 0.12) {
        const sparkAlpha = Math.min(1, (0.12 - diamondDist) / 0.03);
        emblemAlpha = Math.max(emblemAlpha, sparkAlpha);
      }

      // Clamp smooth anti-aliased alpha
      emblemAlpha = Math.max(0, Math.min(1, emblemAlpha));

      if (emblemAlpha > 0) {
        // Gradient color: Cyan (#38bdf8) to Emerald (#10b981)
        // #38bdf8 = R: 56, G: 189, B: 248
        // #10b981 = R: 16, G: 185, B: 129
        const emblemR = Math.round(56 * (1 - gradT) + 16 * gradT);
        const emblemG = Math.round(189 * (1 - gradT) + 185 * gradT);
        const emblemB = Math.round(248 * (1 - gradT) + 129 * gradT);

        // Alpha blend onto background
        bgR = Math.round(bgR * (1 - emblemAlpha) + emblemR * emblemAlpha);
        bgG = Math.round(bgG * (1 - emblemAlpha) + emblemG * emblemAlpha);
        bgB = Math.round(bgB * (1 - emblemAlpha) + emblemB * emblemAlpha);
      }

      buf[idx] = bgR;
      buf[idx + 1] = bgG;
      buf[idx + 2] = bgB;
      buf[idx + 3] = 255;
    }
  }

  return encodeRGBAtoPNG(size, size, buf);
}

// Generate all assets
const publicDir = path.resolve('public');

console.log('Generating Spendly PWA icon assets...');

// 1. Standard 192x192
const pwa192 = renderSpendlyIcon(192, false);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), pwa192);
console.log('✓ Created public/pwa-192x192.png (' + pwa192.length + ' bytes)');

// 2. Standard 512x512
const pwa512 = renderSpendlyIcon(512, false);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), pwa512);
console.log('✓ Created public/pwa-512x512.png (' + pwa512.length + ' bytes)');

// 3. Maskable 512x512
const pwaMaskable = renderSpendlyIcon(512, true);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pwaMaskable);
console.log('✓ Created public/pwa-maskable-512x512.png (' + pwaMaskable.length + ' bytes)');

// 4. Apple Touch Icon 180x180
const appleIcon = renderSpendlyIcon(180, false);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);
console.log('✓ Created public/apple-touch-icon.png (' + appleIcon.length + ' bytes)');

// 5. SVG Favicon
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <!-- Background Card -->
  <rect width="512" height="512" rx="120" fill="url(#bgGrad)"/>
  <rect x="8" y="8" width="496" height="496" rx="112" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>

  <!-- Ambient Glow -->
  <circle cx="200" cy="180" r="140" fill="#38bdf8" opacity="0.12" filter="url(#glow)"/>

  <!-- Spendly Stylized S-Rupee Emblem -->
  <g fill="none" stroke="url(#brandGrad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round">
    <!-- Top Rupee Bar -->
    <line x1="160" y1="140" x2="352" y2="140" />
    <!-- Second Rupee Bar -->
    <line x1="160" y1="200" x2="310" y2="200" />
    <!-- S Curves -->
    <path d="M 170 140 L 170 240 Q 170 280 256 280 Q 342 280 342 340 Q 342 390 256 390 L 170 390" />
  </g>

  <!-- Growth Spark -->
  <polygon points="360,105 375,125 360,145 345,125" fill="#38bdf8" />
  <circle cx="360" cy="125" r="4" fill="#ffffff" />
</svg>
`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg, 'utf8');
console.log('✓ Created public/favicon.svg');

console.log('All icons generated successfully!');
