// Renders the documents in docs/ to PDF with headless Chromium, so the page
// breaks, margins and footers come out the same on every machine.

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");

const DOCUMENTS = [
  ["overview.html", "Bhargo-Software-Overview.pdf", "Bhargo — software overview"],
  ["licence.html", "Bhargo-Software-Licence-Agreement.pdf", "Software Licence Agreement — Bhargo Construction"],
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const [source, output, footerLeft] of DOCUMENTS) {
  await page.goto(`file://${path.join(docs, source)}`, { waitUntil: "networkidle" });
  await page.pdf({
    path: path.join(docs, output),
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7pt;color:#9a948a;padding:0 18mm;display:flex;justify-content:space-between;">
        <span>${footerLeft}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
    margin: { top: "18mm", bottom: "16mm", left: "0", right: "0" },
  });
  console.log("wrote", output);
}

await browser.close();
