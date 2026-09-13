import { pages, svg, type Project } from "./planner";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function exportPDF(
  p: Project,
  includeNotes: boolean,
  progress: (n: number) => void,
) {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(p.title);
  doc.setCreator("Agendator");
  const all = pages(p);
  for (let i = 0; i < all.length; i++) {
    const url = URL.createObjectURL(
      new Blob([svg(p, all[i], includeNotes)], { type: "image/svg+xml" }),
    );
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = p.size === "A4" ? 2480 : 1748;
      canvas.height = p.size === "A4" ? 3508 : 2480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar la página.");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const jpg = await doc.embedJpg(canvas.toDataURL("image/jpeg", 0.92));
      const dimensions: [number, number] =
        p.size === "A4" ? [595.276, 841.89] : [419.528, 595.276];
      doc
        .addPage(dimensions)
        .drawImage(jpg, {
          x: 0,
          y: 0,
          width: dimensions[0],
          height: dimensions[1],
        });
      canvas.width = 0;
      canvas.height = 0;
    } finally {
      URL.revokeObjectURL(url);
    }
    progress(Math.round(((i + 1) / all.length) * 100));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const bytes = await doc.save();
  download(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `${p.title.replace(/[^\p{L}\p{N}_-]/gu, "-") || "agenda"}.pdf`,
  );
}
