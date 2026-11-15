import { z } from "zod";

/**
 * Regla de descuento de un convenio (se guarda como JSON en `convenios.regla`).
 * - porcentaje: `valor` es 0 < valor ≤ 100
 * - monto_fijo: `valor` está en centavos
 */
export const ReglaConvenioSchema = z
  .object({
    tipo: z.enum(["porcentaje", "monto_fijo"]),
    valor: z.number().positive(),
    /** Descuento máximo por compra, en centavos. */
    tope_centavos: z.number().int().positive().optional(),
    /** Compra mínima (sobre la base elegible) para aplicar, en centavos. */
    monto_minimo_centavos: z.number().int().nonnegative().optional(),
    /** SKUs elegibles. Si se define, el descuento solo aplica a esos productos. */
    productos: z.array(z.string().min(1)).min(1).optional(),
    /** Máximo de compras con descuento por beneficiario por día en este convenio. */
    usos_por_dia: z.number().int().positive().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.tipo === "porcentaje" && r.valor > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["valor"],
        message: "El porcentaje no puede pasar de 100",
      });
    }
    if (r.tipo === "monto_fijo" && !Number.isInteger(r.valor)) {
      ctx.addIssue({
        code: "custom",
        path: ["valor"],
        message: "El monto fijo va en centavos enteros",
      });
    }
  });

export type ReglaConvenio = z.infer<typeof ReglaConvenioSchema>;

export const ItemCompraSchema = z.object({
  sku: z.string().min(1),
  nombre: z.string().min(1).max(120),
  precio_centavos: z.number().int().nonnegative(),
  cantidad: z.number().int().positive().max(999),
});
export type ItemCompra = z.infer<typeof ItemCompraSchema>;

export const CompraSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("monto"),
    monto_centavos: z.number().int().positive().max(100_000_000),
  }),
  z.object({
    tipo: z.literal("productos"),
    items: z.array(ItemCompraSchema).min(1).max(100),
  }),
]);
export type Compra = z.infer<typeof CompraSchema>;
