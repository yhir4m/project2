# Descuento Verificado · Cobro con descuento verificado sobre CoDi

> Hackatón México · Pey + AI Builders México + SpaceXAI

**Problema:** estudiantes, personas adultas mayores (INAPAM) y otros grupos tienen descuentos por convenio, pero en cada compra deben mostrar una credencial física: fricción, fraude y cero registro.

**Solución:** se verifica la elegibilidad **una vez por periodo** (correo institucional o documento revisado con IA) y se emite una **credencial digital firmada (Ed25519)** que vive en la app del cliente. Al pagar, el **comercio muestra un QR de cobro** y el **cliente lo escanea con la app**: el servidor valida la firma del emisor, la vigencia, la revocación y el dispositivo, calcula el descuento y envía la **solicitud de cobro CoDi al celular del cliente** por el monto exacto (API de Pey). Ambas partes ven el ticket en tiempo real. El comercio nunca ve nombre, edad ni celular: solo "descuento verificado: convenio X".

## Arquitectura

```mermaid
sequenceDiagram
  participant C as Comercio (PWA)
  participant API as API (Next.js)
  participant DB as Supabase
  participant B as Cliente (PWA)
  participant P as Pey · CoDi
  C->>API: POST /api/c/solicitudes (monto o productos)
  API->>DB: solicitud abierta (5 min)
  API-->>C: QR firmado (HS256, sin montos ni datos)
  B->>API: escanea → POST /api/b/cobro/previsualizar
  API-->>B: comercio, compra, descuento y total (calculados en el servidor)
  B->>API: POST /api/b/cobro/pagar (credencial + dispositivo)
  API->>DB: verifica credencial Ed25519 + revocación · tomar_solicitud() atómico
  API->>P: POST /codi/pn (celular del cliente, monto con descuento)
  P-->>B: notificación CoDi en su app bancaria
  P->>API: webhook firmado (Standard Webhooks)
  API->>P: GET /transaction/:id → PAID y monto correcto
  API->>DB: transacción pagada · solicitud pagada
  DB-->>C: Realtime → ticket
  DB-->>B: Realtime → ticket + notificación
```

| Paquete | Qué contiene | Reutilizable en Expo |
|---|---|---|
| `packages/core` | Motor de reglas, credenciales (jose/EdDSA), QR de cobro, elegibilidad, estados de pago | Sí (sin React DOM ni Next) |
| `packages/pey` | Cliente tipado de Pey, verificación de webhooks, simulador opt-in | Sí (servidor) |
| `packages/db` | Tipos generados de Supabase + `RepositorioSupabase` | Sí (servidor) |
| `packages/ui` | Tokens de diseño (colores, tipografía ≥ 18 px, toque ≥ 48 px) | Sí |
| `apps/web` | PWA + API | — |
| `supabase/` | Migraciones, RLS, seed | — |

Detalle de la integración: [`docs/PEY.md`](docs/PEY.md).

## Cómo arrancarlo

### Requisitos
- Node ≥ 20.18 y pnpm (`corepack enable`)
- Un proyecto de Supabase con las migraciones de `supabase/migrations` y `supabase/seed.sql` aplicadas
  (el proyecto del equipo ya las tiene: ref `dytxbichhnnopmqoyzgf`)

### 1. Instalar
```bash
pnpm install
```

### 2. Variables de entorno
```bash
cp .env.example apps/web/.env.local
pnpm keys:generate -- uttab inapam   # pega las 4 líneas ISSUER_* en .env.local
openssl rand -base64 48              # pégalo en VERIFICACION_SECRET
```

| Variable | De dónde sale | Obligatoria |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (**secreta**, solo servidor) | Sí |
| `VERIFICACION_SECRET` | `openssl rand -base64 48` | Sí |
| `ISSUER_<ID>_PRIVATE_KEY` / `_PUBLIC_KEY` | `pnpm keys:generate -- <id>` | Sí, una por emisor |
| `PEY_API_KEY`, `PEY_WEBHOOK_SECRET` | portal.mipey.mx → Desarrollador | Sí, salvo `PEY_SIMULADO=true` |
| `PEY_SIMULADO` | `true` solo para desarrollar sin API key (no mueve dinero) | No |
| `MODO_PRUEBA`, `MONTO_PRUEBA_MXN` | Por defecto `true` y `0.10`: se cobran $0.10 reales en lugar del total | No |
| `XAI_API_KEY`, `XAI_MODEL` | console.x.ai (`grok-4.7`). Sin llave, los documentos van a revisión manual | No |
| `DEMO_MODE` | `true` muestra el selector de rol con usuarios demo | No |

### 3. Configurar Supabase Auth (una vez)
Authentication → URL Configuration → **Redirect URLs**: agrega `http://localhost:3000/auth/callback` (y la URL de Vercel en producción).

### 4. Correr
```bash
pnpm dev                       # http://localhost:3000
# o en modo producción (prueba la PWA y el service worker):
pnpm build && pnpm --filter @cdv/web start
```
La cámara del escáner requiere HTTPS fuera de `localhost`. Para probar en tu celular usa un túnel:
```bash
cloudflared tunnel --url http://localhost:3000
```

### 5. Webhooks de Pey en local
1. Abre el túnel (paso anterior) y copia la URL `https://….trycloudflare.com`.
2. En portal.mipey.mx → Desarrollador → ⚙️ de tu API key → URL: `https://…/api/webhooks/pey`.
3. Copia el secreto `whsec_…` a `PEY_WEBHOOK_SECRET`.

## Cómo probar con MODO_PRUEBA

1. En `/` entra como **Comercio · Negocio de Ramón Orraca** (el único negocio de la demo; sus cobros CoDi caen en la cuenta de Ramón Orraca, la única activa en Pey). En otra ventana (privada) o en tu celular, entra como **Beneficiario · Ana**.
2. Comercio → **Cobrar**: captura $100 (o elige productos) → **Generar código de cobro**. Aparece el QR.
3. Ana → **Pagar**: escanea el QR (en demo también puedes pegarlo). Ve el desglose: $100 − 10 % = **$90**.
4. Si Ana no tiene celular, la app se lo pide (lo necesita CoDi). Luego **Pagar con CoDi**.
5. Con `MODO_PRUEBA=true` se cobran **$0.10 reales**; el ticket muestra el desglose completo y la leyenda de modo prueba.
6. Ana autoriza en su app bancaria (con `PEY_SIMULADO=true`: botón “Simular autorización”). El webhook confirma y ambas pantallas muestran el ticket.
7. **Efectivo:** Ana elige “Pagaré en efectivo” y el comercio toca “Recibí el efectivo”. El descuento y el registro aplican igual.

Pey solo tiene producción y **no devuelve pagos**. La doc recomienda montos pequeños.

## Pruebas
```bash
pnpm test          # unitarias: core (40) + pey (22)
pnpm typecheck && pnpm lint
```
Pruebas de base de datos (RLS, funciones atómicas, restricciones): ver `supabase/tests/rls.sql`.

## Seguridad y privacidad
- El QR del comercio solo lleva el id de la solicitud, el comercio y la expiración (sin montos ni datos personales), firmado por la plataforma.
- Antirreplay: el QR vence en 5 min y la solicitud se toma una sola vez (`tomar_solicitud` atómico).
- La credencial del cliente se verifica en cada pago: firma Ed25519 del emisor, revocación, vigencia y dispositivo ligado.
- El monto y el descuento siempre se calculan en el servidor. El comercio nunca ve nombre, edad ni celular.
- Webhook verificado sobre el cuerpo crudo y **confirmado consultando la transacción** en Pey (monto, canal, referencia).
- RLS en todas las tablas; escrituras solo vía API. Reportes del emisor solo agregados.
- Documentos en Storage privado, borrados al terminar la verificación.

## Ruta a la app Expo
`apps/mobile` queda reservado. `packages/core`, `packages/ui` (tokens) y los tipos de `packages/db` se reutilizan tal cual; se reescriben las pantallas con React Native y el escáner con `expo-camera`. Ver `docs/MOBILE.md` (pendiente).
