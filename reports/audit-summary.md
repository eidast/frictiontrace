# FrictionTrace Audit — walmart.com.gt

**Fecha:** 2026-06-22
**URL:** https://www.walmart.com.gt
**Plataforma:** VTEX (checkout-ui v6.147.4, vtex.js v2.13.1)
**Fuentes:** Playwright CLI (headless) + HAR de navegador real

---

## Score estimado: 22/100 (ALTA fricción)

---

## Resumen ejecutivo

Walmart Guatemala opera sobre VTEX con una carga excesiva de scripts publicitarios (90+ third-party domains) y múltiples errores estructurales en su backend de checkout. El endpoint `default-order-form` retorna 400 en cada página. Hay un loop infinito de 32 DELETE calls a `ageapproval` que se multiplica con cada producto en el carrito. Cookiebot está configurado con un placeholder de template que nunca fue personalizado, lo que rompe el consent manager. La API key de Google Maps está expuesta en el bundle sin restricción de dominio.

El search tiene un FCP de 9.5s. El checkout carga funcional pero con ~100 requests de tracking por cada navegación.

---

## Issues críticos (5)

| # | Issue | Evidencia |
|---|---|---|
| 1 | **`orderForm 400`** | 12+ llamadas con status 400 al endpoint `GET /api/checkout/pub/orderForm/default-order-form` en cada página del sitio. Error sistémico de backend. |
| 2 | **`ageapproval` DELETE loop** | 32 llamadas DELETE redundantes (16 `ageVerified` + 16 `birthDate`) sin lógica de terminación. Escala con productos en carrito. |
| 3 | **CSS plugins MIME roto** | 8x `ERR_ABORTED` en `plugins-reset.min.css` y `plugins-common.min.css` desde `walmartgt.vteximg.com.br`. MIME type vacío, checkout sin estilos propios. |
| 4 | **Cookiebot placeholder** | Domain group ID literal: `{123e4567-f89a-bced-def0-1234567890ab}` nunca reemplazado. El banner de consentimiento no puede autorizar el dominio. |
| 5 | **Google Maps API key expuesta** | `AIzaSyBkfKiZpVlezmcE1ywp8T3XYTh9HyuDS5o` en 8 requests sin restricción HTTP referrer. |

## Issues altos (8)

| # | Issue | Evidencia |
|---|---|---|
| 6 | **`getCustomLastOrderId` 400** | 24x en checkout. Endpoint de personalización roto cuando el usuario no tiene historial. |
| 7 | **`getPromos` 400** | 8x en checkout. Endpoint de promociones de pago retorna 400. |
| 8 | **GTA `slice` TypeError** | `TypeError: Cannot read properties of undefined (reading 'slice')` en GTM. Rompe analytics en search. |
| 9 | **TikTok Pixel sin configurar** | Warning en cada página: `no valid Pixel ID configured`. Carga el script igual (93 llamadas). |
| 10 | **Meta Pixel conflict** | Dos versiones del pixel cargadas simultáneamente. |
| 11 | **Shared Storage attestation** | 30+ errores repetidos. Google Ad Manager Shared Storage falla en Chrome. |
| 12 | **reCAPTCHA webworker roto** | `webworker.js` status 0 en checkout. Posiblemente CSP bloquea el worker. |
| 13 | **shippingData POST fallido** | 1 request con status 0 al cambiar de Express a Programada. Confirma el bug de cobertura reportado. |

## Issues medios (6)

| # | Issue |
|---|---|
| 14 | Search FCP 9.5s, LoadComplete 27s |
| 15 | favicon.ico 404 |
| 16 | Modal de ubicación con "Aceptar" disabled (UX friction) |
| 17 | 250 recursos, 130 scripts en checkout |
| 18 | Google Maps sin `loading=async` |
| 19 | VTEX render-runtime race condition (`prefetchDefaultPages`) |

---

## Third-party inventory (~90 dominios)

| Categoría | Dominios |
|---|---|
| Ads / RTB | `doubleclick.net`, `criteo.com`, `openx.net`, `taboola.com`, `mgid.com`, `groovinads.com`, `e-planning.net`, `ad-stir.com`, `smartadserver.com`, `360yield.com`, `bidswitch.net`, `outbrain.com`, `socdm.com`, `clmbtech.com`, `creativecdn.com` |
| Analytics | `googletagmanager.com`, `google-analytics.com`, `facebook.net` |
| Social | `tiktok.com` (93 calls), `pinterest.com` |
| Consent | `cookiebot.com` (mal configurado) |
| VTEX infra | `vtex.com.br`, `vtexassets.com`, `vteximg.com.br`, `myvtex.com`, `vtexpayments.com.br`, `io2.vtex.com` |
| Maps | `maps.googleapis.com` (API key expuesta) |
| CDN / Content | `cloudfront.net`, `syndigo.com`, `flixcar.com`, `cdnjs.cloudflare.com` |

---

## Requests más lentos (>2.5s, ambos HARs)

| Duración | Dominio | Tipo |
|---|---|---|
| 6.6s | `smartadserver.com` | RTB cookie sync |
| 3.1s | `socdm.com` | RTB cookie sync |
| 2.7s | `taboola.com` | RTB cookie sync |
| 2.7s | `clmbtech.com` | RTB cookie sync |
| 2.7s | `360yield.com` | RTB cookie sync |
| 2.7s | `vtassets.com` (VTEX polyfill) | Script |

---

## Endpoints VTEX más repetidos

```
82x  POST /_v/private/graphql/v1
78x  GET  /api/sessions
48x  GET  /_v/segment/graphql/v1
42x  POST /_v/segment/graphql/v1
32x  DELETE .../ageapproval (ageVerified + birthDate)
24x  GET  /getCustomLastOrderId  (400)
12x  GET  /api/checkout/pub/orderForm/default-order-form  (400)
10x  POST /api/checkout/pub/orderForms/simulation
 8x  GET  /getPromos/promos-payment-checkout  (400)
```

---

## Recomendaciones (top 5)

1. **Fix `default-order-form` 400**: Es el endpoint que inicializa la sesión de checkout. Falla en TODAS las páginas. Prioridad máxima.
2. **Eliminar el DELETE loop de `ageapproval`**: Agregar condición de salida o debounce. 32 llamadas por sesión es inaceptable.
3. **Configurar Cookiebot**: Reemplazar `{123e4567-f89a-bced-def0-1234567890ab}` con el ID real del dominio.
4. **Restringir Google Maps API key**: Configurar HTTP referrer restriction en Google Cloud Console.
5. **Reducir third-party scripts**: Priorizar carga lazy de ad-tech (Criteo, Taboola, RTBHouse, etc.). Los cookie syncs bloquean el thread hasta 7s.
