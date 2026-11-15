import { describe, expect, it } from "vitest";
import { finDePeriodo } from "./periodo";
import type { ExtraccionDocumento } from "./providers";
import { correoEnDominio, evaluarDocumento, nombresCoinciden, normalizarCelularMx } from "./rules";
import { montoACobrar, numRefDesdeId, puedeTransicionar } from "../payments/transaccion";

describe("periodo", () => {
  it("cuatrimestre sep–dic termina el 31 de dic (CDMX)", () => {
    expect(finDePeriodo("cuatrimestre", new Date("2026-11-15T12:00:00Z")).toISOString()).toBe(
      "2027-01-01T05:59:59.000Z",
    );
  });
  it("cuatrimestre ene–abr termina el 30 de abril", () => {
    expect(finDePeriodo("cuatrimestre", new Date("2026-02-10T12:00:00Z")).toISOString()).toBe(
      "2026-05-01T05:59:59.000Z",
    );
  });
  it("semestre ene–jun", () => {
    expect(finDePeriodo("semestre", new Date("2026-03-01T00:00:00Z")).toISOString()).toBe(
      "2026-07-01T05:59:59.000Z",
    );
  });
});

describe("correo institucional", () => {
  it("acepta dominio exacto y rechaza imitaciones", () => {
    expect(correoEnDominio("Ana@UTTAB.edu.mx", ["@uttab.edu.mx"])).toBe(true);
    expect(correoEnDominio("ana@uttab.edu.mx.evil.com", ["uttab.edu.mx"])).toBe(false);
    expect(correoEnDominio("ana@x.uttab.edu.mx", ["uttab.edu.mx"])).toBe(false);
    expect(correoEnDominio("sin-arroba", ["uttab.edu.mx"])).toBe(false);
  });
});

describe("documento con IA", () => {
  const base: ExtraccionDocumento = {
    nombre_completo: "MARÍA JOSÉ PÉREZ LÓPEZ",
    institucion: "Universidad Tecnológica de Tabasco",
    tipo_documento: "constancia_estudios",
    fecha_emision: "2026-10-01",
    vigencia_hasta: null,
    confianza: 0.93,
    observaciones: null,
  };
  const args = {
    nombreDeclarado: "Maria Jose Perez",
    tiposAceptados: ["constancia_estudios", "credencial_estudiante"] as const,
    palabrasInstitucion: ["UTTAB", "Tecnológica de Tabasco"],
    ahora: new Date("2026-11-15T12:00:00Z"),
  };

  it("aprueba cuando todo coincide", () => {
    expect(evaluarDocumento({ ...args, extraccion: base }).estado).toBe("aprobada");
  });
  it("manda a revisión manual con confianza baja", () => {
    expect(evaluarDocumento({ ...args, extraccion: { ...base, confianza: 0.5 } })).toEqual({
      estado: "revision_manual",
      motivos: ["confianza_baja"],
    });
  });
  it("rechaza documento de más de 3 meses", () => {
    expect(
      evaluarDocumento({ ...args, extraccion: { ...base, fecha_emision: "2026-06-01" } }).estado,
    ).toBe("rechazada");
  });
  it("acepta documento viejo si la vigencia está activa", () => {
    expect(
      evaluarDocumento({
        ...args,
        extraccion: { ...base, fecha_emision: "2025-01-01", vigencia_hasta: "2027-01-01" },
      }).estado,
    ).toBe("aprobada");
  });
  it("rechaza vigencia vencida", () => {
    expect(
      evaluarDocumento({ ...args, extraccion: { ...base, vigencia_hasta: "2026-11-01" } }).motivos,
    ).toEqual(["documento_vencido"]);
  });
  it("revisión manual si el nombre no coincide", () => {
    expect(
      evaluarDocumento({ ...args, extraccion: { ...base, nombre_completo: "Juan Pérez" } }).motivos,
    ).toContain("nombre_no_coincide");
  });
  it("rechaza tipo no aceptado", () => {
    expect(
      evaluarDocumento({ ...args, extraccion: { ...base, tipo_documento: "credencial_inapam" } })
        .estado,
    ).toBe("rechazada");
  });
  it("coincidencia de nombres ignora acentos y exige ≥2 palabras", () => {
    expect(nombresCoinciden("José Pérez", "JOSE LUIS PEREZ GARCIA")).toBe(true);
    expect(nombresCoinciden("José", "JOSE PEREZ")).toBe(false);
  });
});

describe("celular", () => {
  it("normaliza formatos mexicanos", () => {
    expect(normalizarCelularMx("+52 1 993 123 4567")).toBe("9931234567");
    expect(normalizarCelularMx("993-123-4567")).toBe("9931234567");
    expect(normalizarCelularMx("12345")).toBeNull();
  });
});

describe("transacciones", () => {
  it("modo prueba cobra el monto simbólico", () => {
    expect(
      montoACobrar({ montoFinalCentavos: 13_500, modoPrueba: true, montoPruebaCentavos: 10 }),
    ).toBe(10);
    expect(
      montoACobrar({ montoFinalCentavos: 13_500, modoPrueba: false, montoPruebaCentavos: 10 }),
    ).toBe(13_500);
    expect(montoACobrar({ montoFinalCentavos: 5, modoPrueba: true, montoPruebaCentavos: 10 })).toBe(
      5,
    );
  });
  it("numRef cumple el patrón de Pey", () => {
    expect(numRefDesdeId("4f1c2b8e-1111-2222-3333-444455556666")).toMatch(/^[0-9]{1,7}$/);
  });
  it("no se puede salir de pagada", () => {
    expect(puedeTransicionar("pagada", "expirada")).toBe(false);
    expect(puedeTransicionar("expirada", "pagada")).toBe(true);
  });
});
