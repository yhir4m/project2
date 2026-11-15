# Descuento Verificado · Cobro con descuento verificado sobre CoDi

> Hackatón México · Pey + AI Builders México + SpaceXAI

**Problema:** estudiantes, personas adultas mayores (INAPAM) y otros grupos tienen descuentos por convenio, pero en cada compra deben mostrar una credencial física: fricción, fraude y cero registro.

**Solución:** se verifica la elegibilidad **una vez por periodo** (correo institucional o documento revisado con IA) y se emite una **credencial digital firmada (Ed25519)**. Al pagar, el comercio escanea un **QR dinámico de 45 s**, el servidor valida firma, vigencia, revocación y antirreplay, calcula el descuento y envía un **cobro CoDi por el monto exacto** con la API de Pey. Ambas partes reciben el ticket en tiempo real.

## Arquitectura

```mermaid
flowchart LR
  subgraph Cliente["PWA mobile-first (Next.js)"]
    B[Beneficiario<br/>Mi QR 45 s] -->|muestra QR| C[Comercio<br/>Escáner]
  end
  C -->|POST /api/c/escanear| API[Route Handlers<br/>Next.js nodejs]
  API -->|verifica JWS Ed25519 + nonce + revocación| CORE[packages/core]
  API -->|SQL + RLS + RPC atómicas| DB[(Supabase<br/>Postgres · Auth · Storage · Realtime)]
  API -->|POST /codi/pn o /codi/qr| PEY[Pey · CoDi]
  PEY -->|webhook firmado<br/>Standard Webhooks| API
  API -->|GET /transaction/:id<br/>confirma PAID y monto| PEY
  DB -->|Realtime| B
  DB -->|Realtime| C
  API -->|visión| XAI[xAI Grok]
```

| Paquete | Qué contiene | Reutilizable en Expo |
|---|---|---|
| `packages/core` | Motor de reglas, credenciales y QR (jose/EdDSA), elegibilidad, estados de pago | Sí (sin React DOM ni Next) |
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

1. En `/` elige **Comercio · Papelería El Cuaderno** en un dispositivo y **Beneficiario · Ana** en otro (o en una ventana privada).
2. Ana: **Perfil → Celular** (10 dígitos) para recibir el cobro en su app bancaria. Sin celular, el comercio muestra un QR de cobro CoDi.
3. Ana: **Mi QR**. Comercio: escanea (en demo también puedes pegar el código).
4. Comercio: captura $100 → verás 10 % de descuento → **Cobrar con CoDi**.
5. Con `MODO_PRUEBA=true` se cobran **$0.10 reales**; el ticket muestra el desglose completo y la leyenda de modo prueba.
6. Autoriza en tu app bancaria → el webhook confirma y ambas pantallas muestran el ticket.

Pey solo tiene producción y **no devuelve pagos**. La doc recomienda montos pequeños.

## Pruebas
```bash
pnpm test          # unitarias: core (45) + pey (22)
pnpm typecheck && pnpm lint
```
Pruebas de base de datos (RLS, funciones atómicas, restricciones): ver `supabase/tests/rls.sql`.

## Seguridad y privacidad
- El QR solo lleva seudónimo, emisor, tipo, nonce, dispositivo y expiración (sin nombre, edad ni CURP).
- Antirreplay: TTL de 45 s, nonce de un solo uso (`consumir_nonce` atómico) y token ligado al dispositivo.
- Revocación consultada al escanear **y** al cobrar. El monto siempre se calcula en el servidor.
- Webhook verificado sobre el cuerpo crudo y **confirmado consultando la transacción** en Pey (monto, canal, referencia).
- RLS en todas las tablas; escrituras solo vía API. Reportes del emisor solo agregados.
- Documentos en Storage privado, borrados al terminar la verificación.

## Ruta a la app Expo
`apps/mobile` queda reservado. `packages/core`, `packages/ui` (tokens) y los tipos de `packages/db` se reutilizan tal cual; se reescriben las pantallas con React Native y el escáner con `expo-camera`. Ver `docs/MOBILE.md` (pendiente).
