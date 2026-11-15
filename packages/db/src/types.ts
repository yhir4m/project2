/**
 * Modelo de dominio de las filas de Supabase (ver `database.types.ts`, generado).
 * Diferencias con la fila cruda: fechas como `Date` y `regla`/`compra` tipadas.
 * Dinero en centavos enteros.
 */
import type { Compra, ReglaConvenio, TipoPeriodo } from "@cdv/core";

export type RolUsuario = "beneficiario" | "comercio" | "emisor";
export type MetodoVerificacion = "correo_institucional" | "documento_ia" | "externo";
export type EstadoVerificacion = "pendiente" | "aprobada" | "rechazada" | "revision_manual";
export type EstadoCredencial = "activa" | "revocada" | "vencida";
export type MetodoPago = "codi" | "efectivo";
export type CanalCodi = "pn" | "qr";
export type EstadoTransaccion =
  "creando" | "pendiente" | "incierta" | "pagada" | "expirada" | "cancelada" | "fallida";

export interface Emisor {
  id: string;
  nombre: string;
  nombre_corto: string;
  tipo_periodo: TipoPeriodo;
  dominios_correo: string[];
  palabras_institucion: string[];
  tipos_documento: string[];
  tipos_beneficiario: string[];
  llave_publica: string | null;
  activo: boolean;
  created_at: Date;
}

export interface Convenio {
  id: string;
  emisor_id: string;
  nombre: string;
  descripcion: string | null;
  tipo_beneficiario: string;
  regla: ReglaConvenio;
  vigente_desde: string; // YYYY-MM-DD
  vigente_hasta: string | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Comercio {
  id: string;
  nombre: string;
  giro: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  pey_bank_account_id: string | null;
  activo: boolean;
  created_at: Date;
}

export interface ComercioConvenio {
  comercio_id: string;
  convenio_id: string;
}

export interface Producto {
  id: string;
  comercio_id: string;
  sku: string;
  nombre: string;
  precio_centavos: number;
  activo: boolean;
}

export interface Perfil {
  id: string;
  rol: RolUsuario;
  nombre: string | null;
  celular: string | null;
  emisor_id: string | null;
  comercio_id: string | null;
  letra_grande: boolean;
  consentimiento_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Verificacion {
  id: string;
  usuario_id: string;
  emisor_id: string;
  tipo_beneficiario: string;
  metodo: MetodoVerificacion;
  estado: EstadoVerificacion;
  confianza: number | null;
  motivos: string[];
  nombre_declarado: string | null;
  documento_path: string | null;
  revisado_por: string | null;
  revisado_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Credencial {
  id: string;
  usuario_id: string;
  seudonimo: string;
  emisor_id: string;
  tipo_beneficiario: string;
  verificacion_id: string | null;
  estado: EstadoCredencial;
  vigente_desde: Date;
  vigente_hasta: Date;
  dispositivo_hash: string | null;
  jws: string | null;
  revocada_at: Date | null;
  motivo_revocacion: string | null;
  created_at: Date;
}

export interface Transaccion {
  id: string;
  idempotency_key: string;
  solicitud_id: string | null;
  comercio_id: string;
  /** Quien pagó (con o sin credencial). */
  pagador_id: string | null;
  /** Solo si hubo descuento por convenio; null = precio general. */
  credencial_id: string | null;
  convenio_id: string | null;
  compra: Compra;
  precio_original_centavos: number;
  descuento_centavos: number;
  monto_final_centavos: number;
  monto_cobrado_centavos: number;
  metodo: MetodoPago;
  canal: CanalCodi | null;
  estado: EstadoTransaccion;
  modo_prueba: boolean;
  pey_id: string | null;
  pey_codi_id: string | null;
  pey_qr_string: string | null;
  pey_num_ref: string | null;
  expira_en: Date | null;
  pagada_en: Date | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

export type EstadoSolicitud = "abierta" | "tomada" | "pagada" | "cancelada" | "expirada";

/** Cobro que inicia el comercio (su QR en pantalla); el cliente lo escanea para pagar. */
export interface SolicitudCobro {
  id: string;
  comercio_id: string;
  compra: Compra;
  total_centavos: number;
  estado: EstadoSolicitud;
  transaccion_id: string | null;
  expira_en: Date;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEvento {
  id: string;
  tipo: string;
  payload: unknown;
  transaccion_id: string | null;
  procesado: boolean;
  procesado_at: Date | null;
  error: string | null;
  recibido_at: Date;
}

export interface Notificacion {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  datos: Record<string, unknown>;
  leida: boolean;
  created_at: Date;
}

export interface FilaReporteEmisor {
  dia: string;
  convenio_id: string;
  convenio: string;
  usos: number;
  descuento_centavos: number;
  venta_centavos: number;
  efectivo: number;
  codi: number;
}
