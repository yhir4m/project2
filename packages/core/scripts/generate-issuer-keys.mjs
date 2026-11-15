// Genera un par de llaves Ed25519 para un emisor.
// Uso: pnpm keys:generate -- uttab inapam
// Imprime las líneas para .env.local. La privada NUNCA se sube al repo.
import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";

const ids = process.argv.slice(2).filter((a) => a !== "--");
if (ids.length === 0) ids.push("demo");

for (const id of ids) {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });
  const priv = Buffer.from(await exportPKCS8(privateKey)).toString("base64");
  const pub = Buffer.from(await exportSPKI(publicKey)).toString("base64");
  const env = id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  console.log(`ISSUER_${env}_PRIVATE_KEY=${priv}`);
  console.log(`ISSUER_${env}_PUBLIC_KEY=${pub}`);
}
