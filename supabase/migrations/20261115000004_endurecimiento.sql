-- =============================================================================
-- Endurecimiento tras el linter de Supabase.
-- =============================================================================

-- La función de trigger no debe ser invocable por RPC.
revoke execute on function public.tg_crear_perfil() from public, anon, authenticated;

-- Índices para llaves foráneas.
create index if not exists credenciales_verificacion_idx on public.credenciales (verificacion_id);
create index if not exists perfiles_comercio_idx on public.perfiles (comercio_id) where comercio_id is not null;
create index if not exists perfiles_emisor_idx on public.perfiles (emisor_id) where emisor_id is not null;
create index if not exists verificaciones_revisado_por_idx on public.verificaciones (revisado_por) where revisado_por is not null;
create index if not exists webhook_eventos_transaccion_idx on public.webhook_eventos (transaccion_id) where transaccion_id is not null;

-- Una sola política SELECT por tabla (mismo efecto, mejor rendimiento).
drop policy "verificaciones propias" on public.verificaciones;
drop policy "verificaciones del emisor" on public.verificaciones;
create policy "verificaciones: propias o del emisor" on public.verificaciones
  for select to authenticated
  using (usuario_id = (select auth.uid()) or emisor_id = (select public.mi_emisor_id()));

drop policy "credenciales propias" on public.credenciales;
drop policy "credenciales del emisor" on public.credenciales;
create policy "credenciales: propias o del emisor" on public.credenciales
  for select to authenticated
  using (usuario_id = (select auth.uid()) or emisor_id = (select public.mi_emisor_id()));

drop policy "transacciones del comercio" on public.transacciones;
drop policy "transacciones del beneficiario" on public.transacciones;
create policy "transacciones: del comercio o del beneficiario" on public.transacciones
  for select to authenticated
  using (
    comercio_id = (select public.mi_comercio_id())
    or exists (select 1 from public.credenciales c
               where c.id = transacciones.credencial_id and c.usuario_id = (select auth.uid()))
  );
