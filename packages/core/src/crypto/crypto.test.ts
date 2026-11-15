import { generateKeyPair, type CryptoKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { firmarCredencial, verificarCredencial } from "./credential";
import { COBRO_PREFIJO, COBRO_TTL_SEGUNDOS, firmarCobro, leerCobro } from "./cobro-token";

let priv: CryptoKey;
let pub: CryptoKey;
let otraPriv: CryptoKey;

beforeAll(async () => {
  ({ privateKey: priv, publicKey: pub } = await generateKeyPair("EdDSA", { crv: "Ed25519" }));
  ({ privateKey: otraPriv } = await generateKeyPair("EdDSA", { crv: "Ed25519" }));
});

const resolver = async (id: string) => (id === "uttab" ? pub : null);
const T0 = new Date("2026-11-15T12:00:00Z");
const VENCE = new Date("2026-12-31T23:59:59Z");

describe("credencial firmada", () => {
  const input = {
    emisorId: "uttab",
    seudonimo: "ps_abc",
    credencialId: "cred-1",
    tipoBeneficiario: "estudiante",
    vigenteHasta: VENCE,
    ahora: T0,
  };

  it("verifica una firma válida", async () => {
    const jws = await firmarCredencial(input, priv);
    const r = await verificarCredencial(jws, resolver, { ahora: T0 });
    expect(r.ok && r.claims).toMatchObject({
      iss: "uttab",
      sub: "ps_abc",
      jti: "cred-1",
      tb: "estudiante",
    });
  });

  it("rechaza firma de otra llave", async () => {
    const jws = await firmarCredencial(input, otraPriv);
    expect(await verificarCredencial(jws, resolver, { ahora: T0 })).toEqual({
      ok: false,
      error: "firma_invalida",
    });
  });

  it("rechaza token alterado", async () => {
    const jws = await firmarCredencial(input, priv);
    const [h, p, s] = jws.split(".");
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString());
    payload.tb = "adulto_mayor";
    const alterado = `${h}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${s}`;
    expect((await verificarCredencial(alterado, resolver, { ahora: T0 })).ok).toBe(false);
  });

  it("rechaza emisor desconocido", async () => {
    const jws = await firmarCredencial({ ...input, emisorId: "pirata" }, priv);
    expect(await verificarCredencial(jws, resolver, { ahora: T0 })).toEqual({
      ok: false,
      error: "emisor_desconocido",
    });
  });

  it("rechaza credencial vencida", async () => {
    const jws = await firmarCredencial(input, priv);
    expect(
      await verificarCredencial(jws, resolver, { ahora: new Date("2027-01-02T00:00:00Z") }),
    ).toEqual({ ok: false, error: "expirado" });
  });

  it("rechaza basura", async () => {
    expect(await verificarCredencial("no.es.jws", resolver)).toEqual({
      ok: false,
      error: "formato_invalido",
    });
  });
});

describe("QR de cobro del comercio", () => {
  const secreto = new TextEncoder().encode("s".repeat(48));
  const otro = new TextEncoder().encode("x".repeat(48));
  const SID = "4f1c2b8e-1111-4222-8333-444455556666";
  const COM = "a0000000-0000-4000-8000-000000000001";
  const EXP = new Date(T0.getTime() + COBRO_TTL_SEGUNDOS * 1000);

  it("firma y lee una solicitud válida", async () => {
    const qr = await firmarCobro({ solicitudId: SID, comercioId: COM, expiraEn: EXP, ahora: T0 }, secreto);
    expect(qr.startsWith(COBRO_PREFIJO)).toBe(true);
    const r = await leerCobro(qr, secreto, { ahora: new Date(T0.getTime() + 60_000) });
    expect(r.ok && r.claims).toMatchObject({ sid: SID, com: COM });
  });

  it("rechaza QR expirado", async () => {
    const qr = await firmarCobro({ solicitudId: SID, comercioId: COM, expiraEn: EXP, ahora: T0 }, secreto);
    expect(await leerCobro(qr, secreto, { ahora: new Date(EXP.getTime() + 60_000) })).toEqual({ ok: false, error: "expirado" });
  });

  it("rechaza firma de otro secreto y QR alterado", async () => {
    const qr = await firmarCobro({ solicitudId: SID, comercioId: COM, expiraEn: EXP, ahora: T0 }, otro);
    expect(await leerCobro(qr, secreto, { ahora: T0 })).toEqual({ ok: false, error: "firma_invalida" });
    const bueno = await firmarCobro({ solicitudId: SID, comercioId: COM, expiraEn: EXP, ahora: T0 }, secreto);
    const [pre, h, p, s] = bueno.split(".");
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString());
    payload.com = "a0000000-0000-4000-8000-000000000002";
    const alterado = `${pre}.${h}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${s}`;
    expect((await leerCobro(alterado, secreto, { ahora: T0 })).ok).toBe(false);
  });

  it("rechaza contenido ajeno y TTL excesivo", async () => {
    expect(await leerCobro("https://ejemplo.com", secreto)).toEqual({ ok: false, error: "no_es_cobro" });
    const largo = await firmarCobro({ solicitudId: SID, comercioId: COM, expiraEn: new Date(T0.getTime() + 3_600_000), ahora: T0 }, secreto);
    expect(await leerCobro(largo, secreto, { ahora: T0 })).toEqual({ ok: false, error: "firma_invalida" });
  });

  it("el QR no contiene montos ni datos personales", async () => {
    const qr = await firmarCobro({ solicitudId: SID, comercioId: COM, expiraEn: EXP, ahora: T0 }, secreto);
    const payload = JSON.parse(Buffer.from(qr.split(".")[2]!, "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(["com", "exp", "iat", "sid", "typ"]);
  });
});
