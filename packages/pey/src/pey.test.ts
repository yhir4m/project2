import { Webhook } from "standardwebhooks";
import { describe, expect, it, vi } from "vitest";
import { PeyClient, PeyError } from "./client";
import type { TransaccionPey } from "./schemas";
import { confirmarPago, verificarWebhook } from "./webhooks";

const SECRETO = "whsec_" + Buffer.from("secreto-de-prueba-32-bytes-12345").toString("base64");

function firmar(body: string, id = "msg_1", fecha = new Date()) {
  const firma = new Webhook(SECRETO).sign(id, fecha, body);
  return {
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(fecha.getTime() / 1000)),
    "webhook-signature": firma,
  };
}

const eventoPn = {
  type: "codi.pn.payment_received",
  transactionId: "01M3QR5E7XHXMNZDEPFH3JAWS0",
  amount: 0.1,
  apiKeyId: "01M3QMMR6X9CBVDY1SF3G8QWNW",
  concept: "Descuento UTTAB",
  datePaid: 1790724758,
  numRef: "4567",
  metadata: { trackingKey: "0192191042", externalMetadata: { txId: "tx-1" } },
};

describe("verificarWebhook", () => {
  it("acepta firma válida sobre el cuerpo crudo", () => {
    const body = JSON.stringify(eventoPn);
    const r = verificarWebhook(body, new Headers(firmar(body)), SECRETO);
    expect(r.ok && r.evento?.transactionId).toBe(eventoPn.transactionId);
    expect(r.ok && r.webhookId).toBe("msg_1");
  });

  it("rechaza firma inválida (otro secreto)", () => {
    const body = JSON.stringify(eventoPn);
    const otro = "whsec_" + Buffer.from("otro-secreto-distinto-32-bytes-x").toString("base64");
    expect(verificarWebhook(body, firmar(body), otro)).toEqual({
      ok: false,
      error: "firma_invalida",
    });
  });

  it("rechaza cuerpo alterado (aunque sea el mismo JSON re-serializado)", () => {
    const body = JSON.stringify(eventoPn);
    const h = firmar(body);
    expect(verificarWebhook(JSON.stringify({ ...eventoPn, amount: 999 }), h, SECRETO).ok).toBe(
      false,
    );
    expect(verificarWebhook(JSON.stringify(eventoPn, null, 2), h, SECRETO).ok).toBe(false);
  });

  it("rechaza timestamps viejos (replay)", () => {
    const body = JSON.stringify(eventoPn);
    expect(
      verificarWebhook(body, firmar(body, "msg_1", new Date(Date.now() - 60 * 60 * 1000)), SECRETO)
        .ok,
    ).toBe(false);
  });

  it("rechaza si faltan encabezados", () => {
    expect(verificarWebhook("{}", {}, SECRETO)).toEqual({ ok: false, error: "faltan_encabezados" });
  });

  it("ignora (pero acepta) eventos de otros tipos", () => {
    const body = JSON.stringify({ type: "bank_account.updated", id: "x" });
    expect(verificarWebhook(body, firmar(body), SECRETO)).toEqual({
      ok: true,
      webhookId: "msg_1",
      evento: null,
      tipo: "bank_account.updated",
    });
  });

  it("rechaza payload malformado aunque esté firmado", () => {
    const body = JSON.stringify({ type: "codi.qr.payment_received", amount: 1 });
    expect(verificarWebhook(body, firmar(body), SECRETO)).toEqual({
      ok: false,
      error: "payload_invalido",
    });
  });
});

describe("confirmarPago", () => {
  const tx: TransaccionPey = {
    id: "01M3",
    status: "PAID",
    amount: 0.1,
    currency: "MXN",
    paymentMethod: "CODI",
    payableType: "API_CODI_PN",
    metadata: { externalMetadata: { txId: "tx-1" } },
  };
  const esperado = { montoCentavos: 10, txId: "tx-1", canal: "pn" as const };

  it("confirma pago correcto", () =>
    expect(confirmarPago(tx, esperado)).toEqual({ ok: true, montoCentavos: 10 }));
  it("rechaza PENDING", () =>
    expect(confirmarPago({ ...tx, status: "PENDING" }, esperado)).toEqual({
      ok: false,
      error: "no_pagada",
    }));
  it("rechaza monto que no coincide", () =>
    expect(confirmarPago({ ...tx, amount: 0.01 }, esperado)).toEqual({
      ok: false,
      error: "monto_no_coincide",
    }));
  it("usa la base cuando el total incluye comisión", () =>
    expect(
      confirmarPago(
        { ...tx, amount: 102.5, amountBreakdown: { base: 100, fee: 2.5 } },
        { ...esperado, montoCentavos: 10_000 },
      ).ok,
    ).toBe(true));
  it("rechaza referencia de otra transacción", () =>
    expect(
      confirmarPago({ ...tx, metadata: { externalMetadata: { txId: "tx-2" } } }, esperado),
    ).toEqual({ ok: false, error: "referencia_no_coincide" }));
  it("rechaza canal distinto", () =>
    expect(confirmarPago(tx, { ...esperado, canal: "qr" })).toEqual({
      ok: false,
      error: "metodo_incorrecto",
    }));
  it("evita errores de flotante (0.1 + 0.2)", () =>
    expect(confirmarPago({ ...tx, amount: 0.1 + 0.2 }, { ...esperado, montoCentavos: 30 }).ok).toBe(
      true,
    ));
});

describe("PeyClient", () => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("envía Bearer y valida el body", async () => {
    const f = vi.fn().mockResolvedValue(json(200, { transactionId: "t1", codiId: "1".repeat(20) }));
    const c = new PeyClient({ apiKey: "k", fetch: f });
    await expect(
      c.crearPushNotification({
        amount: 0.1,
        phoneNumber: "9931234567",
        metadata: { txId: "tx-1" },
      }),
    ).resolves.toMatchObject({ transactionId: "t1" });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.pey.mx/codi/pn");
    expect(init.headers.Authorization).toBe("Bearer k");
    expect(JSON.parse(init.body)).toMatchObject({ amount: 0.1, phoneNumber: "9931234567" });
  });

  it("valida localmente antes de llamar (celular y expiración mínima)", async () => {
    const f = vi.fn();
    const c = new PeyClient({ apiKey: "k", fetch: f });
    expect(() => c.crearPushNotification({ amount: 1, phoneNumber: "123" })).toThrow();
    expect(() =>
      c.crearPushNotification({ amount: 1, phoneNumber: "9931234567", expiration: 45 }),
    ).toThrow();
    expect(() => c.crearQr({ amount: 0 })).toThrow();
    expect(f).not.toHaveBeenCalled();
  });

  it("NUNCA reintenta un POST y lo marca incierto ante 500", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        json(500, { error: { message: "boom", type: "INTERNAL_SERVER_ERROR", requestId: "r1" } }),
      );
    const c = new PeyClient({ apiKey: "k", fetch: f });
    const e = await c.crearQr({ amount: 1 }).catch((x) => x);
    expect(e).toBeInstanceOf(PeyError);
    expect(e).toMatchObject({
      status: 500,
      tipo: "INTERNAL_SERVER_ERROR",
      requestId: "r1",
      incierto: true,
    });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("error 400 no es incierto", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        json(400, { error: { message: "Amount must be...", type: "INVALID_AMOUNT" } }),
      );
    const e = await new PeyClient({ apiKey: "k", fetch: f }).crearQr({ amount: 1 }).catch((x) => x);
    expect(e).toMatchObject({ status: 400, tipo: "INVALID_AMOUNT", incierto: false });
  });

  it("reintenta GET ante 503", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(503, { error: { type: "SERVICE_UNAVAILABLE" } }))
      .mockResolvedValueOnce(json(200, { id: "t1", status: "PAID", amount: 1 }));
    await expect(
      new PeyClient({ apiKey: "k", fetch: f }).obtenerTransaccion("t1"),
    ).resolves.toMatchObject({ status: "PAID" });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("busca por txId paginando", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        json(200, { items: [{ id: "a", status: "PAID", amount: 1 }], nextToken: "n1" }),
      )
      .mockResolvedValueOnce(
        json(200, {
          items: [
            {
              id: "b",
              status: "PENDING",
              amount: 1,
              metadata: { externalMetadata: { txId: "tx-9" } },
            },
          ],
          nextToken: null,
        }),
      );
    const r = await new PeyClient({ apiKey: "k", fetch: f }).buscarPorTxId("tx-9");
    expect(r?.id).toBe("b");
    expect(f.mock.calls[1]![0]).toBe("https://api.pey.mx/transaction/api-key?nextToken=n1");
  });
});

describe("PeySimulado", () => {
  it("autorizar envía un webhook firmado que pasa la verificación real", async () => {
    const { PeySimulado } = await import("./simulado");
    let recibido: ReturnType<typeof verificarWebhook> | null = null;
    const sim = new PeySimulado(SECRETO, async (body, headers) => {
      recibido = verificarWebhook(body, headers, SECRETO);
    });
    const r = await sim.crearPushNotification({
      amount: 0.1,
      phoneNumber: "9931234567",
      metadata: { txId: "tx-1" },
    });
    expect((await sim.obtenerTransaccion(r.transactionId)).status).toBe("PENDING");
    await sim.autorizar({ transactionId: r.transactionId });
    expect(recibido).toMatchObject({
      ok: true,
      evento: { type: "codi.pn.payment_received", transactionId: r.transactionId },
    });
    const tx = await sim.obtenerTransaccion(r.transactionId);
    expect(confirmarPago(tx, { montoCentavos: 10, txId: "tx-1", canal: "pn" })).toEqual({
      ok: true,
      montoCentavos: 10,
    });
  });

  it("valida igual que Pey", async () => {
    const { PeySimulado } = await import("./simulado");
    const sim = new PeySimulado(SECRETO, async () => {});
    await expect(sim.crearPushNotification({ amount: 1, phoneNumber: "12" })).rejects.toThrow();
  });
});
