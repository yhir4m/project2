-- =============================================================================
-- QR fijo por negocio + pago de público general (sin credencial).
-- El negocio define el monto; quien escanea paga según su perfil:
-- con credencial vigente → con descuento; sin credencial → precio general.
-- =============================================================================

-- Quién pagó (siempre), y credencial/convenio solo si hubo descuento.
alter table public.transacciones add column pagador_id uuid references auth.users(id);
update public.transacciones t
   set pagador_id = c.usuario_id
  from public.credenciales c
 where c.id = t.credencial_id and t.pagador_id is null;
alter table public.transacciones alter column credencial_id drop not null;
alter table public.transacciones alter column convenio_id drop not null;
alter table public.transacciones
  add constraint transacciones_convenio_con_credencial
  check ((credencial_id is null) = (convenio_id is null));
alter table public.transacciones
  add constraint transacciones_sin_convenio_sin_descuento
  check (convenio_id is not null or descuento_centavos = 0);
create index transacciones_pagador_idx on public.transacciones (pagador_id, created_at desc);

-- El pagador ve sus transacciones (con o sin credencial).
drop policy "transacciones: del comercio o del beneficiario" on public.transacciones;
create policy "transacciones: del comercio o del pagador" on public.transacciones
  for select to authenticated
  using (
    comercio_id = (select public.mi_comercio_id())
    or pagador_id = (select auth.uid())
  );

-- Cobros abiertos de un negocio (los que puede tomar quien escanea el QR fijo).
create index solicitudes_abiertas_idx on public.solicitudes_cobro (comercio_id, created_at desc) where estado = 'abierta';
