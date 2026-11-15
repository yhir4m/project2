# Guion de la demo (3 minutos)

**Preparación:** app desplegada (Vercel) o `pnpm dev` + túnel `cloudflared`. Computadora = negocio, celular = quien paga. En la computadora, **Mis QR → "Café latte $48" → Mostrar**.

## 0:00 – 0:30 · El problema
"Estudiantes y adultos mayores tienen descuentos por convenio, pero en cada compra deben enseñar una credencial física: hay fila, fraude y nadie lleva registro."

## 0:30 – 1:00 · Verificar una sola vez
- En el celular, entra como **Luis** → **Cartera**: credencial UTTAB vigente hasta fin de cuatrimestre.
- "Se verificó una vez, con su correo institucional o con su constancia revisada por IA (Grok). La credencial va firmada por la universidad (Ed25519) y no lleva nombre ni edad."

## 1:00 – 2:15 · Pagar con un escaneo
1. Con la **cámara normal** del celular, escanea el QR del latte → se abre la app.
2. Pantalla: *Café latte $48 · Con descuento UTTAB 20 % → **$38.40***. "El precio lo fijó el negocio; el descuento depende de quién paga."
3. **Pagar con CoDi** → llega la notificación a la app bancaria → autorizar.
4. Ambas pantallas muestran el **ticket** al instante: precio, descuento, convenio, ID de Pey.
5. "Por modo prueba se cobraron $0.01 reales vía CoDi; el ticket muestra el desglose real."

**Contraste (opcional, 15 s):** el mismo QR escaneado por **Pedro (público general)** → $48.00 sin descuento.

## 2:15 – 2:45 · Lo que ve cada parte
- **Negocio → Pagos de hoy:** el pago apareció solo, con "Café estudiante UTTAB", sin datos personales del cliente.
- **Institución (UTTAB) → Reportes:** usos y monto descontado, solo agregados.

## 2:45 – 3:00 · Cierre
"Verificación una vez por periodo, QR fijo por producto, descuento automático según el perfil y pago real por CoDi con Pey. Lista para app nativa (Expo): la lógica vive en paquetes compartidos."

## Si algo falla en vivo
| Síntoma | Respuesta |
|---|---|
| La cámara no abre | Botón **"Tomar foto del código"** |
| El pago se queda esperando | El webhook tarda; se concilia solo al consultar Pey. Mostrar el pago en efectivo como respaldo |
| Sin descuento | Ese beneficiario ya usó su límite diario: usar Carmen |
