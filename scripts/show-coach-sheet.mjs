import { chromium } from "playwright";

const browser = await chromium.launch({ headless: false, slowMo: 180 });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
await page.goto("http://127.0.0.1:5173");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole("button", { name: /Inizia partita/ }).click();

const choose = (id) => page.locator(".subject-picker select").selectOption(id);
const hit = (text, times = 1) => async () => {
  for (let i = 0; i < times; i += 1) {
    await page.getByRole("button", { name: new RegExp(text) }).click();
  }
};

await choose("p4");
await (await hit("2✓", 2))();
await (await hit("2×"))();
await (await hit("3✓"))();
await (await hit("TL ✓", 2))();
await (await hit("RD"))();
await (await hit("AS"))();
await (await hit("FS"))();
await (await hit("FC"))();

await choose("p7");
await (await hit("3✓", 2))();
await (await hit("3×"))();
await (await hit("RO"))();
await (await hit("PR"))();
await (await hit("AS", 2))();

await choose("team");
await (await hit("RD"))();

console.log("COACH_SHEET_VISIBLE_READY");
await new Promise(() => {});
