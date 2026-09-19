# Agendator

Generador de calendarios y agendas imprimibles a partir de plantillas que **ya incluyen el diseño y los días**. Se conservan las imágenes originales y se sustituyen el mes, los nombres de los días y sus números en sus posiciones. La herramienta se centra en generar el PDF; no incluye una agenda digital para escribir.

## Ejecutar

Requiere Node.js 22.12 o superior.

```sh
npm ci
npm run dev
```

Abre la dirección que muestra Vite (normalmente http://localhost:5173). La instalación prepara automáticamente el motor de reconocimiento y los idiomas español e inglés para servirlos desde la propia aplicación.

## Idioma

El selector de la cabecera permite elegir español o inglés. Cambia la interfaz, los mensajes, los marcadores del editor y las fechas automáticas de las plantillas, miniaturas, vista previa y PDF. Conserva los textos escritos por el usuario y los elementos del diseño. El idioma se recuerda en este navegador; el proyecto sigue siendo temporal.

Los textos se definen mediante las mismas claves en `src/locales/es.js` y `src/locales/en.js`. `src/i18n.ts` resuelve las claves y parámetros, por ejemplo `t("preview.pageCount", { page: 2, total: 10 })`. Para añadir un texto, crea la clave en ambos archivos. Las pruebas comprueban que las claves y los parámetros coincidan. Las fechas se formatean con el idioma del proyecto.

El OCR carga los modelos español e inglés desde `public/ocr`, preparados por `scripts/prepare-ocr.mjs`, y puede reconocer plantillas de cualquiera de los dos idiomas aunque la interfaz esté en el otro. El texto que forma parte de la imagen original se conserva; los campos de fecha detectados se sustituyen en el idioma elegido.

## Crear una agenda con tus plantillas

1. Elige el intervalo de fechas y el formato: día por página, semana por página o semana en dos caras.
   Puedes activar **Añadir vista mensual al inicio de cada mes**: inserta un calendario completo de lunes a domingo antes de las páginas de cada mes, incluido el primero. Los días fuera del intervalo aparecen en gris. En formato de dos caras se añade una cara en blanco junto a cada vista mensual para conservar las parejas de plantillas. Esta vista utiliza una cuadrícula apaisada girada 90° en sentido horario sobre la hoja. La última semana se completa con los días del mes siguiente en un tono muy tenue.
2. Sube las imágenes PNG, JPEG o WebP (hasta 15 MB cada una). En dos caras, carga una plantilla izquierda y otra derecha. Portada y contraportada son opcionales.
3. La aplicación reconoce los días y sus números, el mes y las zonas delimitadas por líneas. Para las plantillas de cuatro días a la izquierda y tres a la derecha, selecciona automáticamente lunes–jueves / viernes–domingo.
4. Revisa la vista previa. En **Ajustar fechas** puedes corregir las posiciones dibujando un rectángulo sobre el texto original, ajustar tamaño, tipografía y colores, y añadir campos que no se hayan reconocido. Las zonas de día delimitan qué se deja en blanco al cortar un mes.
5. Exporta todas las páginas a PDF A4 o A5.

El botón **Cargar las dos plantillas de ejemplo** utiliza las dos imágenes de referencia incluidas en `public/templates/`: cuatro días en la izquierda, tres en la derecha y las secciones originales «Importante» y «Notas».

Las semanas se cortan al cambiar de mes. Al terminar el mes, los días del siguiente completan la semana con fechas y zonas muy tenues; ese mes continúa en otra página o pareja de caras con su intensidad normal. Las posiciones del mes anterior siguen en blanco. La vista previa permite ver una página o dos enfrentadas; portada y contraportada se muestran solas.

## Qué se conserva y qué se sustituye

La imagen de plantilla se conserva como fondo. Se cubren únicamente los campos de texto identificados con su color de fondo y se dibujan los datos del calendario encima, sin añadir otro calendario ni nuevas líneas sobre la plantilla. Las zonas del mes anterior o fuera del intervalo se cubren de blanco; los días del mes siguiente que completan la semana se muestran al 20% de intensidad. Los bloques originales de «Importante» y «Notas» siguen formando parte del diseño.

El reconocimiento utiliza [Tesseract.js](https://github.com/naptha/tesseract.js/blob/master/docs/api.md) en el navegador y reconoce nombres de días y meses en español e inglés, además de números de día y años. No garantiza reconocer todos los diseños: conviene revisar las zonas, especialmente si hay columnas, fondos decorados, texto poco legible o tipografías inusuales. Puedes definir manualmente todos los campos y zonas. La sustitución usa una tipografía serif o sans serif ajustable; no extrae la fuente de una imagen. Los colores de fondo planos pueden ajustarse; no se reconstruyen texturas detrás de los textos.

Sin plantilla se puede previsualizar y exportar el diseño básico. El botón **Crear otra** vacía las plantillas y los ajustes para empezar un calendario nuevo.

## Impresión

Imprime al 100 %, a doble cara, girando por el borde largo. El interior empieza en la página 2 (izquierda); la contraportada termina en página par. Se añade una página vacía cuando es necesario.

Las plantillas con campos se ajustan a toda la página; utiliza imágenes con la proporción del papel. Resolución orientativa: 1748 × 2480 píxeles para A5 y 2480 × 3508 para A4. Las portadas sin campos se recortan centradas para llenar el papel.

El PDF rasteriza cada página a 300 ppp. No contiene texto seleccionable, imposición de cuadernillos, sangrado ni gestión CMYK. La calidad final depende también de la imagen original. Intervalos largos con imágenes grandes consumen más memoria.

## Datos

Plantillas y ajustes se mantienen únicamente en memoria mientras está abierta la página. No se guardan ni se recuperan automáticamente. **Crear otra**, recargar o cerrar la página descarta el proyecto; descarga antes el PDF si quieres conservar el resultado. Al abrir la aplicación se elimina el proyecto que pudieran haber guardado versiones anteriores. No hay sincronización, cuentas ni servidor de datos. El OCR utiliza recursos incluidos en la aplicación, sin enviar tus imágenes a terceros. No se calculan festivos locales.

## Desarrollo

```sh
npm test
npm run lint
npm run build
npm run test:e2e
```

Las pruebas de navegador usan Google Chrome instalado en macOS. En otros entornos:

```sh
npx playwright install chromium
CI=1 npm run test:e2e
```

GitHub Actions comprueba calendario, bisiestos, cortes de mes, reparto de caras, reconocimiento de las plantillas de referencia, edición de campos, reinicio sin persistencia, exportación PDF y navegación móvil. `dist/` se puede publicar en un servidor estático con HTTPS; este repositorio no despliega automáticamente la aplicación.

## Arquitectura

React + TypeScript + Vite. `planner.ts` calcula las páginas. `detect-template.ts` reconoce fechas y propone posiciones. `template.ts` sustituye los campos y borra zonas fuera del mes. `TemplateEditor.tsx` permite ajustar las zonas visualmente. El renderizador SVG se comparte entre la vista previa y el PDF generado con [pdf-lib](https://pdf-lib.js.org/docs/api/classes/pdfdocument). Las fechas se calculan en UTC para evitar cambios por horario de verano.
