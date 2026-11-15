import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Compra, ReglaConvenio } from "@cdv/core";
import type { Database, Tables } from "./database.types";
import { fechaCdmx } from "./fechas";
import type { Repositorio } from "./repo";
import type {
  Comercio,
  Convenio,
  Credencial,
  Emisor,
  FilaReporteEmisor,
  Notificacion,
  Perfil,
  Producto,
  SolicitudCobro,
  Transaccion,
  Verificacion,
  WebhookEvento,
} from "./types";

export type ClienteAdmin = SupabaseClient<Database>;

/** Cliente con service_role. SOLO servidor: nunca exponer la llave al navegador. */
export function crearClienteAdmin(url: string, serviceRoleKey: string): ClienteAdmin {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// ---------- mapeo fila → dominio ----------
const d = (s: string) => new Date(s);
const dn = (s: string | null) => (s ? new Date(s) : null);
const iso = (x: Date | null | undefined) => (x === undefined ? undefined : x === null ? null : x.toISOString());

const aEmisor = (r: Tables<"emisores">): Emisor => ({ ...r, created_at: d(r.created_at) });
const aConvenio = (r: Tables<"convenios">): Convenio => ({
  ...r,
  regla: r.regla as unknown as ReglaConvenio,
  created_at: d(r.created_at),
  updated_at: d(r.updated_at),
});
const aComercio = (r: Tables<"comercios">): Comercio => ({ ...r, created_at: d(r.created_at) });
const aProducto = (r: Tables<"productos">): Producto => r;
const aPerfil = (r: Tables<"perfiles">): Perfil => ({
  ...r,
  consentimiento_at: dn(r.consentimiento_at),
  created_at: d(r.created_at),
  updated_at: d(r.updated_at),
});
const aVerificacion = (r: Tables<"verificaciones">): Verificacion => ({
  ...r,
  confianza: r.confianza === null ? null : Number(r.confianza),
  revisado_at: dn(r.revisado_at),
  created_at: d(r.created_at),
  updated_at: d(r.updated_at),
});
const aCredencial = (r: Tables<"credenciales">): Credencial => ({
  ...r,
  vigente_desde: d(r.vigente_desde),
  vigente_hasta: d(r.vigente_hasta),
  revocada_at: dn(r.revocada_at),
  created_at: d(r.created_at),
});
const aTransaccion = (r: Tables<"transacciones">): Transaccion => ({
  ...r,
  compra: r.compra as unknown as Compra,
  precio_original_centavos: Number(r.precio_original_centavos),
  descuento_centavos: Number(r.descuento_centavos),
  monto_final_centavos: Number(r.monto_final_centavos),
  monto_cobrado_centavos: Number(r.monto_cobrado_centavos),
  expira_en: dn(r.expira_en),
  pagada_en: dn(r.pagada_en),
  created_at: d(r.created_at),
  updated_at: d(r.updated_at),
});
const aSolicitud = (r: Tables<"solicitudes_cobro">): SolicitudCobro => ({
  ...r,
  compra: r.compra as unknown as Compra,
  total_centavos: Number(r.total_centavos),
  expira_en: d(r.expira_en),
  created_at: d(r.created_at),
  updated_at: d(r.updated_at),
});
const aWebhook = (r: Tables<"webhook_eventos">): WebhookEvento => ({
  ...r,
  procesado_at: dn(r.procesado_at),
  recibido_at: d(r.recibido_at),
});
const aNotificacion = (r: Tables<"notificaciones">): Notificacion => ({
  ...r,
  datos: (r.datos ?? {}) as Record<string, unknown>,
  created_at: d(r.created_at),
});

/** Convierte Date → ISO en un objeto de cambios (para insert/update). */
function serializar<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    out[k] = v instanceof Date ? iso(v) : v;
  }
  return out;
}

type Resp<T> = { data: T | null; error: { message: string; code?: string } | null };

/** Resultado obligatorio (listas, single, rpc). */
function ok<T>(r: Resp<T>, ctx: string): NonNullable<T> {
  if (r.error) throw new Error(`[db] ${ctx}: ${r.error.message}`);
  if (r.data === null || r.data === undefined) throw new Error(`[db] ${ctx}: sin datos`);
  return r.data as NonNullable<T>;
}

/** Solo verifica que no haya error (insert/update sin select). */
function sinError(r: { error: { message: string } | null }, ctx: string): void {
  if (r.error) throw new Error(`[db] ${ctx}: ${r.error.message}`);
}

/** Resultado opcional (maybeSingle). */
function opt<T>(r: Resp<T>, ctx: string): T | null {
  if (r.error) throw new Error(`[db] ${ctx}: ${r.error.message}`);
  return r.data ?? null;
}

const BUCKET = "documentos";

export class RepositorioSupabase implements Repositorio {
  constructor(private readonly db: ClienteAdmin) {}

  // ---------- Catálogo ----------
  async emisores() {
    return ok(await this.db.from("emisores").select("*").eq("activo", true).order("id"), "emisores").map(aEmisor);
  }
  async emisor(id: string) {
    const r = opt(await this.db.from("emisores").select("*").eq("id", id).maybeSingle(), "emisor");
    return r ? aEmisor(r) : null;
  }
  async convenios(f: { emisorId?: string; incluirInactivos?: boolean } = {}) {
    let q = this.db.from("convenios").select("*").order("created_at");
    if (f.emisorId) q = q.eq("emisor_id", f.emisorId);
    if (!f.incluirInactivos) q = q.eq("activo", true);
    return ok(await q, "convenios").map(aConvenio);
  }
  async convenio(id: string) {
    const r = opt(await this.db.from("convenios").select("*").eq("id", id).maybeSingle(), "convenio");
    return r ? aConvenio(r) : null;
  }
  async guardarConvenio(c: Parameters<Repositorio["guardarConvenio"]>[0]) {
    const r = ok(
      await this.db
        .from("convenios")
        .insert({ ...c, regla: c.regla as unknown as Database["public"]["Tables"]["convenios"]["Insert"]["regla"] })
        .select("*")
        .single(),
      "guardarConvenio",
    );
    return aConvenio(r);
  }
  async actualizarConvenio(id: string, cambios: Parameters<Repositorio["actualizarConvenio"]>[1]) {
    const r = ok(
      await this.db
        .from("convenios")
        .update(serializar(cambios) as Database["public"]["Tables"]["convenios"]["Update"])
        .eq("id", id)
        .select("*")
        .single(),
      "actualizarConvenio",
    );
    return aConvenio(r);
  }
  async comercios() {
    return ok(await this.db.from("comercios").select("*").eq("activo", true).order("nombre"), "comercios").map(aComercio);
  }
  async comercio(id: string) {
    const r = opt(await this.db.from("comercios").select("*").eq("id", id).maybeSingle(), "comercio");
    return r ? aComercio(r) : null;
  }
  async conveniosDeComercio(comercioId: string) {
    const r = ok(
      await this.db.from("comercio_convenios").select("convenios(*)").eq("comercio_id", comercioId),
      "conveniosDeComercio",
    );
    return r
      .map((x) => x.convenios)
      .filter((c): c is Tables<"convenios"> => Boolean(c && c.activo))
      .map(aConvenio);
  }
  async comerciosDeConvenio(convenioId: string) {
    const r = ok(
      await this.db.from("comercio_convenios").select("comercios(*)").eq("convenio_id", convenioId),
      "comerciosDeConvenio",
    );
    return r
      .map((x) => x.comercios)
      .filter((c): c is Tables<"comercios"> => Boolean(c && c.activo))
      .map(aComercio);
  }
  async productos(comercioId: string, filtro: { incluirInactivos?: boolean } = {}) {
    let q = this.db.from("productos").select("*").eq("comercio_id", comercioId).order("nombre");
    if (!filtro.incluirInactivos) q = q.eq("activo", true);
    return ok(await q, "productos").map(aProducto);
  }
  async producto(id: string) {
    const r = opt(await this.db.from("productos").select("*").eq("id", id).maybeSingle(), "producto");
    return r ? aProducto(r) : null;
  }
  async crearProducto(p: Parameters<Repositorio["crearProducto"]>[0]) {
    return aProducto(ok(await this.db.from("productos").insert(p).select("*").single(), "crearProducto"));
  }
  async activarProducto(id: string, activo: boolean) {
    return aProducto(ok(await this.db.from("productos").update({ activo }).eq("id", id).select("*").single(), "activarProducto"));
  }
  async buscarConvenio(a: { emisorId: string; tipoBeneficiario: string; comercioId: string }) {
    const r = ok(
      await this.db.rpc("buscar_convenio", {
        p_emisor_id: a.emisorId,
        p_tipo: a.tipoBeneficiario,
        p_comercio_id: a.comercioId,
      }),
      "buscarConvenio",
    );
    const id = r?.[0]?.id;
    return id ? this.convenio(id) : null;
  }

  // ---------- Usuarios ----------
  async perfil(id: string) {
    const r = opt(await this.db.from("perfiles").select("*").eq("id", id).maybeSingle(), "perfil");
    return r ? aPerfil(r) : null;
  }
  async actualizarPerfil(id: string, cambios: Parameters<Repositorio["actualizarPerfil"]>[1]) {
    const r = ok(
      await this.db
        .from("perfiles")
        .update(serializar(cambios) as Database["public"]["Tables"]["perfiles"]["Update"])
        .eq("id", id)
        .select("*")
        .single(),
      "actualizarPerfil",
    );
    return aPerfil(r);
  }
  async usuariosDemo() {
    const { data, error } = await this.db.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(`[db] usuariosDemo: ${error.message}`);
    const demo = data.users.filter((u) => u.app_metadata?.demo === true && u.email);
    if (!demo.length) return [];
    const perfiles = ok(
      await this.db
        .from("perfiles")
        .select("*")
        .in(
          "id",
          demo.map((u) => u.id),
        ),
      "perfilesDemo",
    );
    const porId = new Map(perfiles.map((p) => [p.id, aPerfil(p)]));
    return demo
      .filter((u) => porId.has(u.id))
      .map((u) => ({ perfil: porId.get(u.id)!, email: u.email! }))
      .sort((a, b) => a.perfil.rol.localeCompare(b.perfil.rol) || (a.perfil.nombre ?? "").localeCompare(b.perfil.nombre ?? ""));
  }

  // ---------- Verificaciones ----------
  async crearVerificacion(v: Parameters<Repositorio["crearVerificacion"]>[0]) {
    const r = ok(
      await this.db
        .from("verificaciones")
        .insert(serializar(v) as Database["public"]["Tables"]["verificaciones"]["Insert"])
        .select("*")
        .single(),
      "crearVerificacion",
    );
    return aVerificacion(r);
  }
  async verificacion(id: string) {
    const r = opt(await this.db.from("verificaciones").select("*").eq("id", id).maybeSingle(), "verificacion");
    return r ? aVerificacion(r) : null;
  }
  async verificacionesDeUsuario(usuarioId: string) {
    return ok(
      await this.db.from("verificaciones").select("*").eq("usuario_id", usuarioId).order("created_at", { ascending: false }),
      "verificacionesDeUsuario",
    ).map(aVerificacion);
  }
  async colaRevision(emisorId: string) {
    return ok(
      await this.db
        .from("verificaciones")
        .select("*")
        .eq("emisor_id", emisorId)
        .eq("estado", "revision_manual")
        .order("created_at"),
      "colaRevision",
    ).map(aVerificacion);
  }
  async actualizarVerificacion(id: string, cambios: Parameters<Repositorio["actualizarVerificacion"]>[1]) {
    const r = ok(
      await this.db
        .from("verificaciones")
        .update(serializar(cambios) as Database["public"]["Tables"]["verificaciones"]["Update"])
        .eq("id", id)
        .select("*")
        .single(),
      "actualizarVerificacion",
    );
    return aVerificacion(r);
  }

  // ---------- Credenciales ----------
  async crearCredencial(c: Parameters<Repositorio["crearCredencial"]>[0]) {
    const r = ok(
      await this.db
        .from("credenciales")
        .insert(serializar(c) as Database["public"]["Tables"]["credenciales"]["Insert"])
        .select("*")
        .single(),
      "crearCredencial",
    );
    return aCredencial(r);
  }
  async credencial(id: string) {
    const r = opt(await this.db.from("credenciales").select("*").eq("id", id).maybeSingle(), "credencial");
    return r ? aCredencial(r) : null;
  }
  async credencialesDeUsuario(usuarioId: string) {
    return ok(
      await this.db.from("credenciales").select("*").eq("usuario_id", usuarioId).order("created_at", { ascending: false }),
      "credencialesDeUsuario",
    ).map(aCredencial);
  }
  async credencialesDeEmisor(emisorId: string) {
    return ok(
      await this.db.from("credenciales").select("*").eq("emisor_id", emisorId).order("created_at", { ascending: false }),
      "credencialesDeEmisor",
    ).map(aCredencial);
  }
  async actualizarCredencial(id: string, cambios: Parameters<Repositorio["actualizarCredencial"]>[1]) {
    const r = ok(
      await this.db
        .from("credenciales")
        .update(serializar(cambios) as Database["public"]["Tables"]["credenciales"]["Update"])
        .eq("id", id)
        .select("*")
        .single(),
      "actualizarCredencial",
    );
    return aCredencial(r);
  }

  // ---------- Antirreplay / rate limit ----------
  async consumirNonce(nonce: string, expiraEn: Date) {
    return ok(await this.db.rpc("consumir_nonce", { p_nonce: nonce, p_expira_en: expiraEn.toISOString() }), "consumirNonce");
  }
  async rateLimit(clave: string, limite: number, ventanaSeg: number) {
    return ok(
      await this.db.rpc("rl_consumir", { p_clave: clave, p_limite: limite, p_ventana_seg: ventanaSeg }),
      "rateLimit",
    );
  }

  // ---------- Solicitudes de cobro ----------
  async crearSolicitud(x: Parameters<Repositorio["crearSolicitud"]>[0]) {
    const r = ok(
      await this.db
        .from("solicitudes_cobro")
        .insert({
          comercio_id: x.comercio_id,
          compra: x.compra as unknown as Database["public"]["Tables"]["solicitudes_cobro"]["Insert"]["compra"],
          total_centavos: x.total_centavos,
          expira_en: x.expira_en.toISOString(),
        })
        .select("*")
        .single(),
      "crearSolicitud",
    );
    return aSolicitud(r);
  }
  async solicitud(id: string) {
    const r = opt(await this.db.from("solicitudes_cobro").select("*").eq("id", id).maybeSingle(), "solicitud");
    return r ? aSolicitud(r) : null;
  }
  async tomarSolicitud(id: string) {
    const r = ok(await this.db.rpc("tomar_solicitud", { p_id: id }), "tomarSolicitud");
    return r[0] ? aSolicitud(r[0]) : null;
  }
  async actualizarSolicitud(
    id: string,
    desde: readonly SolicitudCobro["estado"][],
    cambios: Parameters<Repositorio["actualizarSolicitud"]>[2],
  ) {
    const r = opt(
      await this.db
        .from("solicitudes_cobro")
        .update(cambios)
        .eq("id", id)
        .in("estado", [...desde])
        .select("*")
        .maybeSingle(),
      "actualizarSolicitud",
    );
    return r ? aSolicitud(r) : null;
  }

  // ---------- Transacciones ----------
  async crearTransaccion(t: Parameters<Repositorio["crearTransaccion"]>[0]) {
    const r = await this.db
      .from("transacciones")
      .insert(serializar(t) as Database["public"]["Tables"]["transacciones"]["Insert"])
      .select("*")
      .single();
    // 23505 = unique_violation en idempotency_key → devolver la existente.
    if (r.error?.code === "23505") {
      const previa = await this.transaccionPorIdempotencia(t.idempotency_key);
      if (previa) return { transaccion: previa, creada: false };
    }
    return { transaccion: aTransaccion(ok(r, "crearTransaccion")), creada: true };
  }
  async transaccion(id: string) {
    const r = opt(await this.db.from("transacciones").select("*").eq("id", id).maybeSingle(), "transaccion");
    return r ? aTransaccion(r) : null;
  }
  async transaccionPorIdempotencia(key: string) {
    const r = opt(
      await this.db.from("transacciones").select("*").eq("idempotency_key", key).maybeSingle(),
      "transaccionPorIdempotencia",
    );
    return r ? aTransaccion(r) : null;
  }
  async transaccionPorPeyId(peyId: string) {
    const r = opt(await this.db.from("transacciones").select("*").eq("pey_id", peyId).maybeSingle(), "transaccionPorPeyId");
    return r ? aTransaccion(r) : null;
  }
  async transaccionPorCodiId(codiId: string) {
    const r = opt(
      await this.db
        .from("transacciones")
        .select("*")
        .eq("pey_codi_id", codiId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "transaccionPorCodiId",
    );
    return r ? aTransaccion(r) : null;
  }
  async transicionarTransaccion(
    id: string,
    desde: readonly Transaccion["estado"][],
    cambios: Parameters<Repositorio["transicionarTransaccion"]>[2],
  ) {
    // UPDATE ... WHERE id = $1 AND estado IN (...) → atómico en Postgres.
    const r = opt(
      await this.db
        .from("transacciones")
        .update(serializar(cambios) as Database["public"]["Tables"]["transacciones"]["Update"])
        .eq("id", id)
        .in("estado", [...desde])
        .select("*")
        .maybeSingle(),
      "transicionarTransaccion",
    );
    return r ? aTransaccion(r) : null;
  }
  async transaccionesDeComercio(comercioId: string, desde?: Date) {
    let q = this.db
      .from("transacciones")
      .select("*")
      .eq("comercio_id", comercioId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (desde) q = q.gte("created_at", desde.toISOString());
    return ok(await q, "transaccionesDeComercio").map(aTransaccion);
  }
  async transaccionesDeUsuario(usuarioId: string) {
    return ok(
      await this.db
        .from("transacciones")
        .select("*")
        .eq("pagador_id", usuarioId)
        .order("created_at", { ascending: false })
        .limit(100),
      "transaccionesDeUsuario",
    ).map(aTransaccion);
  }
  async usosHoy(credencialId: string, convenioId: string) {
    return ok(
      await this.db.rpc("usos_hoy", { p_credencial_id: credencialId, p_convenio_id: convenioId }),
      "usosHoy",
    );
  }

  // ---------- Webhooks ----------
  async registrarWebhook(e: Pick<WebhookEvento, "id" | "tipo" | "payload">) {
    const r = await this.db
      .from("webhook_eventos")
      .insert({ id: e.id, tipo: e.tipo, payload: e.payload as Database["public"]["Tables"]["webhook_eventos"]["Insert"]["payload"] });
    if (r.error?.code === "23505") return false;
    sinError(r, "registrarWebhook");
    return true;
  }
  async marcarWebhook(id: string, cambios: Parameters<Repositorio["marcarWebhook"]>[1]) {
    sinError(
      await this.db
        .from("webhook_eventos")
        .update(serializar(cambios) as Database["public"]["Tables"]["webhook_eventos"]["Update"])
        .eq("id", id),
      "marcarWebhook",
    );
  }
  async webhook(id: string) {
    const r = opt(await this.db.from("webhook_eventos").select("*").eq("id", id).maybeSingle(), "webhook");
    return r ? aWebhook(r) : null;
  }

  // ---------- Notificaciones ----------
  async notificar(n: Parameters<Repositorio["notificar"]>[0]) {
    const r = ok(
      await this.db
        .from("notificaciones")
        .insert({ ...n, datos: (n.datos ?? {}) as Database["public"]["Tables"]["notificaciones"]["Insert"]["datos"] })
        .select("*")
        .single(),
      "notificar",
    );
    return aNotificacion(r);
  }
  async notificaciones(usuarioId: string) {
    return ok(
      await this.db
        .from("notificaciones")
        .select("*")
        .eq("usuario_id", usuarioId)
        .order("created_at", { ascending: false })
        .limit(50),
      "notificaciones",
    ).map(aNotificacion);
  }
  async marcarLeidas(usuarioId: string, ids?: string[]) {
    let q = this.db.from("notificaciones").update({ leida: true }).eq("usuario_id", usuarioId).eq("leida", false);
    if (ids?.length) q = q.in("id", ids);
    sinError(await q, "marcarLeidas");
  }

  // ---------- Reportes ----------
  /**
   * Agregados por día y convenio (mismo cálculo que la función SQL `reporte_emisor`, que usa
   * `auth.uid()`; aquí corre con service_role y el emisor se pasa explícito).
   */
  async reporteEmisor(emisorId: string, desde: string, hasta: string) {
    const convenios = ok(await this.db.from("convenios").select("id, nombre").eq("emisor_id", emisorId), "reporteConvenios");
    if (!convenios.length) return [];
    const nombre = new Map(convenios.map((c) => [c.id, c.nombre]));
    // Margen de un día por zona horaria; el filtro exacto se hace en CDMX abajo.
    const txs = ok(
      await this.db
        .from("transacciones")
        .select("convenio_id, descuento_centavos, monto_final_centavos, metodo, pagada_en")
        .eq("estado", "pagada")
        .in("convenio_id", [...nombre.keys()])
        .gte("pagada_en", new Date(`${desde}T00:00:00-06:00`).toISOString())
        .lte("pagada_en", new Date(new Date(`${hasta}T23:59:59-06:00`).getTime() + 86_400_000).toISOString()),
      "reporteTransacciones",
    );
    const filas = new Map<string, FilaReporteEmisor>();
    for (const t of txs) {
      if (!t.pagada_en || !t.convenio_id) continue;
      const dia = fechaCdmx(new Date(t.pagada_en));
      if (dia < desde || dia > hasta) continue;
      const k = `${dia}|${t.convenio_id}`;
      const f = filas.get(k) ?? {
        dia,
        convenio_id: t.convenio_id,
        convenio: nombre.get(t.convenio_id) ?? "",
        usos: 0,
        descuento_centavos: 0,
        venta_centavos: 0,
        efectivo: 0,
        codi: 0,
      };
      f.usos++;
      f.descuento_centavos += Number(t.descuento_centavos);
      f.venta_centavos += Number(t.monto_final_centavos);
      if (t.metodo === "efectivo") f.efectivo++;
      else f.codi++;
      filas.set(k, f);
    }
    return [...filas.values()].sort((a, b) => a.dia.localeCompare(b.dia) || a.convenio.localeCompare(b.convenio));
  }

  // ---------- Storage ----------
  async subirDocumento(path: string, bytes: Uint8Array, mime: string) {
    const { error } = await this.db.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`[db] subirDocumento: ${error.message}`);
  }
  async descargarDocumento(path: string) {
    const { data, error } = await this.db.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type || "application/octet-stream" };
  }
  async borrarDocumento(path: string) {
    const { error } = await this.db.storage.from(BUCKET).remove([path]);
    if (error) throw new Error(`[db] borrarDocumento: ${error.message}`);
  }
}
