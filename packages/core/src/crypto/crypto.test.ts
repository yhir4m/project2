import { generateKeyPair, type CryptoKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { firmarCredencial, verificarCredencial } from "./credential";
import {
  firmarQr,
  verificarQr,
  type CredencialEstado,
  type DependenciasVerificacionQr,
} from "./qr-token";
import { nonceAleatorio } from "./random";

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

describe("QR dinámico", () => {
  const DEV = "d".repeat(43);
  const cred: CredencialEstado = {
    id: "cred-1",
    emisor_id: "uttab",
    seudonimo: "ps_abc",
    estado: "activa",
    vigente_hasta: VENCE,
    dispositivo_hash: DEV,
  };

  function deps(
    over: Partial<CredencialEstado> = {},
    conConvenio = true,
  ): DependenciasVerificacionQr & { usados: Set<string> } {
    const usados = new Set<string>();
    return {
      usados,
      resolverLlave: resolver,
      obtenerCredencial: async (id) => (id === cred.id ? { ...cred, ...over } : null),
      buscarConvenio: async ({ comercioId }) =>
        conConvenio && comercioId === "com-1" ? { id: "conv-1", nombre: "UTTAB 10%" } : null,
      consumirNonce: async (n) => (usados.has(n) ? false : (usados.add(n), true)),
    };
  }

  const emitir = (ahora = T0, extra: Partial<Parameters<typeof firmarQr>[0]> = {}) =>
    firmarQr(
      {
        emisorId: "uttab",
        seudonimo: "ps_abc",
        credencialId: "cred-1",
        tipoBeneficiario: "estudiante",
        dispositivoHash: DEV,
        nonce: nonceAleatorio(),
        credencialVenceEn: VENCE,
        ahora,
        ...extra,
      },
      priv,
    );

  it("acepta un QR válido una sola vez (antirreplay)", async () => {
    const { token, exp } = await emitir();
    expect(exp - T0.getTime() / 1000).toBe(45);
    const d = deps();
    const r1 = await verificarQr(token, "com-1", d, { ahora: new Date(T0.getTime() + 10_000) });
    expect(r1.ok && r1.convenio.id).toBe("conv-1");
    const r2 = await verificarQr(token, "com-1", d, { ahora: new Date(T0.getTime() + 11_000) });
    expect(r2).toEqual({ ok: false, error: "qr_ya_usado" });
  });

  it("rechaza QR expirado", async () => {
    const { token } = await emitir();
    expect(
      await verificarQr(token, "com-1", deps(), { ahora: new Date(T0.getTime() + 60_000) }),
    ).toEqual({ ok: false, error: "expirado" });
  });

  it("rechaza credencial revocada", async () => {
    const { token } = await emitir();
    expect(await verificarQr(token, "com-1", deps({ estado: "revocada" }), { ahora: T0 })).toEqual({
      ok: false,
      error: "credencial_revocada",
    });
  });

  it("rechaza credencial vencida en BD aunque el QR sea vigente", async () => {
    const { token } = await emitir();
    expect(
      await verificarQr(token, "com-1", deps({ vigente_hasta: new Date(T0.getTime() - 1) }), {
        ahora: T0,
      }),
    ).toEqual({ ok: false, error: "credencial_vencida" });
  });

  it("rechaza QR de otro dispositivo", async () => {
    const { token } = await emitir(T0, { dispositivoHash: "x".repeat(43) });
    expect(await verificarQr(token, "com-1", deps(), { ahora: T0 })).toEqual({
      ok: false,
      error: "dispositivo_no_coincide",
    });
  });

  it("rechaza comercio sin convenio y NO quema el nonce", async () => {
    const { token } = await emitir();
    const d = deps({}, false);
    expect(await verificarQr(token, "com-2", d, { ahora: T0 })).toEqual({
      ok: false,
      error: "sin_convenio",
    });
    expect(d.usados.size).toBe(0);
  });

  it("rechaza firma inválida y contenido ajeno", async () => {
    const { token } = await firmarQr(
      {
        emisorId: "uttab",
        seudonimo: "ps_abc",
        credencialId: "cred-1",
        tipoBeneficiario: "estudiante",
        dispositivoHash: DEV,
        nonce: nonceAleatorio(),
        credencialVenceEn: VENCE,
        ahora: T0,
      },
      otraPriv,
    );
    expect(await verificarQr(token, "com-1", deps(), { ahora: T0 })).toEqual({
      ok: false,
      error: "firma_invalida",
    });
    expect(await verificarQr("https://example.com", "com-1", deps())).toEqual({
      ok: false,
      error: "no_es_qr_del_sistema",
    });
  });

  it("rechaza QR con TTL mayor al permitido", async () => {
    const { token } = await emitir(T0, { ttlSeg: 3600 });
    expect(await verificarQr(token, "com-1", deps(), { ahora: T0 })).toEqual({
      ok: false,
      error: "formato_invalido",
    });
  });

  it("el QR no vive más que la credencial", async () => {
    const { exp } = await emitir(T0, { credencialVenceEn: new Date(T0.getTime() + 10_000) });
    expect(exp).toBe(T0.getTime() / 1000 + 10);
  });

  it("el QR no contiene datos personales", async () => {
    const { token } = await emitir();
    const payload = JSON.parse(Buffer.from(token.split(".")[2]!, "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual([
      "cid",
      "dev",
      "exp",
      "iat",
      "iss",
      "jti",
      "sub",
      "tb",
      "typ",
    ]);
  });
});
