// lib/pdf/readText.ts
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// In Node: worker uitzetten
(pdfjs as any).GlobalWorkerOptions.workerSrc = undefined;

export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const uint8 = new Uint8Array(buffer);
  const doc = await (pdfjs as any).getDocument({
    data: uint8,
    disableWorker: true,
  }).promise;

  let all = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    all += (all ? "\n" : "") + text;
  }
  await doc.destroy?.();
  return all;
}
