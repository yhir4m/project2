/** Utilidades de aleatoriedad y hash basadas en WebCrypto (disponible en Node ≥ 20, navegadores y Expo con polyfill). */

export function nonceAleatorio(bytes = 16): string {
  const b = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(b);
  return base64url(b);
}

export async function sha256Base64url(texto: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return base64url(new Uint8Array(digest));
}

export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
