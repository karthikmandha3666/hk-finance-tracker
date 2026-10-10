/**
 * Cryptographically secure RFC 4122 version 4 UUID generator.
 * 
 * Supports:
 * - Secure Contexts (HTTPS / localhost): uses native crypto.randomUUID()
 * - Non-secure HTTP / LAN Contexts: uses crypto.getRandomValues() with RFC 4122 v4 bit formatting
 * 
 * Insecure fallbacks (Math.random, timestamps) are strictly prohibited.
 * Throws an explicit Error if no cryptographically secure entropy source is available.
 */
export function generateUUID(): string {
  // Fast path: native crypto.randomUUID (available in Secure Contexts)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Secure fallback: crypto.getRandomValues (available in non-secure HTTP contexts across all modern browsers)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version to 4: byte 6 high nibble = 0100 (0x40)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant to RFC 4122: byte 8 high 2 bits = 10 (0x80)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return (
      hex.slice(0, 4).join('') +
      '-' +
      hex.slice(4, 6).join('') +
      '-' +
      hex.slice(6, 8).join('') +
      '-' +
      hex.slice(8, 10).join('') +
      '-' +
      hex.slice(10, 16).join('')
    );
  }

  throw new Error('Cryptographically secure random number generator is unavailable in this environment.');
}
