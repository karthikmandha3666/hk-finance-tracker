import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateUUID } from './uuid';

describe('generateUUID cryptographic utility', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original global crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });

  const RFC4122_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('generates standard RFC 4122 version 4 compliant UUIDs in standard environment', () => {
    const id = generateUUID();
    expect(id).toMatch(RFC4122_V4_REGEX);
    expect(id.length).toBe(36);
  });

  it('generates 1,000 unique UUIDs without collision', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = generateUUID();
      expect(set.has(id)).toBe(false);
      set.add(id);
    }
    expect(set.size).toBe(1000);
  });

  it('falls back to crypto.getRandomValues when crypto.randomUUID is undefined (simulating non-secure HTTP context)', () => {
    // Simulate non-secure HTTP context where crypto.randomUUID is not exposed
    const mockGetRandomValues = vi.fn((buffer: Uint8Array) => {
      // Fill with test entropy
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = (i * 17 + 3) & 0xff;
      }
      return buffer;
    });

    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: mockGetRandomValues,
        randomUUID: undefined,
      },
      writable: true,
      configurable: true,
    });

    const fallbackId = generateUUID();
    expect(mockGetRandomValues).toHaveBeenCalledTimes(1);
    expect(fallbackId).toMatch(RFC4122_V4_REGEX);

    // Verify version 4 character at index 14
    expect(fallbackId[14]).toBe('4');
    // Verify variant bits [8, 9, a, b] at index 19
    expect(['8', '9', 'a', 'b']).toContain(fallbackId[19]);
  });

  it('correctly sets RFC 4122 v4 version (0x40) and variant (0x80) bits in fallback implementation', () => {
    // Test with extreme byte values: all 0s and all 1s
    const testZeroes = vi.fn((buf: Uint8Array) => {
      buf.fill(0x00);
      return buf;
    });

    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: testZeroes, randomUUID: undefined },
      writable: true,
      configurable: true,
    });

    const idFromZeroes = generateUUID();
    expect(idFromZeroes[14]).toBe('4');
    expect(idFromZeroes[19]).toBe('8'); // 0x00 | 0x80 = 0x80 -> '8'

    const testOnes = vi.fn((buf: Uint8Array) => {
      buf.fill(0xff);
      return buf;
    });

    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: testOnes, randomUUID: undefined },
      writable: true,
      configurable: true,
    });

    const idFromOnes = generateUUID();
    expect(idFromOnes[14]).toBe('4'); // 0xff & 0x0f | 0x40 = 0x4f -> '4'
    expect(idFromOnes[19]).toBe('b'); // 0xff & 0x3f | 0x80 = 0xbf -> 'b'
  });

  it('throws an explicit Error when neither crypto.randomUUID nor crypto.getRandomValues is available', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(() => generateUUID()).toThrow(
      'Cryptographically secure random number generator is unavailable in this environment.'
    );
  });
});
