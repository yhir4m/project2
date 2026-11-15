-- Las políticas del catálogo (convenios, productos) llaman a mi_emisor_id()/mi_comercio_id().
-- anon necesita EXECUTE para evaluarlas; para anon devuelven NULL (sin auth.uid()), así que no exponen nada.
grant execute on function public.mi_emisor_id(), public.mi_comercio_id() to anon;
