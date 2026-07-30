import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:5173";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });

async function expectText(page, selector, expected) {
  const text = await page.locator(selector).innerText();
  if (!text.includes(expected)) throw new Error(`${selector}: atteso "${expected}", trovato "${text}"`);
}

const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();

await expectText(page, ".lineup-card", "5/5 selezionati");
await page.screenshot({ path: "artifacts/setup-1366.png" });

await page.getByRole("button", { name: /Basic/ }).click();
await page.getByRole("button", { name: /Pro/ }).click();
await page.getByRole("button", { name: /Inizia partita/ }).click();
await expectText(page, ".sync-strip", "Modalità Pro");
await expectText(page, ".coach-sheet", "FOGLIO COACH");
await page.locator(".subject-picker select").selectOption("p4");
await page.getByRole("button", { name: /2✓/ }).click();
await expectText(page, ".points-kpi", "2");
await expectText(page, ".sheet-table", "100%");
await page.getByRole("button", { name: /Annulla/ }).click();
await page.getByRole("button", { name: /Tracking campo/ }).click();
await page.screenshot({ path: "artifacts/live-empty-1366.png" });

await page.getByRole("button", { name: /Rossi/ }).click();
await page.getByRole("button", { name: /Tiro da 2/ }).click();
const court = page.locator(".court");
const box = await court.boundingBox();
if (!box) throw new Error("Campo non visibile");
await page.mouse.click(box.x + box.width * 0.58, box.y + box.height * 0.36);
await page.getByRole("button", { name: /Segnato/ }).click();
await expectText(page, ".score-number:not(.score-number--away)", "2");

await page.getByRole("button", { name: /Bianchi/ }).click();
await page.getByRole("button", { name: /Assist/ }).click();
await page.getByRole("button", { name: /Bianchi/ }).click();
await page.getByRole("button", { name: "TL ✓" }).click();
await expectText(page, ".score-number:not(.score-number--away)", "3");
await page.locator(".opponent-controls button").last().click();
await page.locator(".opponent-controls button").last().click();
await page.locator(".opponent-controls button").last().click();
await page.screenshot({ path: "artifacts/live-active-1366.png" });

await page.getByRole("button", { name: /Annulla/ }).click();
await expectText(page, ".score-number:not(.score-number--away)", "2");

await page.getByRole("button", { name: /Report live/ }).click();
await expectText(page, ".report-score", "2");
await expectText(page, ".boxscore", "Rossi");
await page.screenshot({ path: "artifacts/report-1366.png" });

await page.reload();
await expectText(page, ".report-score", "2");
await page.getByRole("button", { name: /Continua a registrare/ }).click();
await page.getByRole("button", { name: /Rossi/ }).click();
await page.getByRole("button", { name: /Effettua cambio/ }).click();
await page.getByRole("button", { name: /Carta/ }).click();
await expectText(page, ".last-event", "Carta per Rossi");

const fit = await page.evaluate(() => {
  const selectors = [".scorebar", ".players-panel", ".court-stage", ".actions-panel", ".eventbar"];
  return {
    viewport: [innerWidth, innerHeight],
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    regions: Object.fromEntries(selectors.map((selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [selector, { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }];
    })),
  };
});
console.log("DESKTOP_FIT", JSON.stringify(fit));

const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const tabletPage = await tablet.newPage();
await tabletPage.goto(base);
await tabletPage.getByRole("button", { name: /Inizia partita/ }).click();
await tabletPage.locator(".subject-picker select").selectOption("p7");
await tabletPage.getByRole("button", { name: /3✓/ }).click();
await tabletPage.screenshot({ path: "artifacts/coach-sheet-1024x768.png" });
const tabletFit = await tabletPage.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  scorebar: document.querySelector(".scorebar")?.getBoundingClientRect().toJSON(),
  eventbar: document.querySelector(".eventbar")?.getBoundingClientRect().toJSON(),
  kpis: document.querySelector(".team-kpis")?.getBoundingClientRect().toJSON(),
  entry: document.querySelector(".sheet-entry")?.getBoundingClientRect().toJSON(),
})); 
console.log("TABLET_FIT", JSON.stringify(tabletFit));

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mobilePage = await mobile.newPage();
await mobilePage.goto(base);
await mobilePage.screenshot({ path: "artifacts/mobile-390x844.png" });
console.log("MOBILE", JSON.stringify(await mobilePage.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  scrollHeight: document.documentElement.scrollHeight,
}))));

await mobile.close();
await tablet.close();
await context.close();
await browser.close();
console.log("QA_RELEASE_A_OK");
