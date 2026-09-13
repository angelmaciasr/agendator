import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
test("configure, upload, write, persist, back up and export printable PDF", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Nombre de la agenda").fill("Agenda de prueba");
  await page.getByLabel("Desde", { exact: true }).fill("2028-02-28");
  await page.getByLabel("Hasta", { exact: true }).fill("2028-03-05");
  await page.getByRole("radio", { name: "Una semana en dos caras" }).check();
  await page.getByRole("button", { name: "Continuar con los diseños" }).click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("Portada", { exact: true })
    .setInputFiles({ name: "portada.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("portada.png")).toBeVisible();
  await page.getByRole("button", { name: "Mi agenda", exact: true }).click();
  await page.getByLabel("Ir a una fecha").fill("2028-02-29");
  await page
    .getByLabel("Notas del día")
    .fill("Reunión a las 10:00. Café, ilusión y próximos pasos. ✓");
  await expect(page.getByText("Guardado en este navegador")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mi agenda", exact: true }).click();
  await page.getByLabel("Ir a una fecha").fill("2028-02-29");
  await expect(page.getByLabel("Notas del día")).toContainText("Reunión");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  const backupEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Guardar copia", exact: true })
    .click();
  const backup = await backupEvent;
  const backupPath = await backup.path();
  expect(
    JSON.parse(await readFile(backupPath!, "utf8")).notes["2028-02-29"],
  ).toContain("Reunión");
  await page.getByRole("button", { name: "Crear agenda", exact: true }).click();
  await page.getByRole("button", { name: "3 Impresión" }).click();
  await page.getByLabel("Incluir mis notas en el PDF").check();
  const pdfEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar PDF", exact: true })
    .click();
  const pdf = await pdfEvent;
  await pdf.saveAs("test-results/agenda.pdf");
  const doc = await PDFDocument.load(await readFile("test-results/agenda.pdf"));
  expect(doc.getPageCount()).toBe(6);
  expect(doc.getPage(0).getWidth()).toBeCloseTo(419.528);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "Mostrar configuración" }).click();
  await expect(
    page.getByRole("heading", { name: "Lista para imprimir" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("invalid interval disables export and invalid backups show an error", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Desde", { exact: true }).fill("2027-01-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-01-01");
  await expect(
    page.getByRole("button", { name: "Exportar PDF" }),
  ).toBeDisabled();
  await page
    .locator('input[accept="application/json,.json"]')
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1}'),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "Esta copia no es válida" }),
  ).toBeVisible();
});
