import { mkdir, readdir, copyFile } from "node:fs/promises";
await mkdir("public/ocr", { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/ocr/worker.min.js",
);
for (const file of await readdir("node_modules/tesseract.js-core")) {
  if (file.endsWith(".wasm.js") || file.endsWith(".wasm"))
    await copyFile(
      `node_modules/tesseract.js-core/${file}`,
      `public/ocr/${file}`,
    );
}
for (const language of ["spa", "eng"]) {
  await copyFile(
    `node_modules/@tesseract.js-data/${language}/4.0.0/${language}.traineddata.gz`,
    `public/ocr/${language}.traineddata.gz`,
  );
}
