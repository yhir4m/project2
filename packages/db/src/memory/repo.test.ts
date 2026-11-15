import { describe, expect, it } from "vitest";
import { RepositorioMemoria } from "./repo";
import { IDS } from "./seed";

const CRED_ANA = "10000000-0000-4000-8000-000000000001";
const ahora = () => new Date("2026-11-15T18:00:00Z");

function nuevaTx(repo: RepositorioMemoria, key: string, descuento = 1000) {
  return repo.crearTransaccion({
    idempotency_key: key,
    comercio_id: IDS.comercios.papeleria,
    credencial_id: CRED_ANA,
    convenio_id: IDS.convenios.uttab10,
    compra: { tipo: "monto", monto_centavos: 10_000 },
    precio_original_centavos: 10_000,
    descuento_centavos: descuento,
    monto_final_centavos: 10_000 - descuento,
    monto_cobrado_centavos: 10,
    metodo: "codi",
    canal: "pn",
    modo_prueba: true,
  });
}

describe("RepositorioMemoria", () => {
  it("busca convenio por emisor, tipo y comercio", async () => {
    const r = new RepositorioMemoria(ahora);
    expect(
      (
        await r.buscarConvenio({
          emisorId: "uttab",
          tipoBeneficiario: "estudiante",
          comercioId: IDS.comercios.papeleria,
        })
      )?.id,
    ).toBe(IDS.convenios.uttab10);
    expect(
      await r
        .buscarConvenio({
          emisorId: "uttab",
          tipoBeneficiario: "estudiante",
          comercioId: IDS.comercios.cafe,
        })
        .then((c) => c?.id),
    ).toBe(IDS.convenios.uttabCafe);
    expect(
      await r.buscarConvenio({
        emisorId: "inapam",
        tipoBeneficiario: "adulto_mayor",
        comercioId: IDS.comercios.papeleria,
      }),
    ).toBeNull();
  });

  it("nonce de un solo uso", async () => {
    const r = new RepositorioMemoria(ahora);
    expect(await r.consumirNonce("n1", new Date("2026-11-15T18:00:45Z"))).toBe(true);
    expect(await r.consumirNonce("n1", new Date("2026-11-15T18:00:45Z"))).toBe(false);
  });

  it("transacción idempotente por llave y emite cambios", async () => {
    const r = new RepositorioMemoria(ahora);
    const vistos: string[] = [];
    r.suscribir((c) => vistos.push(c.tabla));
    const a = await nuevaTx(r, "k1");
    const b = await nuevaTx(r, "k1");
    expect(a.creada).toBe(true);
    expect(b.creada).toBe(false);
    expect(b.transaccion.id).toBe(a.transaccion.id);
    expect(vistos).toEqual(["transacciones"]);
  });

  it("transición condicionada al estado actual", async () => {
    const r = new RepositorioMemoria(ahora);
    const { transaccion } = await nuevaTx(r, "k2");
    expect(
      await r.transicionarTransaccion(transaccion.id, ["pendiente"], { estado: "pagada" }),
    ).toBeNull();
    expect(
      (await r.transicionarTransaccion(transaccion.id, ["creando"], { estado: "pendiente" }))
        ?.estado,
    ).toBe("pendiente");
  });

  it("cuenta usos del día solo con descuento y estados vivos", async () => {
    const r = new RepositorioMemoria(ahora);
    await nuevaTx(r, "a");
    await nuevaTx(r, "b", 0);
    const { transaccion } = await nuevaTx(r, "c");
    await r.transicionarTransaccion(transaccion.id, ["creando"], { estado: "fallida" });
    expect(await r.usosHoy(CRED_ANA, IDS.convenios.uttab10)).toBe(1);
  });

  it("webhook duplicado se detecta", async () => {
    const r = new RepositorioMemoria(ahora);
    expect(await r.registrarWebhook({ id: "msg_1", tipo: "x", payload: {} })).toBe(true);
    expect(await r.registrarWebhook({ id: "msg_1", tipo: "x", payload: {} })).toBe(false);
  });

  it("una sola credencial activa por emisor y tipo", async () => {
    const r = new RepositorioMemoria(ahora);
    await expect(
      r.crearCredencial({
        usuario_id: IDS.usuarios.ana,
        emisor_id: "uttab",
        tipo_beneficiario: "estudiante",
        verificacion_id: null,
        vigente_hasta: new Date("2027-01-01"),
      }),
    ).rejects.toThrow();
  });

  it("verificación resuelta no conserva documento", async () => {
    const r = new RepositorioMemoria(ahora);
    const v = await r.crearVerificacion({
      usuario_id: IDS.usuarios.luis,
      emisor_id: "uttab",
      tipo_beneficiario: "estudiante",
      metodo: "documento_ia",
      estado: "revision_manual",
      confianza: 0.5,
      nombre_declarado: "Luis X",
      documento_path: "x/y.jpg",
    });
    await expect(r.actualizarVerificacion(v.id, { estado: "aprobada" })).rejects.toThrow();
    expect(
      (
        await r.actualizarVerificacion(v.id, {
          estado: "aprobada",
          documento_path: null,
          nombre_declarado: null,
        })
      ).estado,
    ).toBe("aprobada");
  });

  it("devuelve copias (no se puede mutar el estado interno)", async () => {
    const r = new RepositorioMemoria(ahora);
    const c = await r.credencial(CRED_ANA);
    c!.estado = "revocada";
    expect((await r.credencial(CRED_ANA))!.estado).toBe("activa");
  });
});
