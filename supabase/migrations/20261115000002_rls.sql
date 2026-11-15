-- =============================================================================
-- RLS: cada rol ve solo lo suyo. TODAS las escrituras pasan por la API (service_role),
-- que valida con zod y aplica reglas de negocio; los clientes solo leen.
-- =============================================================================

-- Helpers (security definer + search_path vacío; leen el perfil del usuario actual).
create or replace function public.mi_rol() returns public.rol_usuario
language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = (select auth.uid())
$$;

create or replace function public.mi_emisor_id() returns text
language sql stable security definer set search_path = '' as $$
  select emisor_id from public.perfiles where id = (select auth.uid()) and rol = 'emisor'
$$;

create or replace function public.mi_comercio_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select comercio_id from public.perfiles where id = (select auth.uid()) and rol = 'comercio'
$$;

revoke execute on function public.mi_rol(), public.mi_emisor_id(), public.mi_comercio_id() from public, anon;
grant execute on function public.mi_rol(), public.mi_emisor_id(), public.mi_comercio_id() to authenticated;

alter table public.emisores            enable row level security;
alter table public.convenios           enable row level security;
alter table public.comercios           enable row level security;
alter table public.comercio_convenios  enable row level security;
alter table public.productos           enable row level security;
alter table public.perfiles            enable row level security;
alter table public.verificaciones      enable row level security;
alter table public.credenciales        enable row level security;
alter table public.nonces_usados       enable row level security;
alter table public.transacciones       enable row level security;
alter table public.webhook_eventos     enable row level security;
alter table public.notificaciones      enable row level security;
alter table public.rate_limits         enable row level security;

-- Catálogo público (sin datos personales): emisores, convenios, comercios, productos.
create policy "catálogo: emisores visibles" on public.emisores
  for select to anon, authenticated using (activo);
create policy "catálogo: convenios activos" on public.convenios
  for select to anon, authenticated using (activo or emisor_id = (select public.mi_emisor_id()));
create policy "catálogo: comercios activos" on public.comercios
  for select to anon, authenticated using (activo);
create policy "catálogo: comercio_convenios" on public.comercio_convenios
  for select to anon, authenticated using (true);
create policy "catálogo: productos" on public.productos
  for select to anon, authenticated using (activo or comercio_id = (select public.mi_comercio_id()));

-- Perfil: solo el propio.
create policy "perfil propio" on public.perfiles
  for select to authenticated using (id = (select auth.uid()));

-- Verificaciones: el usuario ve las suyas; el emisor ve las de su institución (cola de revisión).
create policy "verificaciones propias" on public.verificaciones
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy "verificaciones del emisor" on public.verificaciones
  for select to authenticated using (emisor_id = (select public.mi_emisor_id()));

-- Credenciales: el beneficiario ve las suyas; el emisor ve las que emitió (seudónimo, sin nombre).
create policy "credenciales propias" on public.credenciales
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy "credenciales del emisor" on public.credenciales
  for select to authenticated using (emisor_id = (select public.mi_emisor_id()));

-- Transacciones: el comercio ve las suyas; el beneficiario ve las de sus credenciales.
-- (El emisor solo ve agregados vía reporte_emisor()).
create policy "transacciones del comercio" on public.transacciones
  for select to authenticated using (comercio_id = (select public.mi_comercio_id()));
create policy "transacciones del beneficiario" on public.transacciones
  for select to authenticated using (
    exists (select 1 from public.credenciales c
            where c.id = transacciones.credencial_id and c.usuario_id = (select auth.uid()))
  );

-- Notificaciones: propias; se pueden marcar como leídas.
create policy "notificaciones propias" on public.notificaciones
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy "marcar notificaciones leídas" on public.notificaciones
  for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
revoke update on public.notificaciones from authenticated;
grant update (leida) on public.notificaciones to authenticated;

-- nonces_usados, webhook_eventos, rate_limits: RLS activo y SIN políticas → solo service_role.

-- Defensa en profundidad: los clientes no escriben directo en tablas de negocio.
revoke insert, update, delete on
  public.emisores, public.convenios, public.comercios, public.comercio_convenios, public.productos,
  public.perfiles, public.verificaciones, public.credenciales, public.nonces_usados,
  public.transacciones, public.webhook_eventos, public.rate_limits
from anon, authenticated;
revoke insert, delete on public.notificaciones from anon, authenticated;
revoke all on public.nonces_usados, public.webhook_eventos, public.rate_limits from anon, authenticated;
