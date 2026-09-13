import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile, writeFile } from "node:fs/promises";
const source = async (page: import("@playwright/test").Page, n: number) =>
  decodeURIComponent(
    (await page
      .getByAltText(`Vista previa de la página ${n}`, { exact: true })
      .getAttribute("src"))!
      .split(",")
      .slice(1)
      .join(","),
  );
test("uploaded templates keep their artwork, replace dates, persist and export", async ({
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
  await page.getByLabel("Ir a página").selectOption("11");
  expect(await source(page, 12)).toContain("octubre</text>");
  expect(await source(page, 12)).toContain("Jueves</text>");
  expect(await source(page, 12)).not.toContain("Miércoles</text>");
  await page.screenshot({
    path: "test-results/template-october.png",
    fullPage: true,
  });
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Guardar copia", exact: true })
    .click();
  const backup = await downloadEvent;
  const backupPath = await backup.path();
  const p = JSON.parse(await readFile(backupPath!, "utf8"));
  expect(p.assets.inside.template.days).toHaveLength(4);
  expect(p.spreadSplit).toBe(4);
  await writeFile("test-results/template-project.json", JSON.stringify(p));
  await expect(page.getByText("Guardado en este navegador")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "2 Diseños" }).click();
  await expect(page.getByText("4 días · 9 campos")).toBeVisible();
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dos páginas", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "test-results/template-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("single and double page navigation, invalid dates and backup validation", async ({
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
