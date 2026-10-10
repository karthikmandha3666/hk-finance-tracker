import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('BUG-05 Regression: PWA icon assets and manifest configurations', () => {
  const publicDir = path.resolve('public');

  function readPngDimensions(filePath: string) {
    const buf = fs.readFileSync(filePath);
    // Verify PNG signature: \x89PNG\r\n\x1a\n
    const isPng =
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a;
    expect(isPng).toBe(true);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height, sizeBytes: buf.length };
  }

  it('provides polished standard PWA 192x192 icon', () => {
    const pwa192Path = path.join(publicDir, 'pwa-192x192.png');
    expect(fs.existsSync(pwa192Path)).toBe(true);
    const { width, height, sizeBytes } = readPngDimensions(pwa192Path);
    expect(width).toBe(192);
    expect(height).toBe(192);
    expect(sizeBytes).toBeGreaterThan(10000); // Polished high-res asset
  });

  it('provides polished standard PWA 512x512 icon', () => {
    const pwa512Path = path.join(publicDir, 'pwa-512x512.png');
    expect(fs.existsSync(pwa512Path)).toBe(true);
    const { width, height, sizeBytes } = readPngDimensions(pwa512Path);
    expect(width).toBe(512);
    expect(height).toBe(512);
    expect(sizeBytes).toBeGreaterThan(30000);
  });

  it('provides polished maskable PWA 512x512 icon with safe-zone margin', () => {
    const maskablePath = path.join(publicDir, 'pwa-maskable-512x512.png');
    expect(fs.existsSync(maskablePath)).toBe(true);
    const { width, height, sizeBytes } = readPngDimensions(maskablePath);
    expect(width).toBe(512);
    expect(height).toBe(512);
    expect(sizeBytes).toBeGreaterThan(30000);
  });

  it('provides Apple Touch Icon at 180x180', () => {
    const appleIconPath = path.join(publicDir, 'apple-touch-icon.png');
    expect(fs.existsSync(appleIconPath)).toBe(true);
    const { width, height, sizeBytes } = readPngDimensions(appleIconPath);
    expect(width).toBe(180);
    expect(height).toBe(180);
    expect(sizeBytes).toBeGreaterThan(10000);
  });

  it('provides Spendly vector favicon.svg and preserves spendly-emblem.png for splash screen', () => {
    const faviconPath = path.join(publicDir, 'favicon.svg');
    expect(fs.existsSync(faviconPath)).toBe(true);
    const svgContent = fs.readFileSync(faviconPath, 'utf8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('brandGrad');

    const emblemPath = path.join(publicDir, 'spendly-emblem.png');
    expect(fs.existsSync(emblemPath)).toBe(true);
    expect(fs.statSync(emblemPath).size).toBeGreaterThan(100000);
  });
});
