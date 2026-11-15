/**
 * Mismos datos (e IDs) que `supabase/seed.sql`, para que el cambio a Supabase sea transparente.
 */
import type {
  Comercio,
  ComercioConvenio,
  Convenio,
  Credencial,
  Emisor,
  Perfil,
  Producto,
  Verificacion,
} from "../types";

const T = new Date("2026-11-01T12:00:00Z");
const FIN_PERIODO = new Date("2027-01-01T05:59:59Z");

export const IDS = {
  convenios: {
    uttab10: "c0000000-0000-4000-8000-000000000001",
    uttabCafe: "c0000000-0000-4000-8000-000000000002",
    inapam15: "c0000000-0000-4000-8000-000000000003",
  },
  comercios: {
    papeleria: "a0000000-0000-4000-8000-000000000001",
    cafe: "a0000000-0000-4000-8000-000000000002",
    farmacia: "a0000000-0000-4000-8000-000000000003",
  },
  usuarios: {
    ana: "b0000000-0000-4000-8000-000000000001",
    luis: "b0000000-0000-4000-8000-000000000002",
    carmen: "b0000000-0000-4000-8000-000000000003",
    papeleria: "d0000000-0000-4000-8000-000000000001",
    cafe: "d0000000-0000-4000-8000-000000000002",
    farmacia: "d0000000-0000-4000-8000-000000000003",
    emisorUttab: "e0000000-0000-4000-8000-000000000001",
    emisorInapam: "e0000000-0000-4000-8000-000000000002",
  },
} as const;

export function datosSemilla() {
  const emisores: Emisor[] = [
    {
      id: "uttab",
      nombre: "Universidad Tecnológica de Tabasco",
      nombre_corto: "UTTAB",
      tipo_periodo: "cuatrimestre",
      dominios_correo: ["uttab.edu.mx"],
      palabras_institucion: ["UTTAB", "Tecnológica de Tabasco"],
      tipos_documento: ["constancia_estudios", "credencial_estudiante"],
      tipos_beneficiario: ["estudiante"],
      llave_publica: null,
      activo: true,
      created_at: T,
    },
    {
      id: "inapam",
      nombre: "INAPAM (demo)",
      nombre_corto: "INAPAM",
      tipo_periodo: "anual",
      dominios_correo: [],
      palabras_institucion: ["INAPAM", "Instituto Nacional de las Personas Adultas Mayores"],
      tipos_documento: ["credencial_inapam"],
      tipos_beneficiario: ["adulto_mayor"],
      llave_publica: null,
      activo: true,
      created_at: T,
    },
  ];

  const conv = (
    c: Omit<Convenio, "vigente_desde" | "vigente_hasta" | "activo" | "created_at" | "updated_at">,
  ): Convenio => ({
    ...c,
    vigente_desde: "2026-09-01",
    vigente_hasta: null,
    activo: true,
    created_at: T,
    updated_at: T,
  });
  const convenios: Convenio[] = [
    conv({
      id: IDS.convenios.uttab10,
      emisor_id: "uttab",
      nombre: "Estudiante UTTAB 10%",
      descripcion: "10% en tu compra, hasta $50, dos veces al día.",
      tipo_beneficiario: "estudiante",
      regla: { tipo: "porcentaje", valor: 10, tope_centavos: 5000, usos_por_dia: 2 },
    }),
    conv({
      id: IDS.convenios.uttabCafe,
      emisor_id: "uttab",
      nombre: "Café estudiante UTTAB",
      descripcion: "20% en café y bebidas participantes.",
      tipo_beneficiario: "estudiante",
      regla: {
        tipo: "porcentaje",
        valor: 20,
        productos: ["CAFE-AME", "CAFE-LAT", "AGUA-500"],
        usos_por_dia: 3,
      },
    }),
    conv({
      id: IDS.convenios.inapam15,
      emisor_id: "inapam",
      nombre: "INAPAM 15%",
      descripcion: "15% en tu compra, hasta $100, una vez al día.",
      tipo_beneficiario: "adulto_mayor",
      regla: { tipo: "porcentaje", valor: 15, tope_centavos: 10000, usos_por_dia: 1 },
    }),
  ];

  const com = (c: Omit<Comercio, "pey_bank_account_id" | "activo" | "created_at">): Comercio => ({
    ...c,
    pey_bank_account_id: null,
    activo: true,
    created_at: T,
  });
  const comercios: Comercio[] = [
    com({
      id: IDS.comercios.papeleria,
      nombre: "Papelería El Cuaderno",
      giro: "Papelería",
      direccion: "Av. Universidad, cerca de UTTAB (demo)",
      lat: 17.906,
      lng: -92.9155,
    }),
    com({
      id: IDS.comercios.cafe,
      nombre: "Café La Parrilla",
      giro: "Cafetería",
      direccion: "Carretera Villahermosa–Teapa (demo)",
      lat: 17.9071,
      lng: -92.914,
    }),
    com({
      id: IDS.comercios.farmacia,
      nombre: "Farmacia Bienestar",
      giro: "Farmacia",
      direccion: "Parrilla, Centro, Tabasco (demo)",
      lat: 17.9049,
      lng: -92.9172,
    }),
  ];

  const comercioConvenios: ComercioConvenio[] = [
    { comercio_id: IDS.comercios.papeleria, convenio_id: IDS.convenios.uttab10 },
    { comercio_id: IDS.comercios.cafe, convenio_id: IDS.convenios.uttabCafe },
    { comercio_id: IDS.comercios.cafe, convenio_id: IDS.convenios.inapam15 },
    { comercio_id: IDS.comercios.farmacia, convenio_id: IDS.convenios.inapam15 },
    { comercio_id: IDS.comercios.farmacia, convenio_id: IDS.convenios.uttab10 },
  ];

  let n = 0;
  const prod = (
    comercio_id: string,
    sku: string,
    nombre: string,
    precio_centavos: number,
  ): Producto => ({
    id: `20000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    comercio_id,
    sku,
    nombre,
    precio_centavos,
    activo: true,
  });
  const productos: Producto[] = [
    prod(IDS.comercios.cafe, "CAFE-AME", "Café americano", 3500),
    prod(IDS.comercios.cafe, "CAFE-LAT", "Café latte", 4800),
    prod(IDS.comercios.cafe, "AGUA-500", "Agua 500 ml", 1500),
    prod(IDS.comercios.cafe, "PAN-DUL", "Pan dulce", 2200),
    prod(IDS.comercios.cafe, "SAND-JAM", "Sándwich de jamón", 5500),
    prod(IDS.comercios.papeleria, "CUAD-100", "Cuaderno 100 hojas", 4500),
    prod(IDS.comercios.papeleria, "PLUM-AZ", "Pluma azul", 1200),
    prod(IDS.comercios.papeleria, "IMP-BN", "Impresión b/n", 200),
  ];

  const perfil = (p: Partial<Perfil> & Pick<Perfil, "id" | "email">): Perfil => ({
    rol: "beneficiario",
    nombre: null,
    celular: null,
    emisor_id: null,
    comercio_id: null,
    letra_grande: false,
    consentimiento_at: null,
    created_at: T,
    updated_at: T,
    ...p,
  });
  const U = IDS.usuarios;
  const perfiles: Perfil[] = [
    perfil({ id: U.ana, email: "ana.estudiante@cdv.demo", nombre: "Ana", consentimiento_at: T }),
    perfil({ id: U.luis, email: "luis.estudiante@cdv.demo", nombre: "Luis", consentimiento_at: T }),
    perfil({
      id: U.carmen,
      email: "carmen.inapam@cdv.demo",
      nombre: "Carmen",
      consentimiento_at: T,
      letra_grande: true,
    }),
    perfil({
      id: U.papeleria,
      email: "papeleria@cdv.demo",
      rol: "comercio",
      comercio_id: IDS.comercios.papeleria,
      nombre: "Papelería El Cuaderno",
    }),
    perfil({
      id: U.cafe,
      email: "cafe@cdv.demo",
      rol: "comercio",
      comercio_id: IDS.comercios.cafe,
      nombre: "Café La Parrilla",
    }),
    perfil({
      id: U.farmacia,
      email: "farmacia@cdv.demo",
      rol: "comercio",
      comercio_id: IDS.comercios.farmacia,
      nombre: "Farmacia Bienestar",
    }),
    perfil({
      id: U.emisorUttab,
      email: "emisor.uttab@cdv.demo",
      rol: "emisor",
      emisor_id: "uttab",
      nombre: "Servicios Escolares UTTAB",
    }),
    perfil({
      id: U.emisorInapam,
      email: "emisor.inapam@cdv.demo",
      rol: "emisor",
      emisor_id: "inapam",
      nombre: "INAPAM (demo)",
    }),
  ];

  const ver = (
    id: string,
    usuario_id: string,
    emisor_id: string,
    tipo_beneficiario: string,
    metodo: Verificacion["metodo"],
    confianza: number | null,
  ): Verificacion => ({
    id,
    usuario_id,
    emisor_id,
    tipo_beneficiario,
    metodo,
    estado: "aprobada",
    confianza,
    motivos: [],
    nombre_declarado: null,
    documento_path: null,
    revisado_por: null,
    revisado_at: null,
    created_at: T,
    updated_at: T,
  });
  const verificaciones: Verificacion[] = [
    ver(
      "f0000000-0000-4000-8000-000000000001",
      U.ana,
      "uttab",
      "estudiante",
      "correo_institucional",
      null,
    ),
    ver(
      "f0000000-0000-4000-8000-000000000002",
      U.luis,
      "uttab",
      "estudiante",
      "documento_ia",
      0.95,
    ),
    ver(
      "f0000000-0000-4000-8000-000000000003",
      U.carmen,
      "inapam",
      "adulto_mayor",
      "documento_ia",
      0.91,
    ),
  ];

  const cred = (
    id: string,
    usuario_id: string,
    seudonimo: string,
    emisor_id: string,
    tipo_beneficiario: string,
    verificacion_id: string,
  ): Credencial => ({
    id,
    usuario_id,
    seudonimo,
    emisor_id,
    tipo_beneficiario,
    verificacion_id,
    estado: "activa",
    vigente_desde: T,
    vigente_hasta: FIN_PERIODO,
    dispositivo_hash: null,
    jws: null,
    revocada_at: null,
    motivo_revocacion: null,
    created_at: T,
  });
  const credenciales: Credencial[] = [
    cred(
      "10000000-0000-4000-8000-000000000001",
      U.ana,
      "ps_5f2a9c1e7b3d4a60e8f1c2d3",
      "uttab",
      "estudiante",
      verificaciones[0]!.id,
    ),
    cred(
      "10000000-0000-4000-8000-000000000002",
      U.luis,
      "ps_9a7b3c2d1e0f4a5b6c7d8e9f",
      "uttab",
      "estudiante",
      verificaciones[1]!.id,
    ),
    cred(
      "10000000-0000-4000-8000-000000000003",
      U.carmen,
      "ps_1b2c3d4e5f60718293a4b5c6",
      "inapam",
      "adulto_mayor",
      verificaciones[2]!.id,
    ),
  ];

  return {
    emisores,
    convenios,
    comercios,
    comercioConvenios,
    productos,
    perfiles,
    verificaciones,
    credenciales,
  };
}
