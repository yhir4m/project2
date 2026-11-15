import type { CambioRepo, Repositorio } from "../repo";
import type {
  Comercio,
  ComercioConvenio,
  Convenio,
  Credencial,
  Emisor,
  FilaReporteEmisor,
  Notificacion,
  Perfil,
  Producto,
  Transaccion,
  Verificacion,
  WebhookEvento,
} from "../types";
import { fechaCdmx } from "../fechas";
import { datosSemilla } from "./seed";

const clonar = <T>(x: T): T => structuredClone(x);

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

function seudonimo(): string {
  const b = new Uint8Array(12);
  globalThis.crypto.getRandomValues(b);
  return "ps_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Implementación en memoria del repositorio. Emula:
 * - restricciones únicas (idempotency_key, pey_id, credencial activa por usuario/emisor/tipo, webhook-id, nonce)
 * - funciones atómicas (JS es de un solo hilo: cada método es atómico respecto a los demás)
 * - Realtime (suscripciones a cambios de transacciones y notificaciones)
 * Devuelve copias para que nadie mute el estado interno por accidente.
 */
export class RepositorioMemoria implements Repositorio {
  private emisoresT: Emisor[];
  private conveniosT: Convenio[];
  private comerciosT: Comercio[];
  private comercioConveniosT: ComercioConvenio[];
  private productosT: Producto[];
  private perfilesT: Perfil[];
  private verificacionesT: Verificacion[];
  private credencialesT: Credencial[];
  private nonces = new Map<string, Date>();
  private rate = new Map<string, number>();
  private transaccionesT: Transaccion[] = [];
  private webhooksT = new Map<string, WebhookEvento>();
  private notificacionesT: Notificacion[] = [];
  private oyentes = new Set<(c: CambioRepo) => void>();

  constructor(private readonly reloj: () => Date = () => new Date()) {
    const s = datosSemilla();
    this.emisoresT = s.emisores;
    this.conveniosT = s.convenios;
    this.comerciosT = s.comercios;
    this.comercioConveniosT = s.comercioConvenios;
    this.productosT = s.productos;
    this.perfilesT = s.perfiles;
    this.verificacionesT = s.verificaciones;
    this.credencialesT = s.credenciales;
  }

  private emitir(c: CambioRepo) {
    for (const o of this.oyentes) {
      try {
        o(clonar(c));
      } catch {
        /* un oyente roto no tumba a los demás */
      }
    }
  }

  // ---------- Catálogo ----------
  async emisores() {
    return clonar(this.emisoresT.filter((e) => e.activo));
  }
  async emisor(id: string) {
    return clonar(this.emisoresT.find((e) => e.id === id) ?? null);
  }
  async convenios(f: { emisorId?: string; incluirInactivos?: boolean } = {}) {
    return clonar(
      this.conveniosT.filter(
        (c) => (!f.emisorId || c.emisor_id === f.emisorId) && (f.incluirInactivos || c.activo),
      ),
    );
  }
  async convenio(id: string) {
    return clonar(this.conveniosT.find((c) => c.id === id) ?? null);
  }
  async guardarConvenio(c: Parameters<Repositorio["guardarConvenio"]>[0]) {
    const ahora = this.reloj();
    const nuevo: Convenio = {
      activo: true,
      descripcion: null,
      vigente_hasta: null,
      ...c,
      id: uuid(),
      created_at: ahora,
      updated_at: ahora,
    };
    this.conveniosT.push(nuevo);
    return clonar(nuevo);
  }
  async actualizarConvenio(id: string, cambios: Parameters<Repositorio["actualizarConvenio"]>[1]) {
    const c = this.conveniosT.find((x) => x.id === id);
    if (!c) throw new Error("Convenio no encontrado");
    Object.assign(c, cambios, { updated_at: this.reloj() });
    return clonar(c);
  }
  async comercios() {
    return clonar(this.comerciosT.filter((c) => c.activo));
  }
  async comercio(id: string) {
    return clonar(this.comerciosT.find((c) => c.id === id) ?? null);
  }
  async conveniosDeComercio(comercioId: string) {
    const ids = new Set(
      this.comercioConveniosT.filter((x) => x.comercio_id === comercioId).map((x) => x.convenio_id),
    );
    return clonar(this.conveniosT.filter((c) => ids.has(c.id) && c.activo));
  }
  async comerciosDeConvenio(convenioId: string) {
    const ids = new Set(
      this.comercioConveniosT.filter((x) => x.convenio_id === convenioId).map((x) => x.comercio_id),
    );
    return clonar(this.comerciosT.filter((c) => ids.has(c.id) && c.activo));
  }
  async productos(comercioId: string) {
    return clonar(this.productosT.filter((p) => p.comercio_id === comercioId && p.activo));
  }
  async buscarConvenio({
    emisorId,
    tipoBeneficiario,
    comercioId,
  }: {
    emisorId: string;
    tipoBeneficiario: string;
    comercioId: string;
  }) {
    const com = this.comerciosT.find((c) => c.id === comercioId && c.activo);
    if (!com) return null;
    const hoy = fechaCdmx(this.reloj());
    const ligados = new Set(
      this.comercioConveniosT.filter((x) => x.comercio_id === comercioId).map((x) => x.convenio_id),
    );
    const c = this.conveniosT
      .filter(
        (c) =>
          ligados.has(c.id) &&
          c.emisor_id === emisorId &&
          c.tipo_beneficiario === tipoBeneficiario &&
          c.activo &&
          c.vigente_desde <= hoy &&
          (c.vigente_hasta === null || c.vigente_hasta >= hoy),
      )
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0];
    return clonar(c ?? null);
  }

  // ---------- Usuarios ----------
  async perfil(id: string) {
    return clonar(this.perfilesT.find((p) => p.id === id) ?? null);
  }
  async perfilPorEmail(email: string) {
    const e = email.trim().toLowerCase();
    return clonar(this.perfilesT.find((p) => p.email === e) ?? null);
  }
  async crearPerfil({ email }: { email: string }) {
    const e = email.trim().toLowerCase();
    if (this.perfilesT.some((p) => p.email === e)) throw new Error("Correo ya registrado");
    const ahora = this.reloj();
    const p: Perfil = {
      id: uuid(),
      email: e,
      rol: "beneficiario",
      nombre: null,
      celular: null,
      emisor_id: null,
      comercio_id: null,
      letra_grande: false,
      consentimiento_at: null,
      created_at: ahora,
      updated_at: ahora,
    };
    this.perfilesT.push(p);
    return clonar(p);
  }
  async actualizarPerfil(id: string, cambios: Parameters<Repositorio["actualizarPerfil"]>[1]) {
    const p = this.perfilesT.find((x) => x.id === id);
    if (!p) throw new Error("Perfil no encontrado");
    if (
      cambios.celular !== undefined &&
      cambios.celular !== null &&
      !/^[0-9]{10}$/.test(cambios.celular)
    ) {
      throw new Error("Celular inválido");
    }
    Object.assign(p, cambios, { updated_at: this.reloj() });
    return clonar(p);
  }
  async perfilesDemo() {
    return clonar(this.perfilesT.filter((p) => p.email.endsWith("@cdv.demo")));
  }

  // ---------- Verificaciones ----------
  async crearVerificacion(v: Parameters<Repositorio["crearVerificacion"]>[0]) {
    const ahora = this.reloj();
    const n: Verificacion = {
      revisado_por: null,
      revisado_at: null,
      motivos: [],
      ...v,
      id: uuid(),
      created_at: ahora,
      updated_at: ahora,
    };
    this.validarVerificacion(n);
    this.verificacionesT.push(n);
    return clonar(n);
  }
  async verificacion(id: string) {
    return clonar(this.verificacionesT.find((v) => v.id === id) ?? null);
  }
  async verificacionesDeUsuario(usuarioId: string) {
    return clonar(this.verificacionesT.filter((v) => v.usuario_id === usuarioId).sort(recientes));
  }
  async colaRevision(emisorId: string) {
    return clonar(
      this.verificacionesT
        .filter((v) => v.emisor_id === emisorId && v.estado === "revision_manual")
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime()),
    );
  }
  async actualizarVerificacion(
    id: string,
    cambios: Parameters<Repositorio["actualizarVerificacion"]>[1],
  ) {
    const v = this.verificacionesT.find((x) => x.id === id);
    if (!v) throw new Error("Verificación no encontrada");
    const nueva = { ...v, ...cambios, updated_at: this.reloj() };
    this.validarVerificacion(nueva);
    Object.assign(v, nueva);
    return clonar(v);
  }
  /** Igual que el CHECK de SQL: al resolver no pueden quedar documento ni nombre. */
  private validarVerificacion(v: Verificacion) {
    if (
      (v.estado === "aprobada" || v.estado === "rechazada") &&
      (v.documento_path || v.nombre_declarado)
    ) {
      throw new Error("Una verificación resuelta no puede conservar documento ni nombre");
    }
  }

  // ---------- Credenciales ----------
  async crearCredencial(c: Parameters<Repositorio["crearCredencial"]>[0]) {
    const ahora = this.reloj();
    if (
      this.credencialesT.some(
        (x) =>
          x.usuario_id === c.usuario_id &&
          x.emisor_id === c.emisor_id &&
          x.tipo_beneficiario === c.tipo_beneficiario &&
          x.estado === "activa",
      )
    ) {
      throw new Error("Ya existe una credencial activa para este emisor");
    }
    const n: Credencial = {
      seudonimo: seudonimo(),
      estado: "activa",
      vigente_desde: ahora,
      dispositivo_hash: null,
      jws: null,
      revocada_at: null,
      motivo_revocacion: null,
      ...c,
      id: uuid(),
      created_at: ahora,
    };
    if (n.vigente_hasta.getTime() <= n.vigente_desde.getTime())
      throw new Error("Vigencia inválida");
    this.credencialesT.push(n);
    return clonar(n);
  }
  async credencial(id: string) {
    return clonar(this.credencialesT.find((c) => c.id === id) ?? null);
  }
  async credencialesDeUsuario(usuarioId: string) {
    return clonar(this.credencialesT.filter((c) => c.usuario_id === usuarioId).sort(recientes));
  }
  async credencialesDeEmisor(emisorId: string) {
    return clonar(this.credencialesT.filter((c) => c.emisor_id === emisorId).sort(recientes));
  }
  async actualizarCredencial(
    id: string,
    cambios: Parameters<Repositorio["actualizarCredencial"]>[1],
  ) {
    const c = this.credencialesT.find((x) => x.id === id);
    if (!c) throw new Error("Credencial no encontrada");
    if (cambios.estado === "revocada" && !(cambios.revocada_at ?? c.revocada_at))
      throw new Error("Falta revocada_at");
    Object.assign(c, cambios);
    return clonar(c);
  }

  // ---------- Antirreplay / rate limit ----------
  async consumirNonce(nonce: string, expiraEn: Date) {
    const ahora = this.reloj().getTime();
    for (const [n, exp] of this.nonces)
      if (exp.getTime() < ahora - 3_600_000) this.nonces.delete(n);
    if (this.nonces.has(nonce)) return false;
    this.nonces.set(nonce, expiraEn);
    return true;
  }
  async rateLimit(clave: string, limite: number, ventanaSeg: number) {
    const ventana = Math.floor(this.reloj().getTime() / 1000 / ventanaSeg);
    const k = `${clave}|${ventanaSeg}|${ventana}`;
    const n = (this.rate.get(k) ?? 0) + 1;
    this.rate.set(k, n);
    return n <= limite;
  }

  // ---------- Transacciones ----------
  async crearTransaccion(t: Parameters<Repositorio["crearTransaccion"]>[0]) {
    const existente = this.transaccionesT.find((x) => x.idempotency_key === t.idempotency_key);
    if (existente) return { transaccion: clonar(existente), creada: false };
    if (t.monto_final_centavos !== t.precio_original_centavos - t.descuento_centavos)
      throw new Error("Montos inconsistentes");
    if (t.metodo === "codi" && !t.canal) throw new Error("CoDi requiere canal");
    const ahora = this.reloj();
    const n: Transaccion = {
      estado: "creando",
      pey_id: null,
      pey_codi_id: null,
      pey_qr_string: null,
      pey_num_ref: null,
      expira_en: null,
      pagada_en: null,
      error: null,
      ...t,
      id: uuid(),
      created_at: ahora,
      updated_at: ahora,
    };
    this.transaccionesT.push(n);
    this.emitir({ tabla: "transacciones", fila: n });
    return { transaccion: clonar(n), creada: true };
  }
  async transaccion(id: string) {
    return clonar(this.transaccionesT.find((t) => t.id === id) ?? null);
  }
  async transaccionPorPeyId(peyId: string) {
    return clonar(this.transaccionesT.find((t) => t.pey_id === peyId) ?? null);
  }
  async transaccionPorCodiId(codiId: string) {
    return clonar(this.transaccionesT.find((t) => t.pey_codi_id === codiId) ?? null);
  }
  async transicionarTransaccion(
    id: string,
    desde: readonly Transaccion["estado"][],
    cambios: Parameters<Repositorio["transicionarTransaccion"]>[2],
  ) {
    const t = this.transaccionesT.find((x) => x.id === id);
    if (!t || !desde.includes(t.estado)) return null;
    if (
      cambios.pey_id &&
      this.transaccionesT.some((x) => x.id !== id && x.pey_id === cambios.pey_id)
    ) {
      throw new Error("pey_id duplicado");
    }
    Object.assign(t, cambios, { updated_at: this.reloj() });
    this.emitir({ tabla: "transacciones", fila: t });
    return clonar(t);
  }
  async transaccionesDeComercio(comercioId: string, desde?: Date) {
    return clonar(
      this.transaccionesT
        .filter(
          (t) =>
            t.comercio_id === comercioId && (!desde || t.created_at.getTime() >= desde.getTime()),
        )
        .sort(recientes),
    );
  }
  async transaccionesDeUsuario(usuarioId: string) {
    const mias = new Set(
      this.credencialesT.filter((c) => c.usuario_id === usuarioId).map((c) => c.id),
    );
    return clonar(this.transaccionesT.filter((t) => mias.has(t.credencial_id)).sort(recientes));
  }
  async transaccionesVencidas(ahora: Date) {
    return clonar(
      this.transaccionesT.filter(
        (t) =>
          ["pendiente", "incierta", "creando"].includes(t.estado) &&
          t.expira_en &&
          t.expira_en.getTime() < ahora.getTime(),
      ),
    );
  }
  async usosHoy(credencialId: string, convenioId: string) {
    const hoy = fechaCdmx(this.reloj());
    return this.transaccionesT.filter(
      (t) =>
        t.credencial_id === credencialId &&
        t.convenio_id === convenioId &&
        t.descuento_centavos > 0 &&
        ["creando", "pendiente", "incierta", "pagada"].includes(t.estado) &&
        fechaCdmx(t.created_at) === hoy,
    ).length;
  }

  // ---------- Webhooks ----------
  async registrarWebhook(e: Pick<WebhookEvento, "id" | "tipo" | "payload">) {
    if (this.webhooksT.has(e.id)) return false;
    this.webhooksT.set(e.id, {
      ...clonar(e),
      transaccion_id: null,
      procesado: false,
      procesado_at: null,
      error: null,
      recibido_at: this.reloj(),
    });
    return true;
  }
  async marcarWebhook(id: string, cambios: Parameters<Repositorio["marcarWebhook"]>[1]) {
    const w = this.webhooksT.get(id);
    if (w) Object.assign(w, cambios);
  }
  async webhook(id: string) {
    return clonar(this.webhooksT.get(id) ?? null);
  }

  // ---------- Notificaciones ----------
  async notificar(n: Parameters<Repositorio["notificar"]>[0]) {
    const nueva: Notificacion = {
      datos: {},
      ...n,
      id: uuid(),
      leida: false,
      created_at: this.reloj(),
    };
    this.notificacionesT.push(nueva);
    this.emitir({ tabla: "notificaciones", fila: nueva });
    return clonar(nueva);
  }
  async notificaciones(usuarioId: string) {
    return clonar(
      this.notificacionesT
        .filter((n) => n.usuario_id === usuarioId)
        .sort(recientes)
        .slice(0, 50),
    );
  }
  async marcarLeidas(usuarioId: string, ids?: string[]) {
    for (const n of this.notificacionesT)
      if (n.usuario_id === usuarioId && (!ids || ids.includes(n.id))) n.leida = true;
  }

  // ---------- Reportes ----------
  async reporteEmisor(emisorId: string, desde: string, hasta: string) {
    const conv = new Map(
      this.conveniosT.filter((c) => c.emisor_id === emisorId).map((c) => [c.id, c]),
    );
    const filas = new Map<string, FilaReporteEmisor>();
    for (const t of this.transaccionesT) {
      const c = conv.get(t.convenio_id);
      if (!c || t.estado !== "pagada" || !t.pagada_en) continue;
      const dia = fechaCdmx(t.pagada_en);
      if (dia < desde || dia > hasta) continue;
      const k = `${dia}|${c.id}`;
      const f = filas.get(k) ?? {
        dia,
        convenio_id: c.id,
        convenio: c.nombre,
        usos: 0,
        descuento_centavos: 0,
        venta_centavos: 0,
        efectivo: 0,
        codi: 0,
      };
      f.usos++;
      f.descuento_centavos += t.descuento_centavos;
      f.venta_centavos += t.monto_final_centavos;
      if (t.metodo === "efectivo") f.efectivo++;
      else f.codi++;
      filas.set(k, f);
    }
    return [...filas.values()].sort(
      (a, b) => a.dia.localeCompare(b.dia) || a.convenio.localeCompare(b.convenio),
    );
  }

  // ---------- Realtime ----------
  suscribir(cb: (c: CambioRepo) => void) {
    this.oyentes.add(cb);
    return () => {
      this.oyentes.delete(cb);
    };
  }
}

function recientes(a: { created_at: Date }, b: { created_at: Date }) {
  return b.created_at.getTime() - a.created_at.getTime();
}
