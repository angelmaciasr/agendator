import {
  WEEKDAYS,
  type Template,
  type TemplateField,
  type Rect,
} from "./template";
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    prev = next;
  }
  return prev[b.length];
}
export async function detectTemplate(
  data: string,
  progress: (text: string) => void,
): Promise<Template> {
  const img = new Image();
  img.src = data;
  await img.decode();
  const canvas = document.createElement("canvas");
  const ratio = Math.min(1.5, 1600 / img.width);
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const w = canvas.width,
    h = canvas.height,
    sx = 740 / w,
    sy = 1050 / h;
  const pixels = ctx.getImageData(0, 0, w, h).data;
  const colorAt = (x: number, y: number) => {
    const i =
      (Math.max(0, Math.min(h - 1, Math.round(y))) * w +
        Math.max(0, Math.min(w - 1, Math.round(x)))) *
      4;
    return (
      "#" +
      [pixels[i], pixels[i + 1], pixels[i + 2]]
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")
    );
  };
  const rules: number[] = [];
  for (let y = Math.round(h * 0.03); y < h * 0.96; y++) {
    let count = 0;
    for (let x = Math.round(w * 0.1); x < w * 0.89; x++) {
      const i = (y * w + x) * 4;
      if ((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 < 220) count++;
    }
    if (count > w * 0.55 && (!rules.length || y - rules.at(-1)! > h * 0.012))
      rules.push(y);
  }
  const { createWorker, PSM } = await import("tesseract.js");
  const root = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href)
    .href;
  const worker = await createWorker("spa", 1, {
    workerPath: root + "worker.min.js",
    langPath: root.replace(/\/$/, ""),
    corePath: root,
    logger: (m) => {
      if (m.status === "recognizing text")
        progress(`Leyendo fechas… ${Math.round(m.progress * 100)}%`);
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data: ocr } = await worker.recognize(canvas, {}, { blocks: true });
    const words =
      ocr.blocks?.flatMap((b) =>
        b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
      ) || [];
    const detected = words
      .map((word) => {
        const n = normalize(word.text);
        const weekday = WEEKDAYS.findIndex(
          (d) => distance(normalize(d), n) <= 1,
        );
        return { word, weekday };
      })
      .filter((x) => x.weekday >= 0)
      .filter((v, i, a) => a.findIndex((x) => x.weekday === v.weekday) === i);
    const t: Template = { fields: [], days: [] };
    const field = (
      box: { x0: number; y0: number; x1: number; y1: number },
      kind: TemplateField["kind"],
      weekday?: number,
    ): TemplateField => {
      const bh = box.y1 - box.y0,
        cx = (box.x0 + box.x1) / 2;
      const width =
        kind === "number"
          ? Math.max(box.x1 - box.x0 + 4, bh * 1.7)
          : kind === "month"
            ? Math.max(box.x1 - box.x0 + 12, w * 0.3)
            : Math.max(box.x1 - box.x0 + 8, w * 0.13);
      const x = kind === "number" ? cx - width / 2 : box.x0 - 2;
      const y = box.y0 - 3;
      const background = colorAt(box.x0 - 2, box.y0 - 2);
      return {
        x: Math.max(0, x * sx),
        y: Math.max(0, y * sy),
        width: Math.min(width * sx, 740 - x * sx),
        height: (bh + 7) * sy,
        kind,
        weekday,
        fontSize: Math.max(
          8,
          bh * (kind === "month" ? 1.15 : kind === "number" ? 1.3 : 1.3) * sy,
        ),
        font: "serif",
        align: kind === "number" ? "center" : "left",
        color: "#777777",
        background,
      };
    };
    for (const { word, weekday } of detected) {
      const b = word.bbox;
      t.fields.push(field(b, "weekday", weekday));
      const number = words
        .filter(
          (v) =>
            /^\d{1,2}$/.test(v.text) &&
            Math.abs((v.bbox.y0 + v.bbox.y1 - b.y0 - b.y1) / 2) <
              (b.y1 - b.y0) * 1.5 &&
            v.bbox.x1 < b.x0 &&
            b.x0 - v.bbox.x1 < w * 0.1,
        )
        .sort((a, c) => c.bbox.x1 - a.bbox.x1)[0];
      if (number) t.fields.push(field(number.bbox, "number", weekday));
      else {
        const f = field(
          { x0: b.x0 - w * 0.043, y0: b.y0, x1: b.x0 - w * 0.022, y1: b.y1 },
          "number",
          weekday,
        );
        t.fields.push(f);
      }
      const top =
        rules.filter((y) => y < b.y0).at(-1) ?? Math.max(0, b.y0 - h * 0.015);
      const bottom =
        rules.find((y) => y > b.y1 + h * 0.025) ??
        Math.min(h * 0.94, top + h * 0.215);
      const area: Rect = {
        x: w * 0.09 * sx,
        y: Math.max(0, (top - 2) * sy),
        width: 740 * 0.82,
        height: (bottom - top) * sy,
      };
      t.days.push({ weekday, area });
    }
    const months = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    const month = words.find((v) => months.includes(normalize(v.text)));
    if (month) t.fields.push(field(month.bbox, "month"));
    // Glyph height varies (e.g. Jueves has descenders); one size per role keeps the template consistent.
    for (const kind of ["number", "weekday"] as const) {
      const group = t.fields.filter((f) => f.kind === kind);
      const sizes = group.map((f) => f.fontSize).sort((a, b) => a - b);
      const size =
        sizes[Math.floor(sizes.length * (kind === "weekday" ? 0.25 : 0.5))];
      if (size)
        group.forEach((f) => {
          f.fontSize = size;
        });
    }
    return t;
  } finally {
    await worker.terminate();
  }
}
