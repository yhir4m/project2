-- =============================================================================
-- Flujo invertido: el COMERCIO genera la solicitud de cobro (QR en su pantalla)
-- y el CLIENTE la escanea con la app para aplicar su descuento y pagar.
-- =============================================================================

create type public.estado_solicitud as enum ('abierta', 'tomada', 'pagada', 'cancelada', 'expirada');

create table public.solicitudes_cobro (
  id               uuid primary key default gen_random_uuid(),
  comercio_id      uuid not null references public.comercios(id),
  compra           jsonb not null,                     -- { tipo: monto | productos, ... }
  total_centavos   bigint not null check (total_centavos > 0),
  estado           public.estado_solicitud not null default 'abierta',
  transaccion_id   uuid references public.transacciones(id),
  expira_en        timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (estado <> 'pagada' or transaccion_id is not null)
);
create index solicitudes_comercio_idx on public.solicitudes_cobro (comercio_id, created_at desc);
create index solicitudes_transaccion_idx on public.solicitudes_cobro (transaccion_id) where transaccion_id is not null;
create trigger solicitudes_updated before update on public.solicitudes_cobro
  for each row execute function public.tg_set_updated_at();

alter table public.transacciones add column solicitud_id uuid references public.solicitudes_cobro(id);
create unique index transacciones_solicitud_idx on public.transacciones (solicitud_id) where solicitud_id is not null;

-- Efectivo: queda pendiente hasta que el comercio confirma que recibió el dinero.
-- (estado 'pendiente' con metodo 'efectivo' ya es válido en el esquema)

alter table public.solicitudes_cobro enable row level security;
create policy "solicitudes: del comercio" on public.solicitudes_cobro
  for select to authenticated using (comercio_id = (select public.mi_comercio_id()));
revoke insert, update, delete on public.solicitudes_cobro from anon, authenticated;

-- Tiempo real para la pantalla del comercio.
alter publication supabase_realtime add table public.solicitudes_cobro;

-- "Tomar" la solicitud es atómico: solo una persona puede pagarla.
create or replace function public.tomar_solicitud(p_id uuid)
returns setof public.solicitudes_cobro
language sql security definer set search_path = '' as $$
  update public.solicitudes_cobro
     set estado = 'tomada'
   where id = p_id and estado = 'abierta' and expira_en > now()
  returning *
$$;
revoke execute on function public.tomar_solicitud(uuid) from public, anon, authenticated;
grant execute on function public.tomar_solicitud(uuid) to service_role;
