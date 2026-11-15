# Integración con Pey (CoDi)

> Fuente: https://docs.pey.mx y su especificación OpenAPI (`info.version = 2026-10-20`),
> guardada en [`docs/reference/pey-openapi-2026-10-20.json`](reference/pey-openapi-2026-10-20.json).
> Consultado el 2026-11-15. Todo lo marcado **⚠️ PENDIENTE** no aparece en la doc y debe confirmarse
> con Pey o con una prueba real antes de depender de ello.

## 1. Entornos y autenticación

| Concepto             | Valor confirmado                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| URL base             | `https://api.pey.mx` (solo **producción**)                                                              |
| Entorno de pruebas   | "Próximamente". No existe hoy.                                                                          |
| Autenticación        | `Authorization: Bearer <API_KEY>` (esquema `http/bearer`)                                               |
| Creación de API key  | Portal https://portal.mipey.mx → _Desarrollador_. Debe ligarse a ≥1 cuenta de pago (`codi` o `stripe`). |
| Formato de respuesta | JSON **plano** (sin envoltorio `data`).                                                                 |
| Errores              | `{ "error": { "message": string, "type": string, "requestId": string } }`                               |

**Recomendación oficial para probar:** cobrar en producción con montos pequeños (la doc usa **$0.01 MXN**).
Los pagos **no se devuelven**. Mientras se activa la cuenta propia, se puede usar la cuenta de pruebas
de la doc (CLABE `012180015826225713`, activa de inmediato). Ojo: el dinero va a una persona real y no regresa.

## 2. Endpoints

### 2.1 `POST /codi/pn`: solicitud de cobro al celular ✅ (opción preferida)

Body (`application/json`):

| Campo           | Tipo          | Req. | Restricciones                                                                              |
| --------------- | ------------- | ---- | ------------------------------------------------------------------------------------------ |
| `amount`        | number        | ✅   | `> 0` y `≤ 1,000,000` MXN                                                                  |
| `phoneNumber`   | string        | ✅   | `^[0-9]{10}$` (celular del **pagador**)                                                    |
| `concept`       | string        |      | Concepto que ve el pagador                                                                 |
| `expiration`    | integer       |      | Segundos. **Mínimo 360**, default 360 (6 min)                                              |
| `numRef`        | string        |      | `^[0-9]{1,7}$`                                                                             |
| `bankAccountId` | string (ULID) |      | Cuenta receptora con `codiStatus: ACTIVE`; si se omite, usa la cuenta CoDi de la API key   |
| `metadata`      | object        |      | ≤50 pares, llave ≤40 chars, valor ≤500 chars, solo escalares; **se devuelven como string** |

Respuesta **200**: `{ "transactionId": "<ULID>", "codiId": "<folio Banxico 20 dígitos>" }`.
Errores: 400, 500, 503 (mantenimiento).

### 2.2 `POST /codi/qr`: QR de cobro ✅ (alternativa)

| Campo           | Tipo    | Req. | Restricciones                                                                                                       |
| --------------- | ------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| `amount`        | number  | ✅   | `≥ 0`; `0` = el pagador captura el monto (**no lo usaremos**: el monto siempre lo fija el servidor)                 |
| `concept`       | string  |      |                                                                                                                     |
| `expiration`    | integer |      | Segundos; `0` = sin expiración; si se fija, **mínimo 360**                                                          |
| `numRef`        | string  |      | `^[0-9]{1,7}$`, default `"0"`                                                                                       |
| `generateImage` | boolean |      | Si `true` devuelve `qrImage` (PNG base64). Más lento; la doc recomienda pintar el QR en el cliente desde `qrString` |
| `bankAccountId` | string  |      | Igual que en PN                                                                                                     |
| `metadata`      | object  |      | Igual que en PN                                                                                                     |

Respuesta **201**: `{ "id": "<IDC Banxico>", "qrString": string, "qrImage"?: string | null }`.
**No devuelve `transactionId`**: el pago se liga por webhook (`codiQrId`) o con `GET /transaction/codi/qr/{id}`.

### 2.3 `GET /transaction/{id}`: consultar transacción ✅ (confirmación tras el webhook)

Respuesta 200 (campos relevantes):

| Campo                                                      | Tipo                                             | Notas                                                 |
| ---------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `id`                                                       | ULID                                             |                                                       |
| `status`                                                   | `PENDING` \| `PAID`                              | **Solo estos dos estados.**                           |
| `amount`                                                   | number                                           | **Total**; en el ejemplo `102.5` = base 100 + fee 2.5 |
| `amountBreakdown`                                          | `{ base, tip, fee }`                             | Comparar `base` contra el monto esperado              |
| `currency`                                                 | string                                           | ISO 4217 (`MXN`)                                      |
| `paymentMethod`                                            | `CARD` \| `CODI`                                 |                                                       |
| `payableType`                                              | `PAYMENT_LINK` \| `API_CODI_QR` \| `API_CODI_PN` |                                                       |
| `payableId`                                                | string                                           |                                                       |
| `description`, `applicationFee`, `dateCreated`, `datePaid` |                                                  | timestamps Unix en segundos                           |
| `metadata`                                                 | object                                           | ver §4                                                |

Errores: 400, 404 (no existe o no pertenece a la API key), 500.

### 2.4 Otros endpoints confirmados (uso secundario)

| Endpoint                                                                             | Uso en el proyecto                                                                                    |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `GET /transaction/codi/qr/{id}?nextToken=`                                           | Confirmar pago de un QR (hasta 20 por página)                                                         |
| `GET /transaction/api-key?nextToken=`                                                | Conciliación y corte del día (80 por página, más recientes primero)                                   |
| `GET /transaction/bank-account/{id}?nextToken=`                                      | Conciliación por comercio                                                                             |
| `POST /bank-account` (`alias`, `name`, `clabe` 18 díg., `entity` `BUSINESS\|PERSON`) | Alta de la cuenta receptora de cada comercio                                                          |
| `GET /bank-account/{id}`                                                             | `codiStatus`: `PENDING → PROCESSING → ACTIVE \| ERROR`. **El alta tarda ~5 días hábiles** con Banxico |
| `POST /payment-link/create`, `/payment-link/update`, `GET /payment-link/{id}`        | No se usan (son links de pago con tarjeta/CoDi; fuera del alcance)                                    |

### 2.5 Tipos de error (`error.type`) vistos en la spec

`INVALID_REQUEST`, `REQUEST_PARSING_ERROR`, `INCOMPLETE_PARAMETERS`, `INVALID_PARAMETER(S)`, `INVALID_AMOUNT`,
`INVALID_STATE`, `INVALID_CLABE`, `INVALID_URL`, `BANK_ACCOUNT_NOT_FOUND`, `NOT_FOUND`, `FORBIDDEN`, `AUTH_ERROR`,
`CONCURRENT_UPDATE`, `PEY_CONSISTENCY_ERROR`, `FLAGS_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, `INTERNAL_SERVER_ERROR`,
`BAD_REQUEST` (y otros de payment links). La doc **no define cuáles son reintentables**; criterio propio:
reintentar solo lecturas (`GET`) ante 500/503. **Nunca** reintentar automáticamente un `POST /codi/*` (ver §5).

## 3. Webhooks

| Concepto      | Confirmado                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Configuración | Portal → _Desarrollador_ → engrane de la API key → URL. **Un webhook por API key.**                                        |
| Firma         | **Standard Webhooks** (SDK oficial: paquete npm `standardwebhooks`)                                                        |
| Secreto       | Formato `whsec_…`; se puede rotar desde el portal                                                                          |
| Verificación  | Sobre el **cuerpo crudo** (string), no el JSON parseado                                                                    |
| Encabezados   | `webhook-id` (la doc lo indica como **llave de idempotencia**), más `webhook-timestamp` y `webhook-signature` del estándar |
| Bitácora      | Portal → _Webhook Logs_ (intentos, payload y respuesta)                                                                    |

### Eventos

**`codi.pn.payment_received`**: se completó un pago de una solicitud al celular.
**`codi.qr.payment_received`**: se recibió un pago de un QR creado por API.

Payload (común; `codiQrId` solo en QR):

```json
{
  "type": "codi.pn.payment_received",
  "transactionId": "01M3QR5E7XHXMNZDEPFH3JAWS0",
  "amount": 100,
  "apiKeyId": "01M3QMMR6X9CBVDY1SF3G8QWNW",
  "bankAccountId": "01JBAVWE4NS5TGXHWGMX3KH23Q",
  "codiQrId": "35a13c183a",
  "concept": "(dev) Order 45",
  "datePaid": 1790724758,
  "numRef": "4567",
  "metadata": {
    "clabe": "000000000000000000",
    "bankCode": 40012,
    "accountType": 40,
    "description": "(dev) Order 45",
    "trackingKey": "0192191042",
    "externalMetadata": { "orderId": "12345" }
  }
}
```

Hay otros eventos (`payment-link/status-update`, `bank-account/updated`) que no usamos.

## 4. Metadata

- **Al crear** (`metadata`) enviamos `{ "txId": "<uuid de nuestra transacción>", "modoPrueba": "true|false" }`.
- **Al recibir** vuelve en `metadata.externalMetadata` (valores como string).
- Campos CoDi del pagador: `clabe`, `bankCode`, `accountType`, `trackingKey`. **No los guardaremos** (minimización de datos); solo `trackingKey` si se necesita para aclaraciones.

## 5. Decisiones de diseño derivadas de la doc

1. **Idempotencia:** Pey **no documenta** un encabezado `Idempotency-Key`. Por eso:
   - Se crea la fila en `transacciones` (estado `creando`) **antes** de llamar a Pey, con una llave única por intento. Un segundo intento con la misma llave regresa la fila existente sin volver a llamar a Pey.
   - Si el `POST` falla por timeout, la fila pasa a `incierta` y se concilia con `GET /transaction/api-key` buscando `externalMetadata.txId`. No se reintenta a ciegas.
   - `webhook_eventos.id = webhook-id` (PK) → los duplicados se descartan.
2. **El webhook es aviso, no prueba:** verificar la firma con `standardwebhooks` → `GET /transaction/{transactionId}` → exigir `status = PAID`, `paymentMethod = CODI`, `currency = MXN` y `amountBreakdown.base` (o `amount` si no viene) == monto esperado → `externalMetadata.txId` == transacción local.
3. **Sin eventos de rechazo ni de expiración:** solo existen `PENDING` y `PAID`. La expiración (≥360 s) se maneja localmente: al vencer, la transacción pasa a `expirada` (y se verifica una última vez con `GET`).
4. **TTL mínimo de 6 min** en PN y QR: no hay conflicto con el QR del beneficiario (45 s), que es nuestro y no de Pey.
5. **`POST /codi/pn` requiere el celular del beneficiario** (10 dígitos). Se pide en el onboarding con consentimiento, se guarda solo en el servidor y **nunca va en el QR**. Si no lo dio, se cae a `POST /codi/qr`, que se muestra en la pantalla del comercio.
6. **Cuenta receptora por comercio:** `bankAccountId` por comercio. Como el alta tarda ~5 días hábiles, en la demo los 3 comercios usan la cuenta por defecto de la API key, con `bankAccountId` opcional en `comercios`.
7. **Modo prueba:** `MODO_PRUEBA=true` cobra `MONTO_PRUEBA_MXN` (default `0.10`, como pide el brief; la doc sugiere `0.01`). Es configurable.

## 6. ⚠️ Pendientes y riesgos

| #   | Tema                                                                                | Estado                                                                                 |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| P1  | Política de reintentos de webhooks (número, calendario, timeout, códigos esperados) | No documentada. Responderemos `2xx` rápido y procesaremos de forma idempotente         |
| P2  | ¿El `amount` del webhook es la base o el total con comisión?                        | Ambiguo. Validamos contra `amountBreakdown.base` del `GET`. Confirmar con un pago real |
| P3  | Tolerancia de `webhook-timestamp`                                                   | Usaremos el default del SDK (5 min)                                                    |
| P4  | Rate limits de la API                                                               | No documentados                                                                        |
| P5  | Encabezado de idempotencia                                                          | No existe en la doc (mitigado en §5.1)                                                 |
| P6  | Cambios por las reglas de Banxico del **14-dic-2026**                               | El changelog no menciona nada. Revisar antes de la demo                                |
| P7  | Monto mínimo                                                                        | No documentado; PN exige `> 0`. Validar `0.10` con una prueba real                     |
| P8  | Eventos de rechazo o expiración de PN                                               | No existen; manejo local (§5.3)                                                        |
| P9  | IPs de origen de los webhooks                                                       | No documentadas. Solo firma                                                            |
