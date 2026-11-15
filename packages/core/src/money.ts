/**
 * Todo el dinero se maneja en CENTAVOS enteros para evitar errores de punto flotante.
 * Solo se convierte a pesos (number con 2 decimales) en la frontera con Pey y en la UI.
 */
export type Centavos = number & { readonly __brand?: "centavos" };

export function pesosACentavos(pesos: number): Centavos {
  if (!Number.isFinite(pesos)) throw new RangeError("Monto inválido");
  return Math.round(pesos * 100);
}

export function centavosAPesos(centavos: Centavos): number {
  assertCentavos(centavos);
  return centavos / 100;
}

export function assertCentavos(c: number): asserts c is Centavos {
  if (!Number.isSafeInteger(c) || c < 0) throw new RangeError(`Centavos inválidos: ${c}`);
}

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatoMXN(centavos: Centavos): string {
  return fmt.format(centavos / 100);
}
