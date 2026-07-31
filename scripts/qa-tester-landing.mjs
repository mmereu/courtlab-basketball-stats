import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const target = process.env.COURTLAB_QA_URL || "http://127.0.0.1:4173/#/diventa-tester";
await mkdir("artifacts/qa", { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  await page.route("**/api/tester-applications", (route) => route.fulfill({
    status: 201, contentType: "application/json", body: JSON.stringify({ received: true }),
  }));
  await page.goto(target, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Prova CourtLab/i }).waitFor();
  await page.screenshot({ path: "artifacts/qa/tester-landing-desktop.png", fullPage: true });

  await page.getByLabel("Nome e cognome").fill("Coach QA");
  await page.getByLabel("Email").fill("coach.qa@example.test");
  await page.getByLabel("Società").fill("Basket QA");
  await page.getByLabel("Squadra o categoria").fill("Under 15");
  await page.getByLabel("Ruolo").selectOption({ label: "Allenatore" });
  await page.getByLabel("Dispositivo principale").selectOption({ label: "Tablet" });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Invia candidatura" }).click();
  await page.getByRole("status").waitFor();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(target, { waitUntil: "networkidle" });
  await mobilePage.getByRole("heading", { name: /Prova CourtLab/i }).waitFor();
  const overflow = await mobilePage.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("La landing presenta overflow orizzontale su mobile");
  await mobilePage.screenshot({ path: "artifacts/qa/tester-landing-mobile.png", fullPage: true });

  console.log("QA tester landing OK: desktop, candidatura, mobile, viewport");
} finally {
  await browser.close();
}
