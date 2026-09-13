import { mkdir, readdir, copyFile } from 'node:fs/promises';
await mkdir('public/ocr', {recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js');
for (const file of await readdir('node_modules/tesseract.js-core')) {
  if (file.endsWith('.wasm.js') || file.endsWith('.wasm')) await copyFile(`node_modules/tesseract.js-core/${file}`, `public/ocr/${file}`);
}
await copyFile('node_modules/@tesseract.js-data/spa/4.0.0/spa.traineddata.gz', 'public/ocr/spa.traineddata.gz');
