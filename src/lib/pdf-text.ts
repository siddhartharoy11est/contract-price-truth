/**
 * Browser only: reads page text from a PDF with pdf.js, one string per page. pdf.js is loaded
 * on demand so it stays out of the main bundle and never runs on the server.
 */
export class PdfReadError extends Error {}

export async function readPdfPages(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(data), verbosity: 0 });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    const err = e as Error;
    if (err.name === "PasswordException")
      throw new PdfReadError("This PDF is password protected. Upload an unprotected PDF.");
    throw new PdfReadError("This file could not be read as a PDF.");
  }
  const pages: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      // Stop early: the page limit is checked again on the full list.
      if (n > 26) {
        pages.push(...Array.from({ length: doc.numPages - pages.length }, () => ""));
        break;
      }
      const content = await (await doc.getPage(n)).getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str + (item.hasEOL ? "\n" : " ");
      }
      pages.push(text.replace(/[ \t]+\n/g, "\n").trim());
    }
  } finally {
    void task.destroy();
  }
  return pages;
}
