-- Pruebas de base de datos: funciones atómicas, restricciones y RLS por rol.
-- Corre todo en una transacción y la revierte al final (no deja datos).
-- Éxito = termina con "PRUEBAS_OK: ..." (se lanza como excepción a propósito para revertir).
do $$
declare
  ana uuid := 'b0000000-0000-4000-8000-000000000001';
  luis uuid := 'b0000000-0000-4000-8000-000000000002';
  pap uuid := 'a0000000-0000-4000-8000-000000000001';
  cafe uuid := 'a0000000-0000-4000-8000-000000000002';
  cred_ana uuid := '10000000-0000-4000-8000-000000000001';
  cred_luis uuid := '10000000-0000-4000-8000-000000000002';
  conv10 uuid := 'c0000000-0000-4000-8000-000000000001';
  n int; r text := '';
begin
  select count(*) into n from public.buscar_convenio('uttab','estudiante',pap) where id = conv10;
  assert n = 1, 'buscar_convenio uttab/papeleria';
  select count(*) into n from public.buscar_convenio('inapam','adulto_mayor',pap);
  assert n = 0, 'inapam no debe aplicar en papeleria';
  r := r || 'buscar_convenio OK; ';

  assert public.consumir_nonce('test-nonce-1', now() + interval '1 min') = true, 'nonce nuevo';
  assert public.consumir_nonce('test-nonce-1', now() + interval '1 min') = false, 'nonce repetido';
  r := r || 'nonce OK; ';

  assert public.rl_consumir('test-rl', 2, 60) and public.rl_consumir('test-rl', 2, 60), 'rl 1-2';
  assert not public.rl_consumir('test-rl', 2, 60), 'rl 3 debe bloquear';
  r := r || 'rate_limit OK; ';

  insert into public.transacciones (idempotency_key, comercio_id, credencial_id, convenio_id, compra,
    precio_original_centavos, descuento_centavos, monto_final_centavos, monto_cobrado_centavos, metodo, canal, modo_prueba, estado)
  values ('test-k1', pap, cred_ana, conv10, '{"tipo":"monto","monto_centavos":10000}', 10000, 1000, 9000, 10, 'codi', 'pn', true, 'pendiente'),
         ('test-k2', cafe, cred_luis, conv10, '{"tipo":"monto","monto_centavos":5000}', 5000, 0, 5000, 5000, 'efectivo', null, false, 'pagada');
  assert public.usos_hoy(cred_ana, conv10) = 1, 'usos_hoy ana';
  r := r || 'usos_hoy OK; ';

  begin
    insert into public.transacciones (idempotency_key, comercio_id, credencial_id, convenio_id, compra,
      precio_original_centavos, descuento_centavos, monto_final_centavos, monto_cobrado_centavos, metodo, canal, modo_prueba)
    values ('test-k3', pap, cred_ana, conv10, '{}', 10000, 1000, 8000, 10, 'codi', 'pn', true);
    raise exception 'debio fallar monto inconsistente';
  exception when check_violation then r := r || 'check montos OK; ';
  end;
  begin
    insert into public.transacciones (idempotency_key, comercio_id, credencial_id, convenio_id, compra,
      precio_original_centavos, descuento_centavos, monto_final_centavos, monto_cobrado_centavos, metodo, canal, modo_prueba)
    values ('test-k1', pap, cred_ana, conv10, '{}', 100, 0, 100, 100, 'efectivo', null, false);
    raise exception 'debio fallar idempotency duplicada';
  exception when unique_violation then r := r || 'idempotencia OK; ';
  end;
  begin
    insert into public.credenciales (usuario_id, emisor_id, tipo_beneficiario, vigente_hasta)
    values (ana, 'uttab', 'estudiante', now() + interval '30 days');
    raise exception 'debio fallar segunda credencial activa';
  exception when unique_violation then r := r || 'una credencial activa OK; ';
  end;
  begin
    update public.verificaciones set documento_path = 'x/y' where usuario_id = ana;
    raise exception 'debio fallar documento en verificacion resuelta';
  exception when check_violation then r := r || 'borrado de documento forzado OK; ';
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.perfiles;       assert n = 1, 'ana ve solo su perfil';
  select count(*) into n from public.credenciales;   assert n = 1, 'ana ve solo su credencial';
  select count(*) into n from public.transacciones;  assert n = 1, 'ana ve solo su transaccion';
  select count(*) into n from public.verificaciones; assert n = 1, 'ana ve solo su verificacion';
  begin
    perform 1 from public.nonces_usados limit 1;
    raise exception 'ana no debe leer nonces';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.perfiles set rol = 'emisor', emisor_id = 'uttab' where id = ana;
    raise exception 'ana no debe poder cambiar su rol';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  r := r || 'RLS beneficiario OK; ';

  perform set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.transacciones;  assert n = 1, 'papeleria ve solo las suyas';
  select count(*) into n from public.credenciales;   assert n = 0, 'comercio no ve credenciales';
  select count(*) into n from public.perfiles where id = ana; assert n = 0, 'comercio no ve perfiles ajenos';
  execute 'reset role';
  r := r || 'RLS comercio OK; ';

  perform set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.credenciales;   assert n = 2, 'emisor uttab ve 2 credenciales';
  select count(*) into n from public.transacciones;  assert n = 0, 'emisor no ve transacciones';
  execute 'reset role';
  r := r || 'RLS emisor OK; ';

  execute 'set local role anon';
  select count(*) into n from public.perfiles;   assert n = 0, 'anon no ve perfiles';
  select count(*) into n from public.convenios;  assert n = 3, 'anon ve catalogo';
  select count(*) into n from public.productos;  assert n = 8, 'anon ve productos';
  execute 'reset role';
  r := r || 'RLS anon OK';

  raise exception 'PRUEBAS_OK: %', r;
end $$;
