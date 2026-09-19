import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
const decode = (value: string) =>
  decodeURIComponent(value.slice(value.indexOf(",") + 1));

test("switch languages without losing dates, custom text or editable calendar positions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Idioma", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Set up your planner" }),
  ).toBeVisible();
  await expect(page.getByLabel("Planner name")).toHaveValue("My planner");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByLabel("Planner name").fill("Cuaderno de viaje");
  await page.getByLabel("From", { exact: true }).fill("2026-09-07");
  await page.getByLabel("To", { exact: true }).fill("2026-09-13");
  await page.getByLabel("Week split").selectOption("4");
  await page.getByRole("button", { name: "Continue to templates" }).click();
  await page
    .getByRole("button", { name: "Create left page", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "Create design: Inside pages",
  );
  await expect(
    page.getByRole("button", { name: "Monday", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thursday", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Year", exact: true }).click();
  await page.getByLabel("X position").fill("440");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Content").fill("Mis notas personales");
  await page.screenshot({ path: "test-results/designer-english.png" });
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  const englishThumb = decode(
    (await page.getByAltText("Thumbnail of left page").getAttribute("src"))!,
  );
  expect(englishThumb).toContain(">Monday</text>");
  expect(englishThumb).toContain("Mis notas personales");
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await page
    .getByRole("button", {
      name: "Editar diseño de página izquierda",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Lunes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Año", exact: true }).click();
  await expect(page.getByLabel("Posición X")).toHaveValue("440");
  await page
    .getByRole("button", { name: "Texto · Mis notas personales", exact: true })
    .click();
  await expect(page.getByLabel("Contenido")).toHaveValue(
    "Mis notas personales",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByLabel("Idioma", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Open preview", exact: true }).click();
  const preview = decode(
    (await page
      .getByAltText("Preview of page 2", { exact: true })
      .getAttribute("src"))!,
  );
  expect(preview).toContain(">September</text>");
  expect(preview).toContain(">Monday</text>");
  expect(preview).toContain("Mis notas personales");
  expect(preview).not.toContain("Lunes");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await (await downloaded).saveAs("test-results/english-planner.pdf");
  const pdf = await PDFDocument.load(
    await readFile("test-results/english-planner.pdf"),
  );
  expect(pdf.getTitle()).toBe("Cuaderno de viaje");
  expect(pdf.getPageCount()).toBe(4);
  await page.getByRole("button", { name: "1 Calendar" }).click();
  await expect(page.getByLabel("Planner name")).toHaveValue(
    "Cuaderno de viaje",
  );
  await expect(page.getByLabel("From", { exact: true })).toHaveValue(
    "2026-09-07",
  );
  await page
    .getByLabel("Add a monthly overview at the start of each month")
    .check();
  await page.getByRole("button", { name: "3 Preview" }).click();
  await page.getByLabel("Go to page").selectOption("1");
  expect(
    decode(
      (await page
        .getByAltText("Preview of page 2", { exact: true })
        .getAttribute("src"))!,
    ),
  ).toContain("Sunday");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "test-results/english-mobile.png" });
  await page.reload();
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("en");
  await expect(page.getByLabel("Planner name")).toHaveValue("My planner");
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await expect(page.getByLabel("Nombre de la agenda")).toHaveValue("Mi agenda");
});

test("recognize English template text, numbers on the right, month and year with either UI language", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Idioma", { exact: true }).selectOption("en");
  await page.getByLabel("From", { exact: true }).fill("2026-09-07");
  await page.getByLabel("To", { exact: true }).fill("2026-09-13");
  await page.getByRole("radio", { name: /One week per page/ }).check();
  await page.getByRole("button", { name: "Continue to templates" }).click();
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 900, 1200);
    ctx.fillStyle = "#292524";
    ctx.font = "36px sans-serif";
    ctx.fillText("January", 100, 90);
    ctx.fillText("2042", 600, 90);
    [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ].forEach((day, i) => {
      ctx.fillText(day, 100, 200 + i * 130);
      const width = ctx.measureText(day).width;
      ctx.fillText(String(i + 10), 115 + width, 200 + i * 130);
    });
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const file = {
    name: "english-week.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  };
  await page.getByLabel("Inside pages", { exact: true }).setInputFiles(file);
  await expect(
    page.getByText("7 days · 16 fields", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Adjust dates", exact: true }).click();
  await page
    .getByLabel("Field or area", { exact: true })
    .selectOption({ label: "Year" });
  await expect(page.getByLabel("New field")).toBeVisible();
  await page.getByRole("button", { name: "View result", exact: true }).click();
  await page.getByRole("button", { name: "Open preview", exact: true }).click();
  const english = decode(
    (await page
      .getByAltText("Preview of page 2", { exact: true })
      .getAttribute("src"))!,
  );
  expect(english).toContain(">Monday</text>");
  expect(english).toContain(">September</text>");
  expect(english).toContain(">2026</text>");
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  const spanish = decode(
    (await page
      .getByAltText("Vista previa de la página 2", { exact: true })
      .getAttribute("src"))!,
  );
  expect(spanish).toContain(">Lunes</text>");
  expect(spanish).toContain(">septiembre</text>");
  await page.getByRole("button", { name: "2 Plantillas" }).click();
  await page
    .getByLabel("Páginas interiores", { exact: true })
    .setInputFiles(file);
  await expect(
    page.getByText("7 días · 16 campos", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole("button", { name: "Ver vista previa", exact: true }),
  ).toBeEnabled();
});
