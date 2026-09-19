import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
const source = async (page: import("@playwright/test").Page, n: number) =>
  decodeURIComponent(
    (await page
      .getByAltText(`Vista previa de la página ${n}`, { exact: true })
      .getAttribute("src"))!
      .split(",")
      .slice(1)
      .join(","),
  );
test("uploaded templates keep their artwork, replace dates, export and start another", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Mi agenda", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Nombre de la agenda")
    .fill("Calendario con mis plantillas");
  await page.getByLabel("Desde", { exact: true }).fill("2026-09-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-10-04");
  await page
    .getByRole("button", { name: "Continuar con las plantillas" })
    .click();
  await page
    .getByLabel("Página izquierda", { exact: true })
    .setInputFiles("public/templates/semana-izquierda.png");
  await expect(page.getByText("4 días · 9 campos")).toBeVisible({
    timeout: 60000,
  });
  await page
    .getByLabel("Página derecha", { exact: true })
    .setInputFiles("public/templates/semana-derecha.png");
  await expect(page.getByText("3 días · 6 campos")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator(".paper")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ver vista previa", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Exportar PDF" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Dos páginas", exact: true }).click();
  const first = await source(page, 2);
  expect(first).toContain("septiembre</text>");
  expect(first).toContain("Martes</text>");
  expect(first).not.toContain("Lunes</text>");
  expect(first).not.toContain("<line");
  expect(first).toContain(">1</text>");
  await page.screenshot({
    path: "test-results/template-september.png",
    fullPage: true,
  });
  await page.getByLabel("Ir a página").selectOption("9");
  expect(await source(page, 10)).toContain('opacity="0.2">1</text>');
  await page.screenshot({
    path: "test-results/month-transition.png",
    fullPage: true,
  });
  await page.getByLabel("Ir a página").selectOption("11");
  expect(await source(page, 12)).toContain("octubre</text>");
  expect(await source(page, 12)).toContain("Jueves</text>");
  expect(await source(page, 12)).not.toContain("Miércoles</text>");
  await page.screenshot({
    path: "test-results/template-october.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "2 Plantillas" }).click();
  await page
    .getByRole("button", { name: "Ajustar fechas", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Campo o zona").selectOption({ label: "Mes" });
  await page.getByLabel("Tamaño del texto", { exact: true }).fill("28");
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await page.getByRole("button", { name: "3 Vista previa" }).click();
  const pdfEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar PDF", exact: true })
    .click();
  const pdf = await pdfEvent;
  await pdf.saveAs("test-results/template-calendar.pdf");
  const doc = await PDFDocument.load(
    await readFile("test-results/template-calendar.pdf"),
  );
  expect(doc.getPageCount()).toBe(14);
  expect(doc.getPage(0).getWidth()).toBeCloseTo(419.528);
  await page.getByRole("button", { name: "1 Calendario" }).click();
  await page.getByLabel("Añadir vista mensual al inicio de cada mes").check();
  await page.getByRole("button", { name: "3 Vista previa" }).click();
  await page.getByLabel("Ir a página").selectOption("1");
  const monthly = await source(page, 2);
  expect(monthly).toContain("septiembre</text>");
  expect(monthly).toContain("2026</text>");
  expect(monthly).toContain('transform="translate(740 0) rotate(90)"');
  expect(monthly).toContain('fill="#dddddd">1</text>');
  expect(monthly).toContain("Domingo</text>");
  expect(monthly).not.toContain("<image");
  await page.getByRole("button", { name: "Dos páginas", exact: true }).click();
  expect(await source(page, 3)).not.toContain("<image");
  await expect(
    page.getByRole("option").filter({ hasText: "Vista mensual" }),
  ).toHaveCount(2);

  await page.screenshot({
    path: "test-results/monthly-preview.png",
    fullPage: true,
  });
  const monthlyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF", exact: true }).click();
  await (await monthlyDownload).saveAs("test-results/monthly-calendar.pdf");
  const monthlyDoc = await PDFDocument.load(
    await readFile("test-results/monthly-calendar.pdf"),
  );
  expect(monthlyDoc.getPageCount()).toBe(18);
  await page.getByRole("button", { name: "1 Calendario" }).click();
  await expect(
    page.getByLabel("Añadir vista mensual al inicio de cada mes"),
  ).toBeChecked();
  await page.getByLabel("Añadir vista mensual al inicio de cada mes").uncheck();
  await page.getByRole("button", { name: "3 Vista previa" }).click();
  await expect(
    page.getByRole("option").filter({ hasText: "Vista mensual" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dos páginas", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "test-results/template-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Crear otra", exact: true }).click();
  await expect(page.getByLabel("Nombre de la agenda")).toHaveValue("Mi agenda");
  await expect(
    page.getByLabel("Añadir vista mensual al inicio de cada mes"),
  ).not.toBeChecked();
  await expect(page.locator(".paper")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "3 Vista previa" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Continuar con las plantillas" })
    .click();
  await expect(
    page.getByRole("button", { name: "Ajustar fechas", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/create-another-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("single and double page navigation, invalid dates and no browser persistence", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Desde", { exact: true }).fill("2028-03-06");
  await page.getByLabel("Hasta", { exact: true }).fill("2028-03-19");
  await page.getByLabel("Reparto de la semana").selectOption("4");
  await expect(page.locator(".paper")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/calendar-step.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Continuar con las plantillas" })
    .click();
  await page.screenshot({
    path: "test-results/templates-step.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ver vista previa", exact: true })
    .click();
  await expect(page.locator(".paper")).toHaveCount(1);
  await page.getByRole("button", { name: "Dos páginas", exact: true }).click();
  await expect(page.locator(".paper")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Página siguiente", exact: true })
    .click();
  await expect(
    page.getByAltText("Vista previa de la página 4", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Página siguiente", exact: true })
    .click();
  await expect(page.locator(".paper")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Página siguiente", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Ir a página").selectOption("0");
  await expect(
    page.getByRole("button", { name: "Página anterior", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "1 Calendario" }).click();
  await page.getByLabel("Hasta", { exact: true }).fill("2026-01-01");
  await expect(
    page.getByRole("button", { name: "Continuar con las plantillas" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "3 Vista previa" }),
  ).toBeDisabled();
  await page.getByLabel("Nombre de la agenda").fill("No guardar este proyecto");
  await page.reload();
  await expect(page.getByLabel("Nombre de la agenda")).toHaveValue("Mi agenda");
  await expect(
    page.getByRole("button", { name: "Continuar con las plantillas" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Guardar copia" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Abrir copia" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Guardado en este navegador")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const req = indexedDB.open("keyval-store");
            req.onsuccess = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains("keyval")) {
                db.close();
                resolve(null);
                return;
              }
              const read = db
                .transaction("keyval", "readonly")
                .objectStore("keyval")
                .get("agendator-project");
              read.onsuccess = () => {
                db.close();
                resolve(read.result ?? null);
              };
            };
          }),
      ),
    )
    .toBeNull();
});

test("create, edit and export a design with shapes, text and pasted images", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Desde", { exact: true }).fill("2026-09-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-09-07");
  await page
    .getByRole("button", { name: "Continuar con las plantillas" })
    .click();
  await expect(
    page.getByRole("button", { name: "Cargar las dos plantillas de ejemplo" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Crear portada", exact: true })
    .click();
  await page.getByRole("button", { name: "Rectángulo", exact: true }).click();
  await page.getByLabel("Color del elemento").fill("#b45309");
  await page.getByRole("button", { name: "Texto", exact: true }).click();
  await page.getByLabel("Contenido").fill("Mi agenda creativa");
  await page.getByLabel("Posición Y").fill("400");
  const hit = page.locator(".designer-element.selected");
  const box = (await hit.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 50);
  await page.mouse.up();
  expect(
    Number(await page.getByLabel("Posición Y").inputValue()),
  ).toBeGreaterThan(400);
  await page.getByRole("button", { name: "Duplicar", exact: true }).click();
  await expect(page.locator(".designer-element")).toHaveCount(3);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".designer-element")).toHaveCount(2);
  await page.getByRole("dialog").evaluate((dialog) => {
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const data = new DataTransfer();
    data.items.add(new File([bytes], "pegada.png", { type: "image/png" }));
    dialog.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
    );
  });
  await expect(page.locator(".designer-element")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Guardar diseño", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Editar diseño de portada", exact: true })
    .click();
  await expect(page.locator(".designer-element")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Texto · Mi agenda creativa", exact: true })
    .click();
  await expect(page.getByLabel("Contenido")).toHaveValue("Mi agenda creativa");
  await page.screenshot({
    path: "test-results/page-designer.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "test-results/page-designer-mobile.png",
    fullPage: false,
  });
  await page.getByLabel("Contenido").fill("Cambio descartado");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear página izquierda", exact: true })
    .click();
  await expect(page.getByLabel("Mantener calendario automático")).toBeChecked();
  await page
    .getByRole("button", { name: "Guardar diseño", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver vista previa", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Exportar PDF" }),
  ).toBeEnabled();
  await page.getByLabel("Ir a página").selectOption("0");
  expect(await source(page, 1)).toContain("Mi agenda creativa");
  expect(await source(page, 1)).not.toContain("Cambio descartado");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  await (await event).saveAs("test-results/designed-calendar.pdf");
  const doc = await PDFDocument.load(
    await readFile("test-results/designed-calendar.pdf"),
  );
  expect(doc.getPageCount()).toBeGreaterThan(2);
});

test("designer zoom, live artwork and alignment guides preserve design coordinates", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continuar con las plantillas" })
    .click();
  await page
    .getByRole("button", { name: "Crear portada", exact: true })
    .click();
  await page.getByRole("button", { name: "Rectángulo", exact: true }).click();
  await page.getByLabel("Zoom del lienzo").selectOption("0.5");
  const paper = page.getByLabel("Lienzo de diseño", { exact: true });
  expect((await paper.boundingBox())!.width).toBeCloseTo(370);
  const item = page.locator(".designer-element.selected");
  const source = await item.locator("img").getAttribute("src");
  const box = (await item.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  // Centre is x=230, y=455; approach within the 5-screen-pixel snap tolerance.
  await page.mouse.move(box.x + 20 + 129 * 0.5, box.y + 20 + 304 * 0.5);
  await expect(page.getByLabel("Posición X")).toHaveValue("230");
  await expect(page.getByLabel("Posición Y")).toHaveValue("455");
  await expect(page.locator(".alignment-guide")).toHaveCount(2);
  await expect(
    page.getByLabel("Izquierda: 230 px", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Derecha: 230 px", { exact: true }),
  ).toBeVisible();
  expect(await item.locator("img").getAttribute("src")).toBe(source);
  await page.mouse.up();
  await expect(page.getByLabel("Posición X")).toHaveValue("230");
  await page.screenshot({ path: "test-results/designer-guides.png" });
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.getByLabel("Posición X")).toHaveValue("100");
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(page.getByLabel("Posición X")).toHaveValue("230");
  await page.getByLabel("Zoom del lienzo").selectOption("2");
  expect((await paper.boundingBox())!.width).toBeCloseTo(1480);
  await expect(page.getByLabel("Posición X")).toHaveValue("230");
  await page.getByLabel("Guías y ajuste automático").uncheck();
  await expect(page.locator(".designer-guides")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByLabel("Zoom del lienzo").selectOption("fit");
  expect((await paper.boundingBox())!.width).toBeLessThan(390);
  await page.screenshot({ path: "test-results/designer-zoom-mobile.png" });
});

test("resize from all four sides and the corner at 50% zoom", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continuar con las plantillas" })
    .click();
  await page
    .getByRole("button", { name: "Crear portada", exact: true })
    .click();
  await page.getByRole("button", { name: "Rectángulo", exact: true }).click();
  await page.getByLabel("Zoom del lienzo").selectOption("0.5");
  for (const [handle, dx, dy, width, height, x, y] of [
    ["e", 20, 0, 320, 140, 100, 150],
    ["w", -20, 0, 320, 140, 60, 150],
    ["n", 0, -20, 280, 180, 100, 110],
    ["s", 0, 20, 280, 180, 100, 150],
    ["se", 20, 20, 320, 180, 100, 150],
  ] as const) {
    const box = (await page
      .locator(`[data-resize="${handle}"]`)
      .boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + dx,
      box.y + box.height / 2 + dy,
    );
    await page.mouse.up();
    await expect(page.getByLabel("Ancho", { exact: true })).toHaveValue(
      String(width),
    );
    await expect(page.getByLabel("Alto", { exact: true })).toHaveValue(
      String(height),
    );
    await expect(page.getByLabel("Posición X")).toHaveValue(String(x));
    await expect(page.getByLabel("Posición Y")).toHaveValue(String(y));
    await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  }
});

test("saved and uploaded assets have thumbnails and the designer uses full placeholder weeks", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Desde", { exact: true }).fill("2026-09-09");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-09-09");
  await page.getByLabel("Reparto de la semana").selectOption("4");
  await page
    .getByRole("button", { name: "Continuar con las plantillas" })
    .click();
  await page
    .getByLabel("Portada", { exact: true })
    .setInputFiles("public/templates/semana-izquierda.png");
  await expect(
    page.getByAltText("Miniatura de portada", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Crear página izquierda", exact: true })
    .click();
  const decode = (s: string) => decodeURIComponent(s.slice(s.indexOf(",") + 1));
  for (const day of ["Lunes", "Martes", "Miércoles", "Jueves"])
    await expect(
      page.getByRole("button", { name: day, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Viernes", exact: true }),
  ).toHaveCount(0);
  expect(
    decode(
      (await page
        .locator('[data-element-id="calendar-year"] img')
        .getAttribute("src"))!,
    ),
  ).toContain("YYYY");
  await page.getByRole("button", { name: "Rectángulo", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar diseño", exact: true })
    .click();
  const thumb = page.getByAltText("Miniatura de página izquierda", {
    exact: true,
  });
  await expect(thumb).toBeVisible();
  expect(decode((await thumb.getAttribute("src"))!)).toContain("Jueves");
  await page
    .getByRole("button", { name: "Crear página derecha", exact: true })
    .click();
  for (const day of ["Viernes", "Sábado", "Domingo"])
    await expect(
      page.getByRole("button", { name: day, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Jueves", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Guardar diseño", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/asset-thumbnails.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ver vista previa", exact: true })
    .click();
  const preview = await source(page, 2);
  expect(preview).toContain("septiembre");
  expect(preview).toContain("2026");
  expect(preview).not.toContain("YYYY");
  expect(preview).not.toContain(" XX");
});

test("calendar fields and rules are editable and keep automatic dates after saving", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Desde", { exact: true }).fill("2026-09-07");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-09-13");
  await page
    .getByRole("button", { name: "Continuar con las plantillas" })
    .click();
  await page
    .getByRole("button", { name: "Crear página izquierda", exact: true })
    .click();
  await page.getByLabel("Zoom del lienzo").selectOption("0.5");
  await page.getByLabel("Guías y ajuste automático").uncheck();
  const month = page.locator('[data-element-id="calendar-month"]');
  const box = (await month.boundingBox())!;
  await page.mouse.move(box.x + 15, box.y + 7);
  await page.mouse.down();
  await page.mouse.move(box.x + 35, box.y + 27);
  await page.mouse.up();
  const monthX = await page.getByLabel("Posición X").inputValue();
  expect(Number(monthX)).toBeGreaterThan(100);
  await page.getByRole("button", { name: "Año", exact: true }).click();
  await page.getByLabel("Posición X").fill("450");
  await page
    .getByRole("button", { name: "Número · Lunes", exact: true })
    .click();
  await page.getByLabel("Posición X").fill("350");
  await page
    .getByRole("button", { name: "Separador · Lunes", exact: true })
    .click();
  await page.getByLabel("Ancho", { exact: true }).fill("300");
  await page
    .getByRole("button", { name: "Guardar diseño", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Editar diseño de página izquierda",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Mes", exact: true }).click();
  await expect(page.getByLabel("Posición X")).toHaveValue(monthX);
  await page
    .getByRole("button", { name: "Número · Lunes", exact: true })
    .click();
  await expect(page.getByLabel("Posición X")).toHaveValue("350");
  await page
    .getByRole("button", { name: "Separador · Lunes", exact: true })
    .click();
  await expect(page.getByLabel("Ancho", { exact: true })).toHaveValue("300");
  await page.screenshot({ path: "test-results/editable-calendar.png" });
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver vista previa", exact: true })
    .click();
  const rendered = await source(page, 2);
  expect(rendered).toContain("translate(350");
  expect(rendered).toContain(">7</text>");
  expect(rendered).toContain(">2026</text>");
  expect(rendered).not.toContain("YYYY");
  expect(rendered).not.toContain("XX");
});

test("writing areas switch between lines and grid and persist to preview and PDF", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Desde", { exact: true }).fill("2026-09-07");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-09-13");
  await page
    .getByRole("button", { name: "Continuar con las plantillas" })
    .click();
  await page
    .getByRole("button", { name: "Crear página izquierda", exact: true })
    .click();
  await expect(page.locator('[data-element-id*="-line-"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Área para escribir", exact: true })
    .click();
  await expect(page.getByLabel("Tipo de área")).toHaveValue("lines");
  await page.getByLabel("Tipo de área").selectOption("grid");
  await page.getByLabel("Separación (px)").fill("25");
  await page.getByLabel("Ancho", { exact: true }).fill("400");
  await page.getByLabel("Alto", { exact: true }).fill("180");
  await page.getByLabel("Posición Y").fill("200");
  const art = decodeURIComponent(
    (await page.locator(".designer-element.selected img").getAttribute("src"))!,
  );
  expect(art).toContain('data-writing-area="grid"');
  expect(art).toContain("M 25 0 V 180");
  await page.screenshot({ path: "test-results/writing-area-grid.png" });
  await page
    .getByRole("button", { name: "Guardar diseño", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Editar diseño de página izquierda",
      exact: true,
    })
    .click();
  await page
    .locator(".designer-layers")
    .getByRole("button", { name: "Área para escribir", exact: true })
    .click();
  await expect(page.getByLabel("Tipo de área")).toHaveValue("grid");
  await expect(page.getByLabel("Separación (px)")).toHaveValue("25");
  await expect(page.getByLabel("Ancho", { exact: true })).toHaveValue("400");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver vista previa", exact: true })
    .click();
  expect(await source(page, 2)).toContain('data-writing-area="grid"');
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  await (await event).saveAs("test-results/writing-area.pdf");
  const doc = await PDFDocument.load(
    await readFile("test-results/writing-area.pdf"),
  );
  expect(doc.getPageCount()).toBeGreaterThan(2);
});
