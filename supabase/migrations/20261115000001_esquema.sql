-- =============================================================================
-- Cobro con descuento verificado: esquema base
-- Dinero SIEMPRE en centavos enteros (bigint). Fechas en timestamptz.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tipos ----------
create type public.rol_usuario as enum ('beneficiario', 'comercio', 'emisor');
create type public.tipo_periodo as enum ('cuatrimestre', 'semestre', 'anual');
create type public.metodo_verificacion as enum ('correo_institucional', 'documento_ia', 'externo');
create type public.estado_verificacion as enum ('pendiente', 'aprobada', 'rechazada', 'revision_manual');
create type public.estado_credencial as enum ('activa', 'revocada', 'vencida');
create type public.metodo_pago as enum ('codi', 'efectivo');
create type public.canal_codi as enum ('pn', 'qr');
create type public.estado_transaccion as enum
  ('creando', 'pendiente', 'incierta', 'pagada', 'expirada', 'cancelada', 'fallida');

-- ---------- updated_at ----------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Emisores (instituciones) ----------
create table public.emisores (
  id                    text primary key check (id ~ '^[a-z0-9_]{2,32}$'),
  nombre                text not null,
  nombre_corto          text not null,
  tipo_periodo          public.tipo_periodo not null default 'cuatrimestre',
  dominios_correo       text[] not null default '{}',
  palabras_institucion  text[] not null default '{}',   -- para validar el documento con IA
  tipos_documento       text[] not null default '{}',   -- tipos aceptados (ver core/ExtraccionDocumento)
  tipos_beneficiario    text[] not null default '{}',
  llave_publica         text,                           -- SPKI base64 (Ed25519). La privada vive solo en env.
  activo                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ---------- Convenios ----------
create table public.convenios (
  id                 uuid primary key default gen_random_uuid(),
  emisor_id          text not null references public.emisores(id),
  nombre             text not null,
  descripcion        text,
  tipo_beneficiario  text not null,
  regla              jsonb not null,           -- validada con zod (core/ReglaConvenioSchema) antes de guardar
  vigente_desde      date not null default current_date,
  vigente_hasta      date,
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (jsonb_typeof(regla) = 'object' and regla ? 'tipo' and regla ? 'valor'),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);
create index convenios_emisor_idx on public.convenios (emisor_id, tipo_beneficiario) where activo;
create trigger convenios_updated before update on public.convenios
  for each row execute function public.tg_set_updated_at();

-- ---------- Comercios ----------
create table public.comercios (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  giro                  text,
  direccion             text,
  lat                   double precision,
  lng                   double precision,
  pey_bank_account_id   text,             -- cuenta receptora en Pey (opcional; default = cuenta de la API key)
  activo                boolean not null default true,
  created_at            timestamptz not null default now()
);

create table public.comercio_convenios (
  comercio_id  uuid not null references public.comercios(id) on delete cascade,
  convenio_id  uuid not null references public.convenios(id) on delete cascade,
  primary key (comercio_id, convenio_id)
);
create index comercio_convenios_convenio_idx on public.comercio_convenios (convenio_id);

create table public.productos (
  id               uuid primary key default gen_random_uuid(),
  comercio_id      uuid not null references public.comercios(id) on delete cascade,
  sku              text not null,
  nombre           text not null,
  precio_centavos  bigint not null check (precio_centavos >= 0),
  activo           boolean not null default true,
  unique (comercio_id, sku)
);

-- ---------- Perfiles (1:1 con auth.users) ----------
create table public.perfiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  rol                 public.rol_usuario not null default 'beneficiario',
  nombre              text,                       -- solo para mostrarse al propio usuario
  celular             text check (celular is null or celular ~ '^[0-9]{10}$'),  -- para CoDi PN; nunca sale al comercio
  emisor_id           text references public.emisores(id),   -- si rol = emisor
  comercio_id         uuid references public.comercios(id),  -- si rol = comercio
  letra_grande        boolean not null default false,
  consentimiento_at   timestamptz,                -- aviso de privacidad aceptado
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (rol <> 'emisor' or emisor_id is not null),
  check (rol <> 'comercio' or comercio_id is not null)
);
create trigger perfiles_updated before update on public.perfiles
  for each row execute function public.tg_set_updated_at();

-- Crea el perfil al registrarse.
create or replace function public.tg_crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_crear_perfil();

-- ---------- Verificaciones de elegibilidad ----------
-- Al resolverse se borran el documento y el nombre declarado: solo queda el resultado.
create table public.verificaciones (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users(id) on delete cascade,
  emisor_id           text not null references public.emisores(id),
  tipo_beneficiario   text not null,
  metodo              public.metodo_verificacion not null,
  estado              public.estado_verificacion not null default 'pendiente',
  confianza           numeric(4,3) check (confianza is null or (confianza >= 0 and confianza <= 1)),
  motivos             text[] not null default '{}',
  nombre_declarado    text,     -- temporal (revisión manual); se borra al resolver
  documento_path      text,     -- temporal en Storage; se borra al resolver
  revisado_por        uuid references auth.users(id),
  revisado_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (estado in ('pendiente', 'revision_manual') or (documento_path is null and nombre_declarado is null))
);
create index verificaciones_cola_idx on public.verificaciones (emisor_id, created_at) where estado = 'revision_manual';
create index verificaciones_usuario_idx on public.verificaciones (usuario_id, created_at desc);
create trigger verificaciones_updated before update on public.verificaciones
  for each row execute function public.tg_set_updated_at();

-- ---------- Credenciales ----------
create table public.credenciales (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users(id) on delete cascade,
  seudonimo           text not null unique default ('ps_' || encode(extensions.gen_random_bytes(12), 'hex')),
  emisor_id           text not null references public.emisores(id),
  tipo_beneficiario   text not null,
  verificacion_id     uuid references public.verificaciones(id) on delete set null,
  estado              public.estado_credencial not null default 'activa',
  vigente_desde       timestamptz not null default now(),
  vigente_hasta       timestamptz not null,
  dispositivo_hash    text,          -- se liga al primer dispositivo que genera QR
  jws                 text,          -- credencial firmada (EdDSA)
  revocada_at         timestamptz,
  motivo_revocacion   text,
  created_at          timestamptz not null default now(),
  check (vigente_hasta > vigente_desde),
  check (estado <> 'revocada' or revocada_at is not null)
);
-- Una sola credencial activa por usuario, emisor y tipo.
create unique index credenciales_una_activa on public.credenciales (usuario_id, emisor_id, tipo_beneficiario)
  where estado = 'activa';
create index credenciales_emisor_idx on public.credenciales (emisor_id, estado);

-- ---------- Antirreplay ----------
create table public.nonces_usados (
  nonce      text primary key,
  expira_en  timestamptz not null,
  usado_en   timestamptz not null default now()
);
create index nonces_expira_idx on public.nonces_usados (expira_en);

-- ---------- Transacciones ----------
create table public.transacciones (
  id                        uuid primary key default gen_random_uuid(),
  idempotency_key           text not null unique,
  comercio_id               uuid not null references public.comercios(id),
  credencial_id             uuid not null references public.credenciales(id),
  convenio_id               uuid not null references public.convenios(id),
  compra                    jsonb not null,             -- { tipo: monto | productos, ... }
  precio_original_centavos  bigint not null check (precio_original_centavos > 0),
  descuento_centavos        bigint not null check (descuento_centavos >= 0),
  monto_final_centavos      bigint not null check (monto_final_centavos >= 0),
  monto_cobrado_centavos    bigint not null check (monto_cobrado_centavos >= 0),  -- != final en modo prueba
  metodo                    public.metodo_pago not null,
  canal                     public.canal_codi,
  estado                    public.estado_transaccion not null default 'creando',
  modo_prueba               boolean not null,
  pey_id                    text unique,     -- transactionId de Pey
  pey_codi_id               text,            -- codiId (PN) o IDC del QR
  pey_qr_string             text,            -- solo canal qr
  pey_num_ref               text,
  expira_en                 timestamptz,
  pagada_en                 timestamptz,
  error                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (descuento_centavos <= precio_original_centavos),
  check (monto_final_centavos = precio_original_centavos - descuento_centavos),
  check (metodo = 'efectivo' or canal is not null),
  check (metodo = 'codi' or (canal is null and pey_id is null))
);
create index transacciones_comercio_idx on public.transacciones (comercio_id, created_at desc);
create index transacciones_credencial_idx on public.transacciones (credencial_id, created_at desc);
create index transacciones_convenio_idx on public.transacciones (convenio_id, created_at);
create index transacciones_codi_idx on public.transacciones (pey_codi_id) where pey_codi_id is not null;
create index transacciones_pendientes_idx on public.transacciones (expira_en) where estado in ('pendiente', 'incierta', 'creando');
create trigger transacciones_updated before update on public.transacciones
  for each row execute function public.tg_set_updated_at();

-- ---------- Webhooks ----------
create table public.webhook_eventos (
  id              text primary key,         -- encabezado webhook-id (llave de idempotencia de Pey)
  tipo            text not null,
  payload         jsonb not null,
  transaccion_id  uuid references public.transacciones(id),
  procesado       boolean not null default false,
  procesado_at    timestamptz,
  error           text,
  recibido_at     timestamptz not null default now()
);

-- ---------- Notificaciones in-app ----------
create table public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  cuerpo      text,
  datos       jsonb not null default '{}',
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notificaciones_usuario_idx on public.notificaciones (usuario_id, created_at desc);

-- ---------- Rate limiting (ventana fija) ----------
create table public.rate_limits (
  clave    text not null,
  ventana  timestamptz not null,
  conteo   integer not null default 0,
  primary key (clave, ventana)
);
