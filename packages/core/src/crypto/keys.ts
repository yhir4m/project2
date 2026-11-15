import { importPKCS8, importSPKI, type CryptoKey } from "jose";

export const ALG = "EdDSA" as const;

/** Decodifica base64 a texto PEM (las llaves se guardan en env como base64 de PEM para evitar saltos de línea). */
function b64ToPem(b64OrPem: string): string {
  const v = b64OrPem.trim();
  if (v.startsWith("-----BEGIN")) return v;
  return atob(v);
}

export async function importarLlavePrivada(b64OrPem: string): Promise<CryptoKey> {
  return importPKCS8(b64ToPem(b64OrPem), ALG);
}

export async function importarLlavePublica(b64OrPem: string): Promise<CryptoKey> {
  return importSPKI(b64ToPem(b64OrPem), ALG);
}

/** Resuelve la llave pública de un emisor por su id (`iss`). Lo implementa el servidor (env o BD). */
export type ResolverLlavePublica = (emisorId: string) => Promise<CryptoKey | null>;
