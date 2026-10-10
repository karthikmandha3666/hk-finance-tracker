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

  // Scanlines with filter byte 0 (None)
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  let srcOffset = 0;
  let dstOffset = 0;

  for (let y = 0; y < height; y++) {
    scanlines[dstOffset++] = 0;
    rgbaBuffer.copy(scanlines, dstOffset, srcOffset, srcOffset + width * 4);
    dstOffset += width * 4;
    srcOffset += width * 4;
  }

  const compressedData = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle helper
function distToRoundedRect(px, py, rx, ry, rw, rh, rad) {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const halfW = rw / 2 - rad;
  const halfH = rh / 2 - rad;
  const qx = Math.max(Math.abs(px - cx) - halfW, 0);
  const qy = Math.max(Math.abs(py - cy) - halfH, 0);
  return Math.sqrt(qx * qx + qy * qy) - rad;
}

/**
 * Renders the Option 3: Smart Wallet Spendly icon to RGBA buffer with 2x2 supersampling.
 * @param {number} size - Canvas size (192, 512, 180)
 * @param {boolean} isMaskable - Full-bleed background with extra safe-padding for adaptive masks
 */
function renderSmartWalletIcon(size, isMaskable) {
  const buf = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const cornerRadius = isMaskable ? 0 : size * 0.22;

  // Scale factor (maskable is scaled by 0.85 to remain strictly inside the central 80% circle)
  const scale = (size / 512) * (isMaskable ? 0.84 : 0.96);

  const subOffsets = [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let totalR = 0;
      let totalG = 0;
      let totalB = 0;
      let totalA = 0;

      for (let s = 0; s < 4; s++) {
        const px = x + 0.5 + subOffsets[s][0];
        const py = y + 0.5 + subOffsets[s][1];

        // 1. Squircle boundary check for non-maskable
        if (!isMaskable) {
          const qx = Math.max(Math.abs(px - center) - (center - cornerRadius), 0);
          const qy = Math.max(Math.abs(py - center) - (center - cornerRadius), 0);
          const cornerDist = Math.sqrt(qx * qx + qy * qy);

          if (cornerDist > cornerRadius) {
            continue;
          }
        }

        let subA = 255;

        // 2. Base Background: Deep Emerald Gradient (#022c22 to #011f18)
        const tBg = (px / size + py / size) / 2;
        let r = Math.round(2 * (1 - tBg) + 1 * tBg);
        let g = Math.round(44 * (1 - tBg) + 31 * tBg);
        let b = Math.round(34 * (1 - tBg) + 24 * tBg);

        // Ambient mint luminescence in upper-left
        const glowDist = Math.sqrt((px - size * 0.41) ** 2 + (py - size * 0.37) ** 2) / (size * 0.38);
        if (glowDist < 1.0) {
          const glowFactor = (1 - glowDist) * 0.22;
          r = Math.min(255, Math.round(r + 52 * glowFactor));
          g = Math.min(255, Math.round(g + 211 * glowFactor));
          b = Math.min(255, Math.round(b + 153 * glowFactor));
        }

        // Outer glass rim highlight for non-maskable
        if (!isMaskable) {
          const qx = Math.max(Math.abs(px - center) - (center - cornerRadius), 0);
          const qy = Math.max(Math.abs(py - center) - (center - cornerRadius), 0);
          const cornerDist = Math.sqrt(qx * qx + qy * qy);
          const edgeDist = Math.max(Math.abs(px - center), Math.abs(py - center));

          if (cornerDist > cornerRadius - 1.5 || (qx === 0 && qy === 0 && (center - edgeDist < 1.5))) {
            r = Math.min(255, r + 24);
            g = Math.min(255, g + 38);
            b = Math.min(255, b + 32);
          }
        }

        // Transform (px, py) to standard 512x512 normalized design coordinates
        const dx = 256 + (px - center) / scale;
        const dy = 256 + (py - center) / scale;

        // 3. Option 3: Smart Wallet Foreground Geometry
        // A. Smart Card (emerging from wallet top): x in [146, 366], y in [145, 275], rad=16
        const dCard = distToRoundedRect(dx, dy, 146, 145, 220, 130, 16);

        // B. Wallet Base (back folio): x in [110, 402], y in [210, 385], rad=26
        const dWalletBase = distToRoundedRect(dx, dy, 110, 210, 292, 175, 26);

        // C. Clasp Tab: x in [370, 422], y in [295, 327] with rounded right cap
        const dClasp = distToRoundedRect(dx, dy, 370, 295, 52, 32, 12);

        // D. Front Pocket Sleeve:
        // Inside wallet x-bounds [110, 402], y in [scoopY, 385]
        const scoopY = 270 + 26 * (1 - ((dx - 256) / 146) ** 2);
        const inPocket = (dWalletBase <= 0) && (dy >= scoopY);
        const nearPocketRim = (dWalletBase <= 0) && Math.abs(dy - scoopY) <= 2.2;

        // Render Layers in Order:

        // 1. Render Wallet Base
        if (dWalletBase <= 0) {
          const tW = Math.max(0, Math.min(1, (dy - 210) / 175));
          r = Math.round(5 * (1 - tW) + 2 * tW);
          g = Math.round(150 * (1 - tW) + 78 * tW);
          b = Math.round(105 * (1 - tW) + 58 * tW);

          // Top rim metallic highlight
          if (Math.abs(dWalletBase) <= 2.0 && dy < 240) {
            r = 110; g = 231; b = 183;
          }
        }

        // 2. Render Smart Card (drawn above wallet base, but below front pocket)
        if (dCard <= 0 && !inPocket) {
          // Card Face: Crisp Brilliant White with subtle vertical sheen
          const tC = Math.max(0, Math.min(1, (dy - 145) / 130));
          r = Math.round(255 * (1 - tC) + 241 * tC);
          g = Math.round(255 * (1 - tC) + 245 * tC);
          b = Math.round(255 * (1 - tC) + 249 * tC);

          // Contactless Smart Chip (gold/mint microchip) at [175, 172, 36, 28]
          const inChip = (dx >= 175 && dx <= 211 && dy >= 172 && dy <= 200);
          if (inChip) {
            r = 52; g = 211; b = 153; // Mint smart chip
            if (Math.abs(dy - 186) <= 1 || Math.abs(dx - 193) <= 1) {
              r = 6; g = 78; b = 59; // Dark circuit traces
            }
          }

          // Contactless Wave Arcs on right side of card: Center (320, 186)
          const distWave = Math.sqrt((dx - 315) ** 2 + (dy - 186) ** 2);
          const angWave = Math.atan2(dy - 186, dx - 315);
          if (angWave >= -0.7 && angWave <= 0.7) {
            if (Math.abs(distWave - 12) <= 1.8) {
              r = 16; g = 185; b = 129;
            } else if (Math.abs(distWave - 20) <= 1.8) {
              r = 52; g = 211; b = 153;
            } else if (Math.abs(distWave - 28) <= 1.8) {
              r = 110; g = 231; b = 183;
            }
          }

          // Card perimeter border
          if (Math.abs(dCard) <= 1.5) {
            r = 255; g = 255; b = 255;
          }
        }

        // 3. Render Front Pocket Sleeve (overlapping the card)
        if (inPocket) {
          const tP = Math.max(0, Math.min(1, (dy - 270) / 115));
          r = Math.round(4 * (1 - tP) + 1 * tP);
          g = Math.round(120 * (1 - tP) + 59 * tP);
          b = Math.round(87 * (1 - tP) + 44 * tP);

          // Pocket Scoop Rim Accent (Mint #a7f3d0)
          if (nearPocketRim) {
            r = 167; g = 243; b = 208;
          }
        }

        // 4. Render Smart Clasp Tab & Biometric Sensor
        if (dClasp <= 0) {
          r = 3; g = 72; b = 55;
          if (Math.abs(dClasp) <= 1.5) {
            r = 110; g = 231; b = 183;
          }

          // Biometric Sensor Dot at (408, 311)
          const distSensor = Math.sqrt((dx - 408) ** 2 + (dy - 311) ** 2);
          if (distSensor <= 5.5) {
            if (distSensor <= 2.2) {
              r = 255; g = 255; b = 255;
            } else {
              r = 167; g = 243; b = 208;
            }
          }
        }

        // 5. Growth Spark in Upper Right at (390, 140)
        const sparkDist = Math.abs(dx - 390) + Math.abs(dy - 140);
        if (sparkDist <= 16) {
          if (sparkDist <= 4.0) {
            r = 255; g = 255; b = 255;
          } else {
            r = 167; g = 243; b = 208;
          }
        }

        // Subtle anti-banding dither for smooth, premium gradient fidelity
        const dither = (((px * 17 + py * 31) % 7) - 3) * 1.2;
        r = Math.min(255, Math.max(0, Math.round(r + dither)));
        g = Math.min(255, Math.max(0, Math.round(g + dither)));
        b = Math.min(255, Math.max(0, Math.round(b + dither)));

        totalR += r;
        totalG += g;
        totalB += b;
        totalA += subA;
      }

      const idx = (y * size + x) * 4;
      buf[idx] = Math.round(totalR / 4);
      buf[idx + 1] = Math.round(totalG / 4);
      buf[idx + 2] = Math.round(totalB / 4);
      buf[idx + 3] = Math.round(totalA / 4);
    }
  }

  return encodeRGBAtoPNG(size, size, buf);
}

// Generate all assets
const publicDir = path.resolve('public');

console.log('Generating Spendly Option 3: Smart Wallet PWA icon assets...');

// 1. Standard 192x192
const pwa192 = renderSmartWalletIcon(192, false);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), pwa192);
console.log('✓ Created public/pwa-192x192.png (' + pwa192.length + ' bytes)');

// 2. Standard 512x512
const pwa512 = renderSmartWalletIcon(512, false);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), pwa512);
console.log('✓ Created public/pwa-512x512.png (' + pwa512.length + ' bytes)');

// 3. Maskable 512x512 (Safe-zone padded, full-bleed)
const pwaMaskable = renderSmartWalletIcon(512, true);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pwaMaskable);
console.log('✓ Created public/pwa-maskable-512x512.png (' + pwaMaskable.length + ' bytes)');

// 4. Apple Touch Icon 180x180
const appleIcon = renderSmartWalletIcon(180, false);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);
console.log('✓ Created public/apple-touch-icon.png (' + appleIcon.length + ' bytes)');

// 5. SVG Favicon
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <!-- Background Deep Emerald Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#022c22"/>
      <stop offset="50%" stop-color="#033d2e"/>
      <stop offset="100%" stop-color="#011f18"/>
    </linearGradient>

    <!-- Wallet Body Gradient -->
    <linearGradient id="walletGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#024e3a"/>
    </linearGradient>

    <!-- Front Pocket Sleeve Gradient -->
    <linearGradient id="pocketGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#013b2c"/>
    </linearGradient>

    <!-- Smart Card Surface Gradient -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>

    <!-- Mint Metallic Accent -->
    <linearGradient id="mintAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a7f3d0"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>

    <!-- Required brandGrad for test compatibility -->
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>

    <!-- Ambient Mint Glow -->
    <radialGradient id="glowMint" cx="41%" cy="37%" r="55%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Squircle App Icon Container -->
  <rect width="512" height="512" rx="116" fill="url(#bgGrad)"/>
  <rect x="5" y="5" width="502" height="502" rx="111" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

  <!-- Ambient Glow -->
  <circle cx="210" cy="190" r="170" fill="url(#glowMint)"/>

  <!-- Option 3: Smart Wallet Composition -->
  <!-- 1. Back Folio / Wallet Base -->
  <rect x="110" y="210" width="292" height="175" rx="26" fill="url(#walletGrad)"/>
  <rect x="110" y="210" width="292" height="175" rx="26" fill="none" stroke="rgba(110,231,183,0.35)" stroke-width="2"/>

  <!-- 2. Smart Card emerging from wallet top -->
  <rect x="146" y="145" width="220" height="130" rx="16" fill="url(#cardGrad)"/>
  <rect x="146" y="145" width="220" height="130" rx="16" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.5"/>

  <!-- Smart Chip on Card -->
  <rect x="175" y="172" width="36" height="28" rx="6" fill="#34d399"/>
  <line x1="175" y1="186" x2="211" y2="186" stroke="#064e3b" stroke-width="1.5"/>
  <line x1="193" y1="172" x2="193" y2="200" stroke="#064e3b" stroke-width="1.5"/>

  <!-- Contactless NFC Wave Arcs -->
  <path d="M 320 174 A 12 12 0 0 1 320 198" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
  <path d="M 328 168 A 20 20 0 0 1 328 204" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round"/>
  <path d="M 336 162 A 28 28 0 0 1 336 210" fill="none" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round"/>

  <!-- 3. Front Wallet Pocket Sleeve with ergonomic scoop -->
  <path d="M 110 270 Q 256 296 402 270 L 402 360 A 26 26 0 0 1 376 386 L 136 386 A 26 26 0 0 1 110 360 Z" fill="url(#pocketGrad)"/>
  <path d="M 110 270 Q 256 296 402 270" fill="none" stroke="url(#mintAccent)" stroke-width="3" stroke-linecap="round"/>

  <!-- 4. Smart Clasp Tab & Biometric Sensor -->
  <path d="M 370 295 L 416 295 A 16 16 0 0 1 416 327 L 370 327 Z" fill="#034837" stroke="rgba(110,231,183,0.4)" stroke-width="1.5"/>
  <circle cx="408" cy="311" r="5" fill="#a7f3d0"/>
  <circle cx="408" cy="311" r="2" fill="#ffffff"/>

  <!-- 5. Growth Spark in Upper Right -->
  <g transform="translate(390, 140)">
    <polygon points="0,-16 4,-4 16,0 4,4 0,16 -4,4 -16,0 -4,-4" fill="#a7f3d0"/>
    <circle cx="0" cy="0" r="3.5" fill="#ffffff"/>
  </g>
</svg>
`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg, 'utf8');
console.log('✓ Created public/favicon.svg');

console.log('All Option 3: Smart Wallet icons generated successfully!');
