# FrictionTrace — Reporte Ejecutivo

## walmart.com.gt · 22 de junio 2026

---

## ¿Qué hicimos?

Simulamos una compra real en Walmart.com.gt: buscamos arroz, lo agregamos al carrito, y recorrimos todo el proceso hasta la pantalla de pago. Registramos **todo lo que pasó en la página**: cada error, cada script de terceros que se cargó, cada llamado al servidor, y cuánto tardó cada cosa.

Esta no es una prueba de laboratorio. Es **exactamente lo que le pasa a un cliente real** cuando entra a comprar.

El resultado: **22 de 100 puntos**. Hay problemas graves que están afectando las ventas hoy.

---

## Los 5 problemas críticos

---

### 1. El motor del carrito de compras arranca fallado

**¿Qué pasa?**
Cuando un cliente entra a cualquier página —el inicio, la búsqueda, un producto— el sistema intenta crear su "carrito virtual". Ese primer intento **falla**. El servidor responde con un error. El sistema lo vuelve a intentar. Y vuelve a fallar. Entre 10 y 12 veces por visita.

**¿Qué significa para el negocio?**
Imaginate que cada cliente que entra a la tienda física recibe un carrito con una rueda rota. Puede que igual camine, pero rechina, se traba, y hay clientes que directamente se van. Es el equivalente digital: el sistema que maneja los carritos de compra está respondiendo con error en **todas las páginas del sitio, todo el tiempo**.

**¿A quién afecta?** A todos los clientes, en cada visita.

---

### 2. El checkout se llama a sí mismo sin parar

**¿Qué pasa?**
Durante el proceso de pago, hay dos verificaciones que se ejecutan en loop: una revisa si el cliente es mayor de edad, la otra revisa su fecha de nacimiento. El problema es que **nunca paran de ejecutarse**. Se llaman 16 veces cada una. Con un producto en el carrito son 32 llamadas. Con dos productos, 44. Con tres, 56.

**¿Qué significa para el negocio?**
Es como si en la caja del supermercado, después de pasar cada producto, el cajero llamara por teléfono a gerencia para preguntar "¿este cliente es mayor de edad?" — para cada producto, incluso para el arroz.

Esto hace que:
- El checkout sea más lento
- El servidor reciba el triple de trabajo innecesario
- En horas pico, con muchos clientes, puede saturar el sistema

**¿A quién afecta?** A todos los clientes que llegan al checkout. A los servidores de VTEX. Al costo de infraestructura.

---

### 3. El diseño del checkout está roto

**¿Qué pasa?**
El sistema intenta cargar dos archivos de estilos (`plugins-reset.min.css` y `plugins-common.min.css`) que simplemente **no existen** donde los busca. El navegador los rechaza. Esto pasa 8 veces por sesión.

**¿Qué significa para el negocio?**
Es como si la tienda tuviera carteles escritos a mano con marcador en lugar de los letreros oficiales de Walmart. La página de pago se ve sin el formato correcto: los campos del formulario pueden estar desalineados, los botones sin el color correcto, los textos sin el tamaño adecuado. El cliente siente que "algo no se ve bien", lo que reduce la confianza justo en el momento más crítico: cuando va a pagar.

**¿A quién afecta?** A todos los clientes en la pantalla de pago. Impacta la confianza y la conversión.

---

### 4. El aviso de cookies es un cartel vacío

**¿Qué pasa?**
Walmart Guatemala contrató Cookiebot para gestionar el consentimiento de cookies (ese banner que pregunta si aceptás cookies). Pero nunca configuraron el servicio con los datos reales del sitio. El código que instalaron tiene un valor de prueba: `{123e4567-f89a-bced-def0-1234567890ab}`. Parece un chiste, pero es literalmente lo que dice el código.

**¿Qué significa para el negocio?**
- El banner de cookies **no funciona correctamente**
- Cookiebot mismo advierte: "Este dominio no está autorizado para mostrar este banner"
- Las preferencias de privacidad del cliente no se respetan
- Es un **riesgo legal** en Guatemala y para clientes internacionales

**¿A quién afecta?** A todos los clientes. Al área legal. A la reputación de la marca.

---

### 5. La clave de Google Maps está a la vista de cualquiera

**¿Qué pasa?**
La página de checkout muestra un mapa para que el cliente confirme su dirección de entrega. Para eso usa Google Maps, que requiere una "llave" (API key). Esa llave está escrita directamente en el código de la página, visible para cualquiera que sepa mirar.

**¿Qué significa para el negocio?**
Es como dejar la llave del local colgada en la puerta. Cualquier persona puede copiar esa llave y usar Google Maps desde su propio sitio web **a costa de Walmart**. Si alguien la usa maliciosamente, Walmart recibe la factura de Google. Una API key sin protección puede generar miles de dólares en consumo no autorizado.

**¿A quién afecta?** Al presupuesto de tecnología. La solución existe y toma 5 minutos en Google Cloud Console.

---

## Los 5 problemas altos

---

### 6. El historial de compras responde con error

**¿Qué pasa?**
En la pantalla de checkout, el sistema pregunta 24 veces al servidor: "¿cuál fue la última compra de este cliente?". Las 24 veces el servidor responde con error.

**¿Qué significa para el negocio?**
Es como si un vendedor le preguntara al sistema "¿este cliente ya compró antes?" y el sistema siempre respondiera "ni idea". Se pierde la oportunidad de personalizar la experiencia, recomendar productos basados en compras anteriores, o agilizar el checkout con datos guardados.

**¿A quién afecta?** A la experiencia de re-compra. Clientes frecuentes no reciben ningún beneficio de estar registrados.

---

### 7. Las promociones de pago no funcionan

**¿Qué pasa?**
Existe un sistema que debería mostrar promociones según el método de pago (por ejemplo: "10% de descuento pagando con X tarjeta"). Ese sistema se consulta 8 veces y las 8 veces responde con error.

**¿Qué significa para el negocio?**
Si hay campañas de promociones bancarias o descuentos por método de pago, **no se están mostrando**. El cliente nunca se entera. Es plata que el área de marketing invirtió en campañas que el sitio no puede ejecutar.

**¿A quién afecta?** Al equipo de marketing y alianzas comerciales. A los bancos que pagan por estar en esas promociones.

---

### 8. El medidor de TikTok está enchufado pero no mide nada

**¿Qué pasa?**
En todas las páginas del sitio se carga el script de TikTok Pixel, que sirve para medir conversiones de campañas publicitarias en TikTok. Pero ese script tiene un error de configuración: **no tiene un Pixel ID válido**. Se carga 93 veces por sesión para no hacer nada.

**¿Qué significa para el negocio?**
Es como tener un contador de gente en la puerta que no funciona, pero igual consume electricidad. Si Walmart está pagando publicidad en TikTok, **no puede medir el retorno de esa inversión**. No sabe cuánta gente que vio un anuncio terminó comprando. Y si no está pagando publicidad, está cargando 93 archivos por visita totalmente al pedo.

**¿A quién afecta?** Al equipo de marketing digital. A la velocidad del sitio. Al presupuesto de TikTok Ads (si lo hay).

---

### 9. El pixel de Facebook está duplicado

**¿Qué pasa?**
El código de Meta (Facebook) que mide conversiones está cargado **dos veces**, con versiones distintas y conflictivas entre sí.

**¿Qué significa para el negocio?**
- Las conversiones pueden contarse doble (o no contarse)
- Las audiencias para remarketing se arman con datos incorrectos
- El rendimiento de las campañas de Facebook/Instagram es imposible de medir con precisión

**¿A quién afecta?** Al equipo de marketing. A la precisión del ROI de campañas Meta.

---

### 10. Errores masivos que llenan la consola sin beneficio

**¿Qué pasa?**
Hay 30+ errores repetidos relacionados con Google Ad Manager que no afectan la funcionalidad visible de la página, pero que ocurren constantemente. Son como un ruido de fondo. Además hay un error de programación (`slice` de `undefined`) en el administrador de etiquetas de Google que **rompe el sistema de analytics en las búsquedas**.

**¿Qué significa para el negocio?**
El problema grave es el error en la página de búsqueda. Cuando un cliente busca "arroz", esa búsqueda no se registra correctamente. El equipo no puede saber:
- Qué productos busca la gente
- Qué búsquedas no tienen resultados
- Cuáles son las tendencias de búsqueda

Es como tener una tienda sin saber qué pregunta la gente cuando entra.

**¿A quién afecta?** Al equipo de e-commerce y category management. A la inteligencia de negocio.

---

## Los 6 problemas medios

---

### 11. La búsqueda de productos es lentísima

**¿Qué pasa?**
Cuando un cliente busca un producto (ej. "zapatillas"), la página tarda **9.5 segundos** en mostrar algo y **27 segundos** en terminar de cargar completamente. En esa misma página se registran 52 errores.

**¿Qué significa para el negocio?**
Un cliente que busca "arroz" y ve la pantalla en blanco 10 segundos, probablemente ya se fue a otro sitio. La búsqueda es la herramienta más usada en e-commerce. Si es lenta, **las ventas bajan directo**.

**¿A quién afecta?** A todos los clientes que buscan productos. A la conversión.

---

### 12. Más de 90 empresas miran lo que hace el cliente

**¿Qué pasa?**
Cada vez que un cliente entra a Walmart.com.gt, **90 empresas distintas** reciben información de su visita. No son solo empresas de analytics (como Google). Son más de 20 empresas de publicidad programática que subastan el perfil del cliente en tiempo real mientras la página carga. Algunas de estas comunicaciones tardan entre 3 y 7 segundos.

**¿Qué significa para el negocio?**
- La página se siente lenta porque está ocupada hablando con 90 desconocidos antes de mostrarle algo al cliente
- Se comparte información del cliente con empresas que el cliente no conoce
- Si un cliente entra con una mala conexión, la página puede tardar más de 30 segundos
- Muchos de estos servicios ("cookie syncs") no tienen ningún beneficio directo para Walmart ni para el cliente

**¿A quién afecta?** A la velocidad. A la privacidad del cliente. A la imagen de la marca.

---

### 13. El checkout esconde las formas de pago que más se usan en Guatemala

**¿Qué pasa?**
Cuando el cliente llega a pagar, la pantalla muestra primero las tarjetas de crédito y débito. Si el cliente quiere pagar en **efectivo contra entrega** —el método más popular en Guatemala— tiene que hacer scroll hacia abajo para descubrir que existe esa opción. El diseño da la impresión de que solo se puede pagar con tarjeta.

**¿Qué significa para el negocio?**
Un cliente que prefiere pagar en efectivo puede creer que no es una opción y abandonar la compra. En Guatemala, donde el pago en efectivo sigue siendo dominante, esto es **crítico para la conversión**.

**¿A quién afecta?** A todos los clientes que prefieren efectivo. A la tasa de conversión del checkout.

---

### 14. El selector de ubicación es un portón cerrado

**¿Qué pasa?**
La primera vez que alguien entra al sitio, una ventana bloquea toda la pantalla: "Selecciona dónde deseas que entreguemos tu pedido". El botón de "Aceptar" está bloqueado. El cliente tiene que elegir un Departamento Y un Municipio antes de poder siquiera **ver los productos**.

**¿Qué significa para el negocio?**
Un cliente nuevo, que nunca compró, que solo quiere ver precios o productos, se encuentra con un formulario obligatorio antes de entrar. Muchos simplemente cierran la página. Es como un supermercado que te pide el DNI y la dirección antes de dejarte entrar a mirar.

**¿A quién afecta?** A clientes nuevos. Al tráfico que llega por primera vez desde anuncios o redes sociales.

---

### 15. El ícono de la pestaña del navegador no existe

**¿Qué pasa?**
El `favicon.ico` —ese ícono chiquito que aparece en la pestaña del navegador— da error 404 (no encontrado). Dos URLs diferentes intentan cargarlo y ambas fallan.

**¿Qué significa para el negocio?**
Es un detalle menor, pero habla de falta de atención. La pestaña del navegador muestra un ícono genérico en lugar del logo de Walmart. En un celular, al guardar la página en la pantalla de inicio, tampoco aparece el logo.

**¿A quién afecta?** A la percepción de marca. A la experiencia en mobile.

---

### 16. Google Maps hace más lento el checkout

**¿Qué pasa?**
El mapa de Google Maps en el checkout se carga de forma incorrecta, generando una advertencia de rendimiento. Esto puede causar que el mapa demore en aparecer o que la página se trabe mientras carga.

**¿A quién afecta?** A clientes que necesitan confirmar ubicación de entrega. A la velocidad del checkout.

---

## Resumen visual

```
CRÍTICOS (corregir esta semana):
  ┃  orderForm 400  ████████████████████████  Todo el sitio
  ┃  ageapproval loop  ██████████████████████  Checkout
  ┃  CSS roto  ████████████████████████████  Checkout
  ┃  Cookiebot placeholder  ██████████████████  Legal + UX
  ┃  API key Google Maps  ████████████████████  Seguridad

ALTOS (corregir este mes):
  ┃  Historial compras 400  ██████████████████  Personalización
  ┃  Promos de pago 400  ███████████████████  Marketing
  ┃  TikTok sin configurar  █████████████████  Performance + Datos
  ┃  Meta Pixel duplicado  ██████████████████  Datos
  ┃  Errores en analytics  ██████████████████  Inteligencia

MEDIOS (corregir este trimestre):
  ┃  Búsqueda lenta (27s)  █████████████████  Conversión + UX
  ┃  90 empresas tracking  █████████████████  Performance+ Privacidad
  ┃  Efectivo oculto  ██████████████████████  Conversión
  ┃  Modal ubicación  ██████████████████████  Abandono
  ┃  Sin favicon  █████████████████████████████  Marca
  ┃  Google Maps lento  ████████████████████  Rendimiento
```

---

## ¿Qué significan estos números?

| Métrica | Valor | Referencia |
|---|---|---|
| Score FrictionTrace | 22/100 | < 40 = fricción alta (pérdida de ventas) |
| Errores del servidor por visita | ~100 | Ideal: 0 |
| Empresas externas rastreando | 90 | Tiendas líderes: < 15 |
| Tiempo de carga de búsqueda | 27 segundos | Ideal: < 3 segundos |
| Requests innecesarios por sesión | ~300 | Ideal: < 10 |
| API keys visibles públicamente | 2 | Ideal: 0 |

---

*Reporte ejecutivo generado por FrictionTrace — 22 de junio 2026*
*Para el detalle técnico completo, ver `reports/audit-detailed.md`*
