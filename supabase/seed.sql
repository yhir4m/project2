-- =============================================================================
-- Datos de demo: 2 emisores, 3 convenios, 3 comercios cerca de UTTAB, 3 beneficiarios
-- y personal demo de comercio/emisor. Idempotente (on conflict do nothing).
--
-- Los usuarios demo NO tienen contraseña: el selector de rol de la demo inicia sesión
-- desde el servidor con un enlace mágico generado por la API admin (solo si DEMO_MODE=true).
-- Las coordenadas son aproximadas y los comercios son ficticios.
-- =============================================================================

-- ---------- Emisores ----------
insert into public.emisores (id, nombre, nombre_corto, tipo_periodo, dominios_correo, palabras_institucion, tipos_documento, tipos_beneficiario)
values
  ('uttab', 'Universidad Tecnológica de Tabasco', 'UTTAB', 'cuatrimestre',
   array['uttab.edu.mx'], array['UTTAB', 'Tecnológica de Tabasco'],
   array['constancia_estudios', 'credencial_estudiante'], array['estudiante']),
  ('inapam', 'INAPAM (demo)', 'INAPAM', 'anual',
   array[]::text[], array['INAPAM', 'Instituto Nacional de las Personas Adultas Mayores'],
   array['credencial_inapam'], array['adulto_mayor'])
on conflict (id) do nothing;

-- ---------- Convenios ----------
insert into public.convenios (id, emisor_id, nombre, descripcion, tipo_beneficiario, regla) values
  ('c0000000-0000-4000-8000-000000000001', 'uttab', 'Estudiante UTTAB 10%',
   '10% en tu compra, hasta $50, dos veces al día.', 'estudiante',
   '{"tipo":"porcentaje","valor":10,"tope_centavos":5000,"usos_por_dia":2}'),
  ('c0000000-0000-4000-8000-000000000002', 'uttab', 'Café estudiante UTTAB',
   '20% en café y bebidas participantes.', 'estudiante',
   '{"tipo":"porcentaje","valor":20,"productos":["CAFE-AME","CAFE-LAT","AGUA-500"],"usos_por_dia":3}'),
  ('c0000000-0000-4000-8000-000000000003', 'inapam', 'INAPAM 15%',
   '15% en tu compra, hasta $100, una vez al día.', 'adulto_mayor',
   '{"tipo":"porcentaje","valor":15,"tope_centavos":10000,"usos_por_dia":1}')
on conflict (id) do nothing;

-- ---------- Comercios (ficticios, cerca de UTTAB, Villahermosa) ----------
insert into public.comercios (id, nombre, giro, direccion, lat, lng) values
  ('a0000000-0000-4000-8000-000000000001', 'Papelería El Cuaderno', 'Papelería', 'Av. Universidad, cerca de UTTAB (demo)', 17.9060, -92.9155),
  ('a0000000-0000-4000-8000-000000000002', 'Café La Parrilla', 'Cafetería', 'Carretera Villahermosa–Teapa (demo)', 17.9071, -92.9140),
  ('a0000000-0000-4000-8000-000000000003', 'Farmacia Bienestar', 'Farmacia', 'Parrilla, Centro, Tabasco (demo)', 17.9049, -92.9172)
on conflict (id) do nothing;

insert into public.comercio_convenios (comercio_id, convenio_id) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001')
on conflict do nothing;

insert into public.productos (comercio_id, sku, nombre, precio_centavos) values
  ('a0000000-0000-4000-8000-000000000002', 'CAFE-AME', 'Café americano', 3500),
  ('a0000000-0000-4000-8000-000000000002', 'CAFE-LAT', 'Café latte', 4800),
  ('a0000000-0000-4000-8000-000000000002', 'AGUA-500', 'Agua 500 ml', 1500),
  ('a0000000-0000-4000-8000-000000000002', 'PAN-DUL', 'Pan dulce', 2200),
  ('a0000000-0000-4000-8000-000000000002', 'SAND-JAM', 'Sándwich de jamón', 5500),
  ('a0000000-0000-4000-8000-000000000001', 'CUAD-100', 'Cuaderno 100 hojas', 4500),
  ('a0000000-0000-4000-8000-000000000001', 'PLUM-AZ', 'Pluma azul', 1200),
  ('a0000000-0000-4000-8000-000000000001', 'IMP-BN', 'Impresión b/n', 200)
on conflict (comercio_id, sku) do nothing;

-- ---------- Usuarios demo ----------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('b0000000-0000-4000-8000-000000000001'::uuid, 'ana.estudiante@cdv.demo'),
      ('b0000000-0000-4000-8000-000000000002'::uuid, 'luis.estudiante@cdv.demo'),
      ('b0000000-0000-4000-8000-000000000003'::uuid, 'carmen.inapam@cdv.demo'),
      ('d0000000-0000-4000-8000-000000000001'::uuid, 'papeleria@cdv.demo'),
      ('d0000000-0000-4000-8000-000000000002'::uuid, 'cafe@cdv.demo'),
      ('d0000000-0000-4000-8000-000000000003'::uuid, 'farmacia@cdv.demo'),
      ('e0000000-0000-4000-8000-000000000001'::uuid, 'emisor.uttab@cdv.demo'),
      ('e0000000-0000-4000-8000-000000000002'::uuid, 'emisor.inapam@cdv.demo')
    ) as t(id, email)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
      '{"provider":"email","providers":["email"],"demo":true}', '{}', now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, 'email',
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now())
    on conflict (provider_id, provider) do nothing;
  end loop;
end $$;

-- El trigger on_auth_user_created ya creó los perfiles; completamos rol y datos mínimos.
update public.perfiles set nombre = 'Ana', consentimiento_at = now()
  where id = 'b0000000-0000-4000-8000-000000000001';
update public.perfiles set nombre = 'Luis', consentimiento_at = now()
  where id = 'b0000000-0000-4000-8000-000000000002';
update public.perfiles set nombre = 'Carmen', consentimiento_at = now(), letra_grande = true
  where id = 'b0000000-0000-4000-8000-000000000003';
update public.perfiles set rol = 'comercio', comercio_id = 'a0000000-0000-4000-8000-000000000001', nombre = 'Papelería El Cuaderno'
  where id = 'd0000000-0000-4000-8000-000000000001';
update public.perfiles set rol = 'comercio', comercio_id = 'a0000000-0000-4000-8000-000000000002', nombre = 'Café La Parrilla'
  where id = 'd0000000-0000-4000-8000-000000000002';
update public.perfiles set rol = 'comercio', comercio_id = 'a0000000-0000-4000-8000-000000000003', nombre = 'Farmacia Bienestar'
  where id = 'd0000000-0000-4000-8000-000000000003';
update public.perfiles set rol = 'emisor', emisor_id = 'uttab', nombre = 'Servicios Escolares UTTAB'
  where id = 'e0000000-0000-4000-8000-000000000001';
update public.perfiles set rol = 'emisor', emisor_id = 'inapam', nombre = 'INAPAM (demo)'
  where id = 'e0000000-0000-4000-8000-000000000002';

-- ---------- Verificaciones y credenciales de demo ----------
-- El JWS se firma en el servidor la primera vez que se consulta (la privada no vive en la BD).
insert into public.verificaciones (id, usuario_id, emisor_id, tipo_beneficiario, metodo, estado, confianza) values
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'uttab',  'estudiante',   'correo_institucional', 'aprobada', null),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'uttab',  'estudiante',   'documento_ia',         'aprobada', 0.95),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'inapam', 'adulto_mayor', 'documento_ia',         'aprobada', 0.91)
on conflict (id) do nothing;

insert into public.credenciales (id, usuario_id, emisor_id, tipo_beneficiario, verificacion_id, vigente_hasta) values
  ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'uttab',  'estudiante',   'f0000000-0000-4000-8000-000000000001', '2027-01-01T05:59:59Z'),
  ('10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'uttab',  'estudiante',   'f0000000-0000-4000-8000-000000000002', '2027-01-01T05:59:59Z'),
  ('10000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'inapam', 'adulto_mayor', 'f0000000-0000-4000-8000-000000000003', '2027-01-01T05:59:59Z')
on conflict (id) do nothing;

-- ---------- Un solo negocio en la demo ----------
-- Pey solo tiene activa la cuenta CoDi de Ramón Orraca (ligada a la API key): todos los cobros caen ahí.
-- La demo usa un único negocio con los 3 convenios; los otros comercios quedan inactivos (historial).
update public.comercios
   set nombre = 'Negocio de Ramón Orraca', giro = 'Comercio demo',
       direccion = 'Cobros CoDi a la cuenta de Ramón Orraca (CLABE ••••5713)'
 where id = 'a0000000-0000-4000-8000-000000000001';
update public.perfiles set nombre = 'Negocio de Ramón Orraca' where id = 'd0000000-0000-4000-8000-000000000001';
update public.comercios set activo = false
 where id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003');
update auth.users set raw_app_meta_data = raw_app_meta_data - 'demo'
 where id in ('d0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003');
insert into public.comercio_convenios (comercio_id, convenio_id) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003')
on conflict do nothing;
insert into public.productos (comercio_id, sku, nombre, precio_centavos) values
  ('a0000000-0000-4000-8000-000000000001', 'CAFE-AME', 'Café americano', 3500),
  ('a0000000-0000-4000-8000-000000000001', 'CAFE-LAT', 'Café latte', 4800),
  ('a0000000-0000-4000-8000-000000000001', 'AGUA-500', 'Agua 500 ml', 1500)
on conflict (comercio_id, sku) do nothing;
