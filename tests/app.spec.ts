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
  await page.getByRole("button", { name: "Continuar con los diseños" }).click();
  await page
    .getByRole("button", { name: "Cargar las dos plantillas de ejemplo" })
    .click();
  await expect(page.getByText("4 días · 9 campos")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByText("3 días · 6 campos")).toBeVisible({
    timeout: 60000,
  });
  await expect(
    page.getByRole("button", { name: "Exportar PDF" }),
  ).toBeEnabled();
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
  await page.screenshot({ path: "test-results/month-transition.png", fullPage: true });
  await page.getByLabel("Ir a página").selectOption("11");
  expect(await source(page, 12)).toContain("octubre</text>");
  expect(await source(page, 12)).toContain("Jueves</text>");
  expect(await source(page, 12)).not.toContain("Miércoles</text>");
  await page.screenshot({
    path: "test-results/template-october.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ajustar fechas", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Campo o zona").selectOption({ label: "Mes" });
  await page.getByLabel("Tamaño del texto", { exact: true }).fill("28");
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await page.getByRole("button", { name: "3 Impresión" }).click();
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
  await expect(
    page.getByLabel("Añadir vista mensual al inicio de cada mes"),
  ).toBeChecked();
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
  await page.getByLabel("Añadir vista mensual al inicio de cada mes").uncheck();
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
  await expect(page.locator(".paper")).toHaveCount(1);
  await page.getByRole("button", { name: "2 Diseños" }).click();
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
  await page.getByLabel("Hasta", { exact: true }).fill("2026-01-01");
  await expect(
    page.getByRole("button", { name: "Exportar PDF" }),
  ).toBeDisabled();
  await page.getByLabel("Nombre de la agenda").fill("No guardar este proyecto");
  await page.reload();
  await expect(page.getByLabel("Nombre de la agenda")).toHaveValue("Mi agenda");
  await expect(
    page.getByRole("button", { name: "Exportar PDF" }),
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
