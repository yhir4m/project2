-- =============================================================================
-- Funciones de negocio atómicas (las llama la API con service_role) y reportes.
-- =============================================================================

-- Antirreplay: marca el nonce como usado. true = era nuevo; false = ya se había usado.
create or replace function public.consumir_nonce(p_nonce text, p_expira_en timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ok boolean;
begin
  insert into public.nonces_usados (nonce, expira_en) values (p_nonce, p_expira_en)
  on conflict (nonce) do nothing
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

-- Rate limiting de ventana fija. true = permitido.
create or replace function public.rl_consumir(p_clave text, p_limite integer, p_ventana_seg integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_ventana timestamptz := to_timestamp(floor(extract(epoch from now()) / p_ventana_seg) * p_ventana_seg);
  v_conteo integer;
begin
  insert into public.rate_limits (clave, ventana, conteo) values (p_clave, v_ventana, 1)
  on conflict (clave, ventana) do update set conteo = public.rate_limits.conteo + 1
  returning conteo into v_conteo;
  return v_conteo <= p_limite;
end $$;

-- Usos del convenio "hoy" (día de Ciudad de México) por credencial. Cuenta en curso y pagadas,
-- para que no se puedan abrir cobros en paralelo y saltarse el límite.
create or replace function public.usos_hoy(p_credencial_id uuid, p_convenio_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.transacciones t
  where t.credencial_id = p_credencial_id
    and t.convenio_id = p_convenio_id
    and t.descuento_centavos > 0
    and t.estado in ('creando', 'pendiente', 'incierta', 'pagada')
    and (t.created_at at time zone 'America/Mexico_City')::date
        = (now() at time zone 'America/Mexico_City')::date
$$;

-- Convenio aplicable: emisor + tipo de beneficiario + comercio, activo y vigente hoy.
create or replace function public.buscar_convenio(p_emisor_id text, p_tipo text, p_comercio_id uuid)
returns table (id uuid, nombre text, regla jsonb)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nombre, c.regla
  from public.convenios c
  join public.comercio_convenios cc on cc.convenio_id = c.id and cc.comercio_id = p_comercio_id
  join public.comercios co on co.id = p_comercio_id and co.activo
  where c.emisor_id = p_emisor_id
    and c.tipo_beneficiario = p_tipo
    and c.activo
    and c.vigente_desde <= (now() at time zone 'America/Mexico_City')::date
    and (c.vigente_hasta is null or c.vigente_hasta >= (now() at time zone 'America/Mexico_City')::date)
  order by c.created_at
  limit 1
$$;

-- Marca como vencidas las credenciales cuyo periodo terminó y limpia nonces/rate limits viejos.
create or replace function public.mantenimiento()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.credenciales set estado = 'vencida' where estado = 'activa' and vigente_hasta <= now();
  delete from public.nonces_usados where expira_en < now() - interval '1 hour';
  delete from public.rate_limits where ventana < now() - interval '1 day';
end $$;

revoke execute on function
  public.consumir_nonce(text, timestamptz),
  public.rl_consumir(text, integer, integer),
  public.usos_hoy(uuid, uuid),
  public.buscar_convenio(text, text, uuid),
  public.mantenimiento()
from public, anon, authenticated;
grant execute on function
  public.consumir_nonce(text, timestamptz),
  public.rl_consumir(text, integer, integer),
  public.usos_hoy(uuid, uuid),
  public.buscar_convenio(text, text, uuid),
  public.mantenimiento()
to service_role;

-- Reporte del emisor: SOLO agregados por día y convenio, sin datos personales.
create or replace function public.reporte_emisor(p_desde date, p_hasta date)
returns table (
  dia date,
  convenio_id uuid,
  convenio text,
  usos bigint,
  descuento_centavos bigint,
  venta_centavos bigint,
  efectivo bigint,
  codi bigint
)
language sql stable security definer set search_path = '' as $$
  select (t.pagada_en at time zone 'America/Mexico_City')::date as dia,
         c.id, c.nombre,
         count(*),
         sum(t.descuento_centavos)::bigint,
         sum(t.monto_final_centavos)::bigint,
         count(*) filter (where t.metodo = 'efectivo'),
         count(*) filter (where t.metodo = 'codi')
  from public.transacciones t
  join public.convenios c on c.id = t.convenio_id
  where c.emisor_id = public.mi_emisor_id()
    and t.estado = 'pagada'
    and (t.pagada_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta
  group by 1, 2, 3
  order by 1, 3
$$;
revoke execute on function public.reporte_emisor(date, date) from public, anon;
grant execute on function public.reporte_emisor(date, date) to authenticated;

-- Resumen de credenciales del emisor (conteos).
create or replace function public.resumen_credenciales_emisor()
returns table (estado public.estado_credencial, tipo_beneficiario text, total bigint)
language sql stable security definer set search_path = '' as $$
  select estado, tipo_beneficiario, count(*)
  from public.credenciales
  where emisor_id = public.mi_emisor_id()
  group by 1, 2
$$;
revoke execute on function public.resumen_credenciales_emisor() from public, anon;
grant execute on function public.resumen_credenciales_emisor() to authenticated;

-- ---------- Realtime: estado del pago en vivo ----------
alter publication supabase_realtime add table public.transacciones;
alter publication supabase_realtime add table public.notificaciones;

-- ---------- Storage: documentos temporales (solo servidor) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 8388608,
        array['image/jpeg', 'image/png'])  -- xAI visión: solo JPG/PNG
on conflict (id) do nothing;
-- Sin políticas en storage.objects para este bucket: solo service_role sube, lee (URL firmada) y borra.
