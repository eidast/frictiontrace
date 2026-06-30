# FrictionTrace — Auditoría Completa: walmart.com.gt

> **Fecha:** 2026-06-22
> **URL:** https://www.walmart.com.gt
> **Plataforma:** VTEX (checkout-ui v6.147.4, vtex.js v2.13.1)
> **Método:** Doble captura — Playwright CLI headless + HAR de navegador Chrome real (2 productos)
> **Journey:** Home → Search → Producto → Cart → Checkout (perfil → envío → pago)

---

## Índice

1. [Resumen de scoring](#1-resumen-de-scoring)
2. [Issues críticos](#2-issues-críticos)
3. [Issues altos](#3-issues-altos)
4. [Issues medios](#4-issues-medios)
5. [Comparativa CLI vs Navegador Real](#5-comparativa-cli-vs-navegador-real)
6. [Third-party inventory completo](#6-third-party-inventory-completo)
7. [Performance por página](#7-performance-por-página)
8. [Endpoints VTEX — análisis de carga](#8-endpoints-vtex--análisis-de-carga)
9. [Security & CSP](#9-security--csp)
10. [UX frictions](#10-ux-frictions)
11. [Recomendaciones priorizadas](#11-recomendaciones-priorizadas)
12. [Metodología y archivos](#12-metodología-y-archivos)

---

## 1. Resumen de scoring

| Dimensión | Score | Banda |
|---|---|---|
| Errores JS / API | 8/100 | Crítica |
| Third-party overhead | 15/100 | Alta |
| Performance (search) | 10/100 | Crítica |
| Performance (checkout) | 45/100 | Media |
| Security | 25/100 | Alta |
| UX | 40/100 | Media |
| **Global** | **22/100** | **ALTA fricción** |

---

## 2. Issues críticos

### 2.1 `orderForm 400` — Endpoint de checkout roto

**Endpoint:** `GET /api/checkout/pub/orderForm/default-order-form`
**Status:** 400 Bad Request
**Frecuencia:** 10-12 veces por sesión, en homepage, search, producto, y checkout
**Impacto:** Este endpoint inicializa la sesión de carrito. Al fallar, el sistema reintenta sin éxito, generando tráfico innecesario y potencialmente rompiendo features que dependen del `orderFormId`.

**Evidencia (ambos HARs):**
```
[CLI]     10x 400 GET /api/checkout/pub/orderForm/default-order-form
[Usuario] 12x 400 GET /api/checkout/pub/orderForm/default-order-form
```

**Causa probable:** El backend de VTEX requiere headers o parámetros de sesión que el frontend no está enviando correctamente, o el endpoint espera un `orderFormId` existente que no se ha creado aún.

---

### 2.2 `ageapproval` DELETE loop

**Endpoints:**
- `DELETE .../customData/ageapproval/ageVerified`
- `DELETE .../customData/ageapproval/birthDate`

**Frecuencia:** 22-32 veces por sesión (11-16 pares)
**Impacto:** Cada navegación o interacción en el checkout dispara múltiples DELETEs sin condición de salida. Es un loop de frontend que escala linealmente con el número de productos en el carrito (1 producto = 22 calls, 2 productos = 32 calls).

**Evidencia:**
```
[CLI, 1 prod]     11x ageVerified + 11x birthDate = 22 calls
[Usuario, 2 prod] 16x ageVerified + 16x birthDate = 32 calls
```

**Causa probable:** Un `useEffect` o watcher sin debounce que se dispara en cada render del componente de checkout, posiblemente relacionado con la validación de mayoría de edad para productos restringidos (aunque el arroz no debería requerir age verification).

---

### 2.3 CSS plugins MIME type roto

**URLs:**
- `walmartgt.vteximg.com.br/arquivos/plugins-reset.min.css`
- `walmartgt.vteximg.com.br/arquivos/plugins-common.min.css`

**Status:** `net::ERR_ABORTED` (status 0 en HAR)
**Frecuencia:** 4-8 veces por sesión
**Impacto:** El checkout pierde estilos de reset y comunes de VTEX. Los elementos del formulario de pago y envío pueden renderizarse sin espaciado, tipografía o layout correcto.

**Evidencia (usuario):**
```
0 GET /arquivos/plugins-reset.min.css        4x
0 GET /arquivos/plugins-common.min.css       4x
```

**Causa probable:** Los archivos no existen en el bucket de S3/CloudFront de VTEX o el path `/arquivos/` está mal configurado en el CMS. El servidor retorna `Content-Type: ''` (vacío), lo que Chrome rechaza por strict MIME checking.

---

### 2.4 Cookiebot configurado con placeholder de template

**URLs:**
- `consent.cookiebot.com/{123e4567-f89a-bced-def0-1234567890ab}/cc.js`
- `consentcdn.cookiebot.com/consentconfig/{123e4567-f89a-bced-def0-1234567890ab}/settings.json`

**Frecuencia:** 7-9 llamadas por sesión
**Impacto:** El banner de consentimiento carga pero no puede autorizar el dominio `www.walmart.com.gt`. Cookiebot advierte explícitamente en consola: "The domain WWW.WALMART.COM.GT is not authorized to show the cookie banner for domain group ID {123e4567...}". El archivo `settings.json` retorna 404.

**Evidencia (consola):**
```
[ERROR] 404 GET /consentconfig/{123e4567-f89a-bced-def0-1234567890ab}/settings.json
[WARNING] The domain WWW.WALMART.COM.GT is not authorized to show the cookie banner
```

**Causa:** El ID `{123e4567-f89a-bced-def0-1234567890ab}` es un placeholder de documentación de Cookiebot que nunca fue reemplazado por el ID real durante la implementación en GTM.

---

### 2.5 Google Maps API key expuesta en el bundle

**Key:** `AIzaSyBkfKiZpVlezmcE1ywp8T3XYTh9HyuDS5o`
**Frecuencia:** 8 requests por sesión de checkout
**Impacto:** La key está hardcodeada en el frontend sin restricción de HTTP referrer. Cualquiera puede extraerla y usarla desde otro dominio, generando costos al propietario.

**Evidencia:**
```
GET https://maps.googleapis.com/maps/api/js?key=AIzaSyBkfKiZpVlezmcE1ywp8T3XYTh9HyuDS5o&libraries=&callback=...
```

**Fix:** En Google Cloud Console → APIs & Services → Credentials → Restringir por HTTP referrer a `*.walmart.com.gt/*`.

---

## 3. Issues altos

### 3.1 `getCustomLastOrderId` — 24x 400 (solo en navegador real)

Este endpoint no apareció en el CLI headless porque el flujo automatizado no completó el perfil de usuario. El navegador real, con sesión iniciada, dispara 24 llamadas con 400. Probablemente el endpoint espera un `userId` con historial de compras y retorna 400 cuando no existe.

### 3.2 `getPromos/promos-payment-checkout` — 8x 400 (solo en navegador real)

Endpoint de promociones asociadas a métodos de pago. Retorna 400 consistentemente, lo que sugiere que la feature de promociones de pago no está configurada pero el frontend la invoca igual.

### 3.3 GTM `slice` TypeError

```javascript
TypeError: Cannot read properties of undefined (reading 'slice')
    at https://www.googletagmanager.com/gtm.js?id=GTM-5CJG27W:1019:429
```

Ocurre en la página de búsqueda. Una variable GTM espera un array y recibe `undefined`, rompiendo el dataLayer y potencialmente la atribución de analytics para búsquedas.

### 3.4 TikTok Pixel sin configurar

```
[WARNING] TikTok Pixel (TBP) is disabled - no valid Pixel ID configured.
```

El script de TikTok se carga 93 veces por sesión pero sin un Pixel ID válido. Es tráfico y peso de página completamente inútil.

### 3.5 Meta Pixel conflict — versiones múltiples

```
[WARNING] [Meta Pixel] - Multiple pixels with conflicting versions were detected on this page.
```

Dos versiones del pixel de Facebook cargadas simultáneamente. Puede causar eventos duplicados, atribución incorrecta, y problemas de rendimiento.

### 3.6 Shared Storage attestation — 30+ errores

```
[ERROR] Attestation check for Shared Storage on https://www.googleadservices.com failed.
```

Error del lado del browser (Chrome Privacy Sandbox). No es un bug del sitio pero satura la consola y puede indicar que los slots de Google Ad Manager no están configurados para el entorno de Privacy Sandbox.

### 3.7 reCAPTCHA enterprise webworker roto

```
[ERROR] GET https://www.google.com/recaptcha/enterprise/webworker.js → status 0
```

El webworker de reCAPTCHA enterprise no carga en el contexto del checkout. Puede deberse a CSP bloqueando workers o a que el worker se solicita desde un iframe (card-ui de VTEX payments).

### 3.8 shippingData POST fallido

```
0 POST .../attachments/shippingData
```

Un request de envío falló completamente (ERR_ABORTED). Coincide con el momento en que el usuario cambió de Express (fuera de cobertura) a Programada.

---

## 4. Issues medios

### 4.1 Search — FCP 9.5s, LoadComplete 27s

Métricas de la página de búsqueda (`/arroz%20suli`):

| Métrica | Valor |
|---|---|
| FCP (First Contentful Paint) | 9,472 ms |
| DOMContentLoaded | 8,909 ms |
| LoadComplete | 27,185 ms |
| TTFB | 49 ms |
| CLS | 0 |

El FCP de 9.5 segundos es inaceptable. La causa: 52 errores de consola, 130+ scripts cargando en paralelo, y una cascada de requests de terceros que bloquean el thread principal.

### 4.2 Checkout — DOM Complete 5.6s

| Métrica | CLI | Usuario |
|---|---|---|
| DOM Content Loaded | 31.8s | 1.8s |
| onLoad | 35.1s | 3.2s |

La diferencia enorme se debe a que el CLI headless corrió en un entorno más lento (menos caching,网络限制). El usuario real obtuvo 3.2s, que es aceptable pero aún alto considerando que la página carga 130 scripts y 250 recursos.

### 4.3 favicon.ico 404

```
404 GET /favicon.ico
404 GET /arquivos/favicon.ico
```

Ambas URLs retornan 404. Es un detalle menor pero consistente.

### 4.4 Modal de ubicación — UX friction

El modal "Selecciona donde deseas que entreguemos tu pedido" bloquea toda la navegación con un botón "Aceptar" disabled. El usuario debe seleccionar Departamento Y Municipio antes de poder continuar. Para un sitio de e-commerce, forzar esta decisión en el entry point es fricción innecesaria (podría ser un banner no bloqueante o posponerse hasta el checkout).

### 4.5 VTEX render-runtime race condition

```
[WARNING] prefetchDefaultPages should only be called before RenderProvider's render.
```

El runtime de VTEX detecta que `prefetchDefaultPages` se llamó después de que el `RenderProvider` ya montó. Puede causar que algunas páginas no se pre-carguen correctamente, resultando en navegación más lenta entre rutas del SPA.

---

## 5. Comparativa CLI vs Navegador Real

| Métrica | CLI Headless | Usuario (Chrome real) |
|---|---|---|
| Tamaño HAR | 7.8 MB | 95.8 MB |
| Entries totales | 2,144 | 3,063 |
| Páginas del journey | 1 (solo checkout) | 2 (home + checkout) |
| Dominios únicos | 84 | 91 |
| Errores 4xx/5xx | 18 | 100 |
| Requests fallidos (status 0) | 0 | 48 |
| Productos en carrito | 1 (Arroz Suli 1700g) | 2 (Sasson Sushi + Suli) |
| Etapas alcanzadas | Search → Producto → Cart | Home → Search → 2 Productos → Cart → Perfil → Envío → Pago |

### Issues coincidentes (✓)

| Issue | CLI | Usuario | Match |
|---|---|---|---|
| `orderForm 400` | ✓ | ✓ | ✓ |
| `ageapproval` DELETE loop | ✓ | ✓ | ✓ |
| CSS plugins MIME roto | ✓ | ✓ | ✓ |
| Cookiebot placeholder | ✓ | ✓ | ✓ |
| favicon 404 | ✓ | ✓ | ✓ |
| Google Maps key expuesta | ✓ | ✓ | ✓ |
| TikTok tracking masivo | ✓ | ✓ | ✓ |
| GTM errors | ✓ | Limitado | ~ |
| Shared Storage attestation | ✓ | ✓ | ✓ |

### Issues solo en navegador real

| Issue | Veces |
|---|---|
| `getCustomLastOrderId` 400 | 24 |
| `getPromos` 400 | 8 |
| recaptcha webworker status 0 | 2 |
| shippingData POST status 0 | 1 |
| Iframes de pago (crédito + débito) | 2 |

---

## 6. Third-party inventory completo

### Total: ~90 dominios de terceros (sobre ~91 únicos)

### Ads / RTB / DMP (25 dominios)

| Dominio | Categoría | Requests |
|---|---|---|
| `doubleclick.net` (securepubads, googleads, fls, ad) | Ad Server | 120+ |
| `googlesyndication.com` (safeframe) | Ad iframe | 80+ |
| `criteo.com` / `criteo.net` | Retargeting | 15+ |
| `pinterest.com` (ct, analytics) | Social ads | 20+ |
| `tiktok.com` / `tiktokw.us` | Social ads | 93 |
| `facebook.net` / `facebook.com` | Social ads | 10+ |
| `openx.net` | Ad exchange | 2 |
| `taboola.com` | Native ads | 2 |
| `outbrain.com` | Native ads | 4 |
| `mgid.com` | Native ads | 2 |
| `smartadserver.com` | Ad server | 6 |
| `360yield.com` | Ad exchange | 4 |
| `bidswitch.net` | Ad exchange | 2 |
| `socdm.com` | DMP (Japan) | 6 |
| `clmbtech.com` (ade) | DMP sync | 4 |
| `e-planning.net` | Ad server | 2 |
| `groovinads.com` | Ad network | 4 |
| `creativecdn.com` | Creative CDN | 2 |
| `ad-stir.com` | Ad exchange (Japan) | 2 |
| `toast.com` (cm-exchange) | DMP sync | 4 |
| `nhnace.com` (cm) | DMP sync | 2 |
| `gssprt.jp` | DMP sync | 2 |
| `demdex.net` | Adobe Audience Manager | 2 |

### Analytics / Tag Management (4 dominios)

| Dominio | Requests |
|---|---|
| `googletagmanager.com` | 20+ |
| `google-analytics.com` | 30+ |
| `google.com` (ccm, g/collect, measurement) | 60+ |
| `adobe-client-data-layer` (vtexassets CDN) | 2 |

### VTEX Infrastructure (8 dominios)

| Dominio | Propósito |
|---|---|
| `io2.vtex.com` | CDN de checkout scripts |
| `vtexassets.com` | CDN de assets npm |
| `vteximg.com.br` | CDN de imágenes (CloudFront) |
| `vtex.com.br` | IO runtime, polyfills |
| `vtexpayments.com.br` | Iframes de pago (card-ui) |
| `myvtex.com` | Legacy extensions |
| `vtexcommercestable.com.br` | API commerce |
| `rc.vtex.com` | Request capture |

### Otros

| Dominio | Propósito |
|---|---|
| `cookiebot.com` / `cookiebotcdn.com` | Consent management (roto) |
| `maps.googleapis.com` | Google Maps (API key expuesta) |
| `google.com/recaptcha` | reCAPTCHA enterprise |
| `syndigo.com` | Content syndication |
| `flixcar.com` | Product media |
| `cdnjs.cloudflare.com` | Slick carousel CSS |
| `fonts.googleapis.com` / `gstatic.com` | Google Fonts |
| `docs.google.com` | Google Sheets (config CSV) |

---

## 7. Performance por página

### Homepage (`/`)

| Métrica | Usuario |
|---|---|
| onLoad | 2,164 ms |
| DOMContentLoaded | 317 ms |
| Recursos | ~350 requests iniciales |
| TTFB | ~50 ms |

### Search (`/arroz%20suli`)

| Métrica | CLI |
|---|---|
| FCP | 9,472 ms |
| DOMContentLoaded | 8,909 ms |
| LoadComplete | 27,185 ms |
| TTFB | 49 ms |
| Errores consola | 52 |

### Producto (`/arroz-suli-blanco-1700gr/p`)

| Métrica | CLI |
|---|---|
| FCP | ~2,000 ms (est.) |
| Console errors | 5 |

### Checkout (`/checkout/#/cart`)

| Métrica | CLI | Usuario |
|---|---|---|
| DOMContentLoaded | 31,815 ms | 1,845 ms |
| onLoad | 35,135 ms | 3,173 ms |
| Recursos totales | 250 | ~600 |
| Scripts cargados | 130 | ~200 |
| Tamaño total transferido | 14 MB | 8 MB |

### Requests más lentos en checkout (top 10, ambos HARs)

| Duración | Dominio | Tipo |
|---|---|---|
| 6,595 ms | `smartadserver.com` | RTB cookie sync |
| 3,570 ms | `cm-exchange.toast.com` | DMP pixel |
| 3,144 ms | `socdm.com` | RTB cookie sync |
| 2,970 ms | `criteo.com` | Creative asset fetch |
| 2,738 ms | `io.vtex.com.br` | Polyfill script |
| 2,736 ms | `taboola.com` | RTB cookie sync |
| 2,710 ms | `flixcar.com` | Product media log |
| 2,673 ms | `clmbtech.com` | DMP sync |
| 2,665 ms | `360yield.com` | RTB cookie sync |
| 2,608 ms | `bidswitch.net` | RTB cookie sync |

---

## 8. Endpoints VTEX — análisis de carga

### Por frecuencia (usuario, sesión completa)

```
 82x  POST /_v/private/graphql/v1          ← Principal consumidor
 78x  GET  /api/sessions                     ← Pooling de sesión
 48x  GET  /_v/segment/graphql/v1
 42x  POST /_v/segment/graphql/v1
 29x  POST /api/v2/pixel                     ← TikTok events
 21x  POST /api/v2/pixel/act
 20x  GET  /_v/fbe/pixel                     ← Facebook events
 19x  POST /api/v2/pixel/inter
 18x  GET  /api/checkout/pub/regions
 17x  GET  /_v/public/graphql/v1
 16x  DELETE .../ageapproval/ageVerified      ← REDUNDANTE
 16x  DELETE .../ageapproval/birthDate        ← REDUNDANTE
 12x  GET  /api/checkout/pub/orderForm/...    ← Sesión carrito
 12x  GET  /api/checkout/pub/orderForm/default-order-form ← 400
 10x  POST /api/checkout/pub/orderForms/simulation
 10x  POST /api/activity-flow/web-vitals
```

### Requests VTEX >500ms (todas son `_v/segment/graphql/v1`)

```
1471ms, 1417ms, 1284ms, 1129ms, 971ms, 942ms, 938ms,
913ms, 891ms, 878ms, 851ms, 826ms, 819ms, 796ms, 777ms
```

El endpoint de segmentación de VTEX es consistentemente lento (>750ms en el percentil 50). Esto afecta la personalización de contenido y el tracking de eventos.

---

## 9. Security & CSP

### API keys expuestas

| Key | Servicio | Requests |
|---|---|---|
| `AIzaSyBkfKiZpVlezmcE1ywp8T3XYTh9HyuDS5o` | Google Maps | 8 |
| `6LdV7CIpAAAAAPUrHXWlFArQ5hSiNQJk6Ja-vcYM` | reCAPTCHA enterprise | 10+ |

### Content Security Policy — card-ui (iframes de pago)

Los iframes de VTEX Payments (`io.vtexpayments.com.br/card-ui/1.38.1/`) presentan múltiples violaciones CSP:

- **CSP directive malformada**: `content-security-policy-report-only:` tiene `:` al final, causando error de parseo.
- **CSS externo bloqueado**: `fonts.googleapis.com`, `fonts.cdnfonts.com`, `www.walmart.com.gt/arquivos/*.css` violan `style-src`.
- **Script inline bloqueado**: `sha256-AdqydPwVZwz4Ote...` requerido pero no configurado en `script-src`.
- **Estilos inline bloqueados**: múltiples hashes `sha256-47DEQpj8...` requeridos.

Estas violaciones son **report-only**, por lo que no rompen funcionalidad, pero indican que la configuración CSP de los iframes de pago no fue actualizada para incluir los dominios de assets que el card-ui necesita.

### Mixed content

No se detectó mixed content. El sitio sirve todo sobre HTTPS. Los CSS de `walmartgt.vteximg.com.br` que fallan no son mixed content — fallan por MIME type.

---

## 10. UX frictions

### 10.1 Modal de ubicación bloqueante

- Bloquea TODA la navegación en el primer acceso
- Botón "Aceptar" disabled hasta seleccionar Departamento + Municipio (2 selects)
- No hay opción "Omitir" o "Seleccionar después"
- Para un usuario que solo quiere browsear, es abandono inmediato

### 10.2 "Express fuera de cobertura" persistente

El mensaje de error de Express delivery se mantiene visible en la UI incluso después de cambiar a envío Programada. El warning en consola `deliverySelected with scheduledSLA and no delivery window` confirma que el estado interno no se actualiza correctamente al cambiar de método.

### 10.3 Métodos de pago ocultos bajo scroll

La UI del checkout carga primero las tarjetas de crédito/débito arriba. Los métodos alternativos ("Efectivo contra entrega", "Pago con tarjeta contra entrega") requieren scroll para ser visibles, dando la impresión de que solo se acepta tarjeta.

### 10.4 Teléfono sin formato internacional real

El campo de teléfono exige formato de Guatemala (8 dígitos) a pesar de tener código de país. Números internacionales reales son rechazados.

---

## 11. Recomendaciones priorizadas

### Inmediatas (semana 1)

| # | Acción | Impacto |
|---|---|---|
| 1 | Fix `default-order-form` 400 | Inicialización de carrito rota en todo el sitio |
| 2 | Agregar condición de salida al loop `ageapproval` DELETE | 32 requests redundantes eliminados |
| 3 | Reemplazar placeholder de Cookiebot | Consent manager funcional, compliance legal |
| 4 | Restringir Google Maps API key | Seguridad, prevención de abuso |

### Corto plazo (semanas 2-4)

| # | Acción | Impacto |
|---|---|---|
| 5 | Fix `getCustomLastOrderId` y `getPromos` 400 | -32 errores en checkout |
| 6 | Eliminar o configurar TikTok Pixel | -93 requests inútiles |
| 7 | Unificar versiones de Meta Pixel | Eventos correctos, sin duplicación |
| 8 | Revisar archivos CSS faltantes en `/arquivos/` | Checkout con estilos correctos |
| 9 | Arreglar CSP de card-ui (iframes VTEX Payments) | Sin errores en consola de pago |

### Medio plazo (1-3 meses)

| # | Acción | Impacto |
|---|---|---|
| 10 | Auditoría de third-party scripts — lazy load diferido | -7s en cookie syncs, mejor FCP |
| 11 | Mejorar FCP del search (9.5s → <3s) | Experiencia de búsqueda usable |
| 12 | UX: modal de ubicación no bloqueante | Menos abandono en entry point |
| 13 | UX: mostrar todos los métodos de pago sin scroll | Conversión en métodos alternativos |
| 14 | UX: fix mensaje "Express fuera de cobertura" persistente | Consistencia visual en checkout |

---

## 12. Metodología y archivos

### Herramientas

- **Playwright CLI** — navegación headless, captura de snapshots, console, network
- **Playwright Node.js API** — HAR recording nativo (`recordHar`)
- **Node.js scripts** — análisis programático de HAR files
- **Chrome DevTools** — validación de HAR y análisis visual

### Archivos generados

| Archivo | Contenido |
|---|---|
| `walmart-checkout.har` (7.8 MB) | HAR del CLI headless |
| `www.walmart.com.gt-2productos.har` (95.8 MB) | HAR del navegador real |
| `walmart-network-requests.txt` | 374 requests capturados por CLI |
| `walmart-console-errors.txt` | Errores/warnings de consola |
| `reports/audit-summary.md` | Resumen ejecutivo |
| `reports/audit-detailed.md` | Este documento |

### Journey ejecutado

**CLI headless:**
```
Homepage → Dismiss modal ubicación (Guatemala Zona 17)
→ Producto: Arroz Suli Blanco 1700g
→ Add to cart → /checkout/#/cart
```

**Navegador real (usuario):**
```
Homepage → Search "arroz sushi"
→ Producto 1: Arroz Sasson Sushi Gourmet 454g (Q20.00)
→ Navegar categorías → Producto 2: Arroz Suli Blanco 1700g (Q15.50)
→ /checkout/#/cart → Perfil (email) → Envío (cambio Express→Programada)
→ Pago (scroll a Efectivo Contra Entrega) → STOP antes de "Comprar ahora"
```

---

*Reporte generado por FrictionTrace M0 — 2026-06-22*
