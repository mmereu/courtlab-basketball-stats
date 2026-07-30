import { chromium } from "playwright";

const browser = await chromium.launch({ headless: false, slowMo: 220 });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
await page.goto("http://127.0.0.1:5173");
await page.evaluate(() => localStorage.clear());
await page.reload();

const pause = (ms = 500) => page.waitForTimeout(ms);
const player = (name) => page.getByRole("button", { name: new RegExp(name) }).first();

async function select(name) {
  await player(name).click();
}

async function shot(name, points, made, x, y) {
  await select(name);
  await page.getByRole("button", { name: new RegExp(`Tiro da ${points}`) }).click();
  const box = await page.locator(".court").boundingBox();
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await page.getByRole("button", { name: made ? /Segnato/ : /Sbagliato/ }).click();
  await pause();
}

async function stat(name, action) {
  await select(name);
  await page.getByRole("button", { name: new RegExp(action) }).click();
  await pause(300);
}

async function opponent(points) {
  const plus = page.locator(".opponent-controls button").last();
  for (let i = 0; i < points; i += 1) await plus.click();
}

async function nextPeriod() {
  await page.getByRole("button", { name: /Fine periodo/ }).click();
  await pause(800);
}

await page.getByRole("button", { name: /Inizia partita/ }).click();
await page.getByRole("button", { name: /Tracking campo/ }).click();
await pause(1200);

// Primo quarto — 7 a 4
await shot("Rossi", 2, true, 0.54, 0.28);
await stat("Bianchi", "Assist");
await shot("Bianchi", 3, true, 0.22, 0.64);
await opponent(2);
await shot("Serra", 2, false, 0.64, 0.36);
await stat("Piras", "Rimb. off.");
await shot("Piras", 2, true, 0.48, 0.18);
await opponent(2);
await nextPeriod();

// Secondo quarto — parziale 6 a 5
await shot("Mereu", 2, true, 0.50, 0.12);
await stat("Rossi", "Palla persa");
await opponent(3);
await shot("Bianchi", 3, false, 0.82, 0.67);
await stat("Serra", "Rimb. dif.");
await shot("Serra", 2, true, 0.39, 0.34);
await select("Piras");
await page.getByRole("button", { name: "TL ✓" }).click();
await select("Piras");
await page.getByRole("button", { name: "TL ✓" }).click();
await opponent(2);

// Cambio Piras / Carta
await select("Piras");
await page.getByRole("button", { name: /Effettua cambio/ }).click();
await player("Carta").click();
await pause(900);
await nextPeriod();

// Terzo quarto — parziale 8 a 6
await shot("Carta", 3, true, 0.18, 0.58);
await stat("Rossi", "Recupero");
await shot("Rossi", 2, true, 0.57, 0.25);
await opponent(2);
await stat("Mereu", "Fallo");
await opponent(2);
await shot("Bianchi", 3, true, 0.79, 0.61);
await stat("Serra", "Assist");
await opponent(2);
await nextPeriod();

// Quarto quarto — parziale 6 a 7
await shot("Mereu", 2, false, 0.52, 0.14);
await stat("Carta", "Rimb. off.");
await shot("Carta", 2, true, 0.44, 0.22);
await opponent(3);
await stat("Bianchi", "Palla persa");
await opponent(2);
await shot("Rossi", 3, true, 0.25, 0.62);
await stat("Mereu", "Stoppata");
await opponent(2);
await select("Serra");
await page.getByRole("button", { name: "TL ✓" }).click();
await pause(900);

await page.getByRole("button", { name: /Report live/ }).click();
await pause(1500);
console.log("DEMO_VISIBLE_READY: partita terminata 27-22, browser lasciato aperto sul report.");

await new Promise(() => {});
