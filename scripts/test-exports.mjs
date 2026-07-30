import { chromium } from "playwright";
import { mkdir, stat } from "node:fs/promises";

await mkdir("artifacts/exports", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.goto("http://127.0.0.1:5173");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole("button", { name: /Inizia partita/ }).click();
await page.locator(".subject-picker select").selectOption("p4");
await page.getByRole("button", { name: /2✓/ }).click();
await page.getByRole("button", { name: /RD/ }).click();
await page.getByRole("button", { name: /AS/ }).click();

const pdfPromise = page.waitForEvent("download");
await page.getByRole("button", { name: /PDF/ }).click();
const pdf = await pdfPromise;
const pdfPath = "artifacts/exports/report-test.pdf";
await pdf.saveAs(pdfPath);

const excelPromise = page.waitForEvent("download");
await page.getByRole("button", { name: /Excel/ }).click();
const excel = await excelPromise;
const excelPath = "artifacts/exports/report-test.xlsx";
await excel.saveAs(excelPath);

const pdfSize = (await stat(pdfPath)).size;
const excelSize = (await stat(excelPath)).size;
if (pdfSize < 1000 || excelSize < 1000) throw new Error(`Export troppo piccolo: PDF ${pdfSize}, XLSX ${excelSize}`);

console.log(JSON.stringify({ pdfPath, pdfSize, excelPath, excelSize }));
await browser.close();
