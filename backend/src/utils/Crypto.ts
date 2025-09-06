import crypto from "crypto";

/**
 * Compute SHA256 hex of a Buffer.
 */
export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Convert a 64-hex sha256 string to Ethereum bytes32 (0x-prefixed, padded).
 */
export function toBytes32(hex: string): string {
  let h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]*$/.test(h)) throw new Error("Non-hex characters in hash");
  if (h.length > 64) h = h.slice(h.length - 64);
  if (h.length < 64) h = h.padStart(64, "0");
  return "0x" + h.toLowerCase();
}
