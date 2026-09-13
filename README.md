# Agendator

Asistente visual en español para crear agendas imprimibles con diseños propios y utilizarlas como agenda digital.

## Ejecutar

Requiere Node.js 22.12 o superior.

```sh
npm ci
npm run dev
```

Abre la dirección que muestra Vite (normalmente http://localhost:5173).

## Funciones

- Asistente de calendario, diseños e impresión; intervalo personalizable de hasta dos años.
- Un día por página, una semana por página o una semana en dos caras (lunes–miércoles / jueves–domingo o lunes–jueves / viernes–domingo).
- Las semanas se cortan al cambiar de mes. Las posiciones del otro mes quedan completamente en blanco y el mes siguiente empieza en otra página o pareja de caras.
- Portada, contraportada, plantilla interior, plantilla derecha y diseño individual para cualquier página. Admite PNG, JPEG y WebP de hasta 15 MB por imagen.
- Vista previa de una página o dos enfrentadas, con navegación por página o pareja; portada y contraportada se muestran solas. Se puede seleccionar y escribir en cualquiera de las caras.
- Navegación por fecha, color y márgenes ajustables.
- Escritura por día y almacenamiento local en IndexedDB; copias JSON para restaurar o transferir la agenda.
- PDF A4 o A5 a 300 ppp, con o sin notas, con contraportada en página par para impresión a doble cara.
- Interfaz adaptable a móvil; el botón de menú abre la configuración.

## Impresión y diseños

Imprime al 100 %, a doble cara, girando por el borde largo. Las páginas están en orden de lectura, sin imposición de cuadernillos. En formato de dos caras, el interior empieza en la página 2 (izquierda). Se añade una página vacía si es necesaria para que la contraportada termine una hoja.

Las imágenes llenan la página y se recortan centradas cuando la proporción difiere del papel. Usa aproximadamente 1748 × 2480 píxeles para A5 o 2480 × 3508 para A4. Puedes ajustar la zona del calendario o desactivar su superposición si tu plantilla ya tiene todo el contenido. No se interpretan automáticamente las casillas de una imagen. No se importan plantillas PDF.

El PDF rasteriza cada página; no tiene texto seleccionable, sangrado ni gestión CMYK. Las notas que exceden su casilla se recortan visualmente con «…», pero se guardan completas en la agenda digital y la copia JSON. Los documentos largos con diseños pesados pueden requerir memoria y tiempo de exportación.

## Datos

No requiere cuentas, servidor ni claves API. Diseños y notas permanecen en este navegador; no hay sincronización entre dispositivos. Guarda una copia JSON antes de borrar datos del navegador o abrir otra copia (que sustituye el proyecto actual). No se calculan festivos locales.

## Desarrollo y comprobación

```sh
npm test
npm run lint
npm run build
npm run test:e2e
```

Las pruebas de navegador usan Google Chrome instalado en macOS. Para usar Chromium de Playwright en otros entornos:

```sh
npx playwright install chromium
CI=1 npm run test:e2e
```

Las pruebas cubren años bisiestos, cambio de mes y año, integridad de fechas, caras de impresión, validación de copias, carga de imágenes, persistencia de notas, exportación PDF y anchura móvil. GitHub Actions ejecuta estas comprobaciones.

`npm run build` genera `dist/`, desplegable en un servidor de archivos estáticos con HTTPS. Este repositorio no despliega automáticamente la aplicación.

## Arquitectura

React + TypeScript + Vite. `src/planner.ts` calcula las páginas y comparte el renderizador SVG entre la vista previa y el PDF. `src/export.ts` genera el documento con [pdf-lib](https://pdf-lib.js.org/docs/api/classes/pdfdocument). IndexedDB utiliza `idb-keyval`. Las fechas se calculan en UTC para evitar cambios por horario de verano.
