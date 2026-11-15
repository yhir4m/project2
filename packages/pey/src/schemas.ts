import { z } from "zod";

/**
 * Esquemas tomados de la OpenAPI de Pey 2026-10-20 (ver docs/PEY.md).
 * `.passthrough()` en respuestas: Pey puede agregar campos sin romper el cliente.
 */

const NumRef = z.string().regex(/^[0-9]{1,7}$/);
/** Metadata de entrada: ≤50 pares, llave ≤40, valor escalar ≤500. */
export const MetadataEntradaSchema = z
  .record(
    z.string().min(1).max(40),
    z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
  )
  .refine((m) => Object.keys(m).length <= 50, "Máximo 50 pares de metadata");

export const CrearPushNotificationSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  phoneNumber: z.string().regex(/^[0-9]{10}$/),
  concept: z.string().max(140).optional(),
  expiration: z.number().int().min(360).optional(),
  numRef: NumRef.optional(),
  bankAccountId: z.string().optional(),
  metadata: MetadataEntradaSchema.optional(),
});
export type CrearPushNotification = z.input<typeof CrearPushNotificationSchema>;

export const PushNotificationRespuestaSchema = z
  .object({ transactionId: z.string().min(1), codiId: z.string().min(1) })
  .passthrough();
export type PushNotificationRespuesta = z.infer<typeof PushNotificationRespuestaSchema>;

export const CrearQrSchema = z.object({
  // El brief exige que el monto lo fije el servidor: 0 ("el pagador captura") no se permite aquí.
  amount: z.number().positive(),
  concept: z.string().max(140).optional(),
  expiration: z
    .number()
    .int()
    .refine((v) => v === 0 || v >= 360, "expiration debe ser 0 o ≥ 360")
    .optional(),
  numRef: NumRef.optional(),
  generateImage: z.boolean().optional(),
  bankAccountId: z.string().optional(),
  metadata: MetadataEntradaSchema.optional(),
});
export type CrearQr = z.input<typeof CrearQrSchema>;

export const QrRespuestaSchema = z
  .object({
    id: z.string().min(1),
    qrString: z.string().min(1),
    qrImage: z.string().nullable().optional(),
  })
  .passthrough();
export type QrRespuesta = z.infer<typeof QrRespuestaSchema>;

export const MetadataRespuestaSchema = z
  .object({
    clabe: z.string().optional(),
    bankCode: z.number().optional(),
    accountType: z.number().optional(),
    description: z.string().optional(),
    trackingKey: z.string().optional(),
    externalMetadata: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export const TransaccionPeySchema = z
  .object({
    id: z.string(),
    status: z.enum(["PENDING", "PAID"]),
    amount: z.number(),
    amountBreakdown: z
      .object({
        base: z.number().optional(),
        tip: z.number().optional(),
        fee: z.number().optional(),
      })
      .passthrough()
      .optional(),
    currency: z.string().optional(),
    paymentMethod: z.enum(["CARD", "CODI"]).optional(),
    payableType: z.enum(["PAYMENT_LINK", "API_CODI_QR", "API_CODI_PN"]).optional(),
    payableId: z.string().optional(),
    description: z.string().optional(),
    applicationFee: z.number().optional(),
    dateCreated: z.number().optional(),
    datePaid: z.number().optional(),
    metadata: MetadataRespuestaSchema.optional(),
  })
  .passthrough();
export type TransaccionPey = z.infer<typeof TransaccionPeySchema>;

export const PaginaTransaccionesSchema = z.object({
  items: z.array(TransaccionPeySchema),
  nextToken: z.string().nullable().optional(),
});
export type PaginaTransacciones = z.infer<typeof PaginaTransaccionesSchema>;

export const ErrorPeySchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      type: z.string().optional(),
      requestId: z.string().optional(),
    })
    .passthrough(),
});

// ---- Webhooks ----

const WebhookBase = z
  .object({
    transactionId: z.string().min(1),
    amount: z.number(),
    apiKeyId: z.string().optional(),
    bankAccountId: z.string().optional(),
    concept: z.string().optional(),
    datePaid: z.number().optional(),
    numRef: z.string().optional(),
    metadata: MetadataRespuestaSchema.optional(),
  })
  .passthrough();

export const WebhookEventoSchema = z.discriminatedUnion("type", [
  WebhookBase.extend({ type: z.literal("codi.pn.payment_received") }),
  WebhookBase.extend({ type: z.literal("codi.qr.payment_received"), codiQrId: z.string().min(1) }),
]);
export type WebhookEvento = z.infer<typeof WebhookEventoSchema>;
export const TIPOS_EVENTO_SOPORTADOS = [
  "codi.pn.payment_received",
  "codi.qr.payment_received",
] as const;
