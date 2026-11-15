import type {
  Comercio,
  Convenio,
  Credencial,
  Emisor,
  EstadoTransaccion,
  FilaReporteEmisor,
  Notificacion,
  Perfil,
  Producto,
  Transaccion,
  Verificacion,
  WebhookEvento,
} from "./types";

type Nueva<T, Opcionales extends keyof T = never> = Omit<
  T,
  "id" | "created_at" | "updated_at" | Opcionales
> &
  Partial<Pick<T, Opcionales>>;

/** Evento de cambio, equivalente a un mensaje de Supabase Realtime. */
export type CambioRepo =
  { tabla: "transacciones"; fila: Transaccion } | { tabla: "notificaciones"; fila: Notificacion };

/**
 * Acceso a datos. Hoy lo implementa un mock en memoria (`@cdv/db/memory`);
 * después, una implementación sobre Supabase con exactamente esta interfaz.
 *
 * Los métodos marcados como ATÓMICOS corresponden a funciones SQL de la migración 3.
 * El control de acceso (RLS) se emula en la capa de API: estos métodos son "service_role".
 */
export interface Repositorio {
  // ---- Catálogo ----
  emisores(): Promise<Emisor[]>;
  emisor(id: string): Promise<Emisor | null>;
  convenios(filtro?: { emisorId?: string; incluirInactivos?: boolean }): Promise<Convenio[]>;
  convenio(id: string): Promise<Convenio | null>;
  guardarConvenio(
    c: Nueva<Convenio, "activo" | "descripcion" | "vigente_hasta">,
  ): Promise<Convenio>;
  actualizarConvenio(
    id: string,
    cambios: Partial<
      Pick<Convenio, "nombre" | "descripcion" | "regla" | "activo" | "vigente_hasta">
    >,
  ): Promise<Convenio>;
  comercios(): Promise<Comercio[]>;
  comercio(id: string): Promise<Comercio | null>;
  conveniosDeComercio(comercioId: string): Promise<Convenio[]>;
  comerciosDeConvenio(convenioId: string): Promise<Comercio[]>;
  productos(comercioId: string): Promise<Producto[]>;
  /** ATÓMICO: `buscar_convenio()` — activo, vigente hoy (CDMX), del emisor/tipo y ligado al comercio. */
  buscarConvenio(args: {
    emisorId: string;
    tipoBeneficiario: string;
    comercioId: string;
  }): Promise<Convenio | null>;

  // ---- Usuarios ----
  perfil(id: string): Promise<Perfil | null>;
  perfilPorEmail(email: string): Promise<Perfil | null>;
  crearPerfil(p: { email: string }): Promise<Perfil>;
  actualizarPerfil(
    id: string,
    cambios: Partial<Pick<Perfil, "nombre" | "celular" | "letra_grande" | "consentimiento_at">>,
  ): Promise<Perfil>;
  perfilesDemo(): Promise<Perfil[]>;

  // ---- Verificaciones ----
  crearVerificacion(
    v: Nueva<Verificacion, "revisado_por" | "revisado_at" | "motivos">,
  ): Promise<Verificacion>;
  verificacion(id: string): Promise<Verificacion | null>;
  verificacionesDeUsuario(usuarioId: string): Promise<Verificacion[]>;
  colaRevision(emisorId: string): Promise<Verificacion[]>;
  actualizarVerificacion(
    id: string,
    cambios: Partial<Omit<Verificacion, "id" | "usuario_id" | "created_at">>,
  ): Promise<Verificacion>;

  // ---- Credenciales ----
  crearCredencial(
    c: Nueva<
      Credencial,
      | "seudonimo"
      | "estado"
      | "vigente_desde"
      | "dispositivo_hash"
      | "jws"
      | "revocada_at"
      | "motivo_revocacion"
    >,
  ): Promise<Credencial>;
  credencial(id: string): Promise<Credencial | null>;
  credencialesDeUsuario(usuarioId: string): Promise<Credencial[]>;
  credencialesDeEmisor(emisorId: string): Promise<Credencial[]>;
  actualizarCredencial(
    id: string,
    cambios: Partial<
      Pick<Credencial, "jws" | "dispositivo_hash" | "estado" | "revocada_at" | "motivo_revocacion">
    >,
  ): Promise<Credencial>;

  // ---- Antirreplay y rate limit ----
  /** ATÓMICO: true si el nonce era nuevo. */
  consumirNonce(nonce: string, expiraEn: Date): Promise<boolean>;
  /** ATÓMICO: true si está dentro del límite. */
  rateLimit(clave: string, limite: number, ventanaSeg: number): Promise<boolean>;

  // ---- Transacciones ----
  /** Idempotente: si ya existe la `idempotency_key`, regresa la existente con `creada = false`. */
  crearTransaccion(
    t: Nueva<
      Transaccion,
      | "estado"
      | "pey_id"
      | "pey_codi_id"
      | "pey_qr_string"
      | "pey_num_ref"
      | "expira_en"
      | "pagada_en"
      | "error"
    >,
  ): Promise<{ transaccion: Transaccion; creada: boolean }>;
  transaccion(id: string): Promise<Transaccion | null>;
  transaccionPorPeyId(peyId: string): Promise<Transaccion | null>;
  transaccionPorCodiId(codiId: string): Promise<Transaccion | null>;
  /** Actualiza solo si el estado actual está en `desde` (control de concurrencia optimista). */
  transicionarTransaccion(
    id: string,
    desde: readonly EstadoTransaccion[],
    cambios: Partial<Omit<Transaccion, "id" | "created_at">>,
  ): Promise<Transaccion | null>;
  transaccionesDeComercio(comercioId: string, desde?: Date): Promise<Transaccion[]>;
  transaccionesDeUsuario(usuarioId: string): Promise<Transaccion[]>;
  transaccionesVencidas(ahora: Date): Promise<Transaccion[]>;
  /** ATÓMICO: `usos_hoy()`. */
  usosHoy(credencialId: string, convenioId: string): Promise<number>;

  // ---- Webhooks ----
  /** Inserta el evento; false si el `webhook-id` ya existía (duplicado). */
  registrarWebhook(e: Pick<WebhookEvento, "id" | "tipo" | "payload">): Promise<boolean>;
  marcarWebhook(
    id: string,
    cambios: Partial<
      Pick<WebhookEvento, "procesado" | "procesado_at" | "error" | "transaccion_id">
    >,
  ): Promise<void>;
  webhook(id: string): Promise<WebhookEvento | null>;

  // ---- Notificaciones ----
  notificar(
    n: Pick<Notificacion, "usuario_id" | "tipo" | "titulo" | "cuerpo"> & {
      datos?: Record<string, unknown>;
    },
  ): Promise<Notificacion>;
  notificaciones(usuarioId: string): Promise<Notificacion[]>;
  marcarLeidas(usuarioId: string, ids?: string[]): Promise<void>;

  // ---- Reportes (solo agregados) ----
  reporteEmisor(emisorId: string, desde: string, hasta: string): Promise<FilaReporteEmisor[]>;

  // ---- "Realtime" ----
  suscribir(cb: (c: CambioRepo) => void): () => void;
}
