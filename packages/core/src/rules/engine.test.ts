import { describe, expect, it } from "vitest";
import { calcularDescuento, describirRegla } from "./engine";
import type { Compra, ReglaConvenio } from "./schema";

const monto = (c: number): Compra => ({ tipo: "monto", monto_centavos: c });

describe("calcularDescuento", () => {
  it("aplica porcentaje sobre el total", () => {
    const r = calcularDescuento({
      regla: { tipo: "porcentaje", valor: 10 },
      compra: monto(15_000),
      usos_hoy: 0,
    });
    expect(r).toMatchObject({
      precio_original_centavos: 15_000,
      descuento_centavos: 1_500,
      monto_final_centavos: 13_500,
      aplicado: true,
    });
  });

  it("redondea hacia abajo el porcentaje (nunca descuenta de más)", () => {
    const r = calcularDescuento({
      regla: { tipo: "porcentaje", valor: 15 },
      compra: monto(999),
      usos_hoy: 0,
    });
    expect(r.descuento_centavos).toBe(149); // 149.85 → 149
    expect(r.monto_final_centavos).toBe(850);
  });

  it("respeta el tope", () => {
    const r = calcularDescuento({
      regla: { tipo: "porcentaje", valor: 50, tope_centavos: 3_000 },
      compra: monto(20_000),
      usos_hoy: 0,
    });
    expect(r.descuento_centavos).toBe(3_000);
    expect(r.tope_aplicado).toBe(true);
  });

  it("monto fijo no puede dejar el total negativo", () => {
    const r = calcularDescuento({
      regla: { tipo: "monto_fijo", valor: 5_000 },
      compra: monto(3_000),
      usos_hoy: 0,
    });
    expect(r.descuento_centavos).toBe(3_000);
    expect(r.monto_final_centavos).toBe(0);
  });

  it("100% deja el total en cero", () => {
    const r = calcularDescuento({
      regla: { tipo: "porcentaje", valor: 100 },
      compra: monto(1),
      usos_hoy: 0,
    });
    expect(r.monto_final_centavos).toBe(0);
  });

  it("bloquea por límite de usos al día", () => {
    const regla: ReglaConvenio = { tipo: "porcentaje", valor: 10, usos_por_dia: 2 };
    expect(calcularDescuento({ regla, compra: monto(10_000), usos_hoy: 1 }).aplicado).toBe(true);
    const r = calcularDescuento({ regla, compra: monto(10_000), usos_hoy: 2 });
    expect(r).toMatchObject({
      aplicado: false,
      motivo: "limite_diario",
      monto_final_centavos: 10_000,
    });
  });

  it("solo descuenta productos elegibles", () => {
    const r = calcularDescuento({
      regla: { tipo: "porcentaje", valor: 20, productos: ["CAFE"] },
      compra: {
        tipo: "productos",
        items: [
          { sku: "CAFE", nombre: "Café", precio_centavos: 3_000, cantidad: 2 },
          { sku: "PAN", nombre: "Pan", precio_centavos: 2_500, cantidad: 1 },
        ],
      },
      usos_hoy: 0,
    });
    expect(r).toMatchObject({
      precio_original_centavos: 8_500,
      base_elegible_centavos: 6_000,
      descuento_centavos: 1_200,
      monto_final_centavos: 7_300,
    });
  });

  it("sin productos elegibles en el carrito no hay descuento", () => {
    const r = calcularDescuento({
      regla: { tipo: "porcentaje", valor: 20, productos: ["CAFE"] },
      compra: {
        tipo: "productos",
        items: [{ sku: "PAN", nombre: "Pan", precio_centavos: 2_500, cantidad: 1 }],
      },
      usos_hoy: 0,
    });
    expect(r).toMatchObject({ aplicado: false, motivo: "sin_productos_elegibles" });
  });

  it("regla por productos con monto libre requiere productos", () => {
    const r = calcularDescuento({
      regla: { tipo: "porcentaje", valor: 20, productos: ["CAFE"] },
      compra: monto(5_000),
      usos_hoy: 0,
    });
    expect(r.motivo).toBe("requiere_productos");
  });

  it("respeta el monto mínimo", () => {
    const r = calcularDescuento({
      regla: { tipo: "monto_fijo", valor: 1_000, monto_minimo_centavos: 10_000 },
      compra: monto(9_999),
      usos_hoy: 0,
    });
    expect(r.motivo).toBe("monto_minimo");
  });

  it("rechaza reglas inválidas", () => {
    expect(() =>
      calcularDescuento({
        regla: { tipo: "porcentaje", valor: 150 },
        compra: monto(100),
        usos_hoy: 0,
      }),
    ).toThrow();
    expect(() =>
      calcularDescuento({
        regla: { tipo: "monto_fijo", valor: 10.5 },
        compra: monto(100),
        usos_hoy: 0,
      }),
    ).toThrow();
  });

  it("rechaza compras inválidas", () => {
    expect(() =>
      calcularDescuento({
        regla: { tipo: "porcentaje", valor: 10 },
        compra: monto(0),
        usos_hoy: 0,
      }),
    ).toThrow();
    expect(() =>
      calcularDescuento({
        regla: { tipo: "porcentaje", valor: 10 },
        compra: monto(100),
        usos_hoy: -1,
      }),
    ).toThrow();
  });
});

describe("describirRegla", () => {
  it("describe sin jerga", () => {
    expect(
      describirRegla({ tipo: "porcentaje", valor: 10, tope_centavos: 5_000, usos_por_dia: 1 }),
    ).toBe("10% de descuento, hasta $50.00, 1 vez al día");
  });
});
