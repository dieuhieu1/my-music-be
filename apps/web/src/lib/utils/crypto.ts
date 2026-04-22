// AES-256-CBC client-side decrypt for premium downloaded .enc files.
// Key and IV are delivered inside licenseJwt — no extra round-trip needed.

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  const buf   = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function parseJwtPayload(jwt: string): Record<string, unknown> {
  const segment = jwt.split('.')[1];
  if (!segment) throw new Error('Invalid license JWT format.');
  // base64url → base64
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
  try {
    return JSON.parse(atob(padded));
  } catch {
    throw new Error('Invalid download license — please try again.');
  }
}

/**
 * Decrypt a premium .enc file using AES-256-CBC.
 * @param encryptedBuffer  Raw ArrayBuffer of the .enc file
 * @param licenseJwt       JWT from POST /songs/:id/download; payload must contain
 *                         `encryptedKey` (base64 AES key) and `iv` (hex string)
 */
export async function decryptSong(
  encryptedBuffer: ArrayBuffer,
  licenseJwt: string,
): Promise<ArrayBuffer> {
  if (!window.crypto?.subtle) {
    throw new Error('Decryption requires HTTPS. Please use a secure connection.');
  }

  const payload = parseJwtPayload(licenseJwt);
  const aesKeyB64 = payload.encryptedKey as string | undefined;
  const ivHex     = payload.iv            as string | undefined;

  if (!aesKeyB64 || !ivHex) {
    throw new Error('Invalid download license — key or IV missing.');
  }

  const keyBuf  = base64ToArrayBuffer(aesKeyB64);
  const ivBytes = hexToUint8Array(ivHex);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  );

  return window.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: ivBytes },
    cryptoKey,
    encryptedBuffer,
  );
}

/** Convert a decrypted ArrayBuffer to a Blob and trigger a browser save dialog. */
export function triggerBlobDownload(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'audio/mpeg' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
