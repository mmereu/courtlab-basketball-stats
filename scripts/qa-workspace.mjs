import { chromium } from "playwright";
import { mkdir, stat } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const targetUrl = process.env.QA_TARGET_URL ?? "http://127.0.0.1:4173";
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
await mkdir("artifacts/qa", { recursive: true });
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
    console.error("BROWSER:", message.text());
  }
});
page.on("pageerror", (error) => {
  errors.push(error.message);
  console.error("PAGE:", error.message);
});

await page.goto(targetUrl, { waitUntil: "networkidle" });
await page.getByLabel("Società").fill("Novara Basket");
await page.getByLabel("Prima categoria").fill("Under 14");
await page.getByLabel("Stagione").fill("2026/27");
await page.getByRole("button", { name: "Crea squadra" }).click();
await page.getByRole("heading", { name: "Under 14" }).waitFor();
await page.getByRole("button", { name: "＋ Categoria" }).click();
const categoryDialog = page.getByRole("dialog", { name: "Aggiungi una squadra della società" });
await categoryDialog.getByLabel("Categoria").fill("Under 15");
await categoryDialog.getByRole("button", { name: "Crea categoria" }).click();
await page.getByRole("heading", { name: "Under 15" }).waitFor();
if (await page.locator(".ws-team-select option").count() !== 2) throw new Error("La seconda categoria non è stata salvata");
await page.getByRole("button", { name: "Società e squadre" }).click();
await page.getByRole("heading", { name: /Novara Basket · Squadre/ }).waitFor();
if (await page.locator(".ws-team-card").count() !== 2) throw new Error("La gestione squadre non mostra tutte le categorie");
await page.screenshot({ path: "artifacts/qa/teams-desktop.png", fullPage: true });

await page.getByRole("button", { name: "Roster" }).click();
for (let number = 4; number <= 9; number += 1) {
  await page.getByRole("button", { name: "＋ Giocatore" }).click();
  await page.getByLabel("Numero").fill(String(number));
  await page.getByLabel("Nome e cognome").fill(`Giocatore ${number}`);
  await page.getByRole("button", { name: "Salva giocatore" }).click();
  await page.locator(".ws-player").filter({ hasText: `Giocatore ${number}` }).waitFor();
}
await page.waitForTimeout(300);

await page.getByRole("button", { name: "Dashboard" }).click();
await page.getByRole("button", { name: /Nuova partita/ }).click();
await page.waitForTimeout(1000);
await page.getByLabel("Avversario", { exact: true }).fill("Eagles QA");
await page.getByLabel("Statistiche avversario").check();
const startButton = page.getByRole("button", { name: /Inizia partita/ });
await page.waitForTimeout(500);
if (await startButton.isDisabled()) {
  throw new Error(`Setup non pronto: ${JSON.stringify(await page.locator("input").evaluateAll((items) => items.map((item) => item.value)))}\n${await page.locator("body").innerText()}`);
}
await startButton.click();
await page.getByText("Eagles QA").first().waitFor();
await page.locator(".clock-block").click();
await page.waitForTimeout(2200);
await page.locator(".clock-block").click();

await page.getByRole("button", { name: "Tracking campo" }).click();
await page.locator(".player-card").first().click();
await page.getByRole("button", { name: /Effettua cambio/ }).click();
await page.locator(".bench-grid button").filter({ hasText: "#9" }).click();
await page.locator(".player-card").first().click();
await page.locator(".shots-actions").getByRole("button", { name: /Tiro da 2/ }).click();
await page.locator(".court--active").click({ position: { x: 250, y: 210 } });
await page.getByRole("button", { name: /Segnato/ }).click();
await page.getByRole("button", { name: "Foglio Coach" }).click();

await page.locator(".subject-picker select").selectOption({ label: "#4 Giocatore 4" });
await page.getByRole("button", { name: /2✓.*Segnato/ }).click();
await page.locator(".guided-flow").getByRole("button", { name: /#5.*5/ }).click();
await page.getByRole("button", { name: /3×.*Sbagliato/ }).click();
await page.locator(".guided-flow").getByRole("button", { name: /Rimbalzo difensivo avversario/ }).click();
await page.getByRole("button", { name: /FC.*Fallo commesso/ }).click();
await page.locator(".guided-flow").getByRole("button", { name: /2 TL.*Registra la serie/ }).click();
await page.locator(".guided-flow").getByRole("button", { name: /1\/2.*segnati/ }).click();
await page.getByRole("button", { name: /CPF.*Contropiede fatto/ }).click();
await page.getByRole("button", { name: "+2", exact: true }).click();
await page.getByRole("button", { name: /PR.*Palla rubata/ }).click();
await page.getByRole("button", { name: /CPS.*Contropiede subito/ }).click();
await page.getByRole("button", { name: "+3", exact: true }).click();
await page.locator(".playbyplay-drawer").getByText(/Play-by-play/).click();
const ownEvent = page.locator(".review-event").filter({ hasText: "CPF +2" });
await ownEvent.locator("summary").click();
await ownEvent.getByLabel("Azione").selectOption("3PT_MADE");
await page.locator(".score-number").first().getByText("7").waitFor();
await page.getByRole("button", { name: /Correggi statistiche/ }).click();
await page.getByRole("dialog", { name: "Statistiche giocatore" }).getByLabel("Scegli il giocatore").selectOption({ label: "#4 Giocatore 4" });
await page.getByRole("dialog", { name: "Statistiche giocatore" }).locator(".review-event").first().waitFor();
await page.getByRole("dialog", { name: "Statistiche giocatore" }).getByRole("button", { name: "Chiudi" }).click();
await page.locator(".period-navigator").getByRole("button", { name: "Q2" }).click();
await page.locator(".subject-picker select").selectOption({ label: "#4 Giocatore 4" });
await page.getByRole("button", { name: /TL ✓/ }).last().click();
await page.locator(".quarter-live-summary").getByText("Q2 · DETTAGLIO").waitFor();
for (const period of ["Q1", "Q2", "Q3", "Q4"]) {
  await page.locator(".quarter-score-strip").getByText(period, { exact: true }).waitFor();
}
await page.locator(".period-navigator").getByRole("button", { name: "Q1" }).click();
await page.locator(".quarter-live-summary").getByText("Q1 · DETTAGLIO").waitFor();

await page.screenshot({ path: "artifacts/qa/live-desktop.png", fullPage: true });
await page.getByRole("button", { name: /Report live/ }).click();
await page.getByRole("heading", { name: "La partita, in numeri." }).waitFor();
await page.getByRole("heading", { name: "Totali Eagles QA" }).waitFor();
await page.getByRole("heading", { name: "Statistiche per quarto" }).waitFor();
await page.getByRole("heading", { name: "Andamento del punteggio" }).waitFor();
await page.getByRole("heading", { name: "Tiri per giocatore, periodo e zona" }).waitFor();
if (await page.getByRole("heading", { name: "Minuti e plus/minus" }).count()) {
  throw new Error("La tabella plus/minus è ancora visibile nel report");
}
await page.locator(".shot-filters").getByLabel("Giocatore").selectOption({ label: "#9 9" });
await page.locator(".shot-filters").getByLabel("Periodo").selectOption("1");
await page.getByText("1° TEMPO", { exact: true }).waitFor();
await page.getByText("2° TEMPO", { exact: true }).waitFor();
await page.getByText("TOTALE 4Q", { exact: true }).waitFor();
await page.getByText("Palle rubate squadra").waitFor();
await page.getByText("Punti in contropiede realizzati").waitFor();
await page.getByText("Punti in contropiede subiti").waitFor();
await page.locator(".boxscore").getByRole("columnheader", { name: "STF" }).waitFor();
await page.locator(".boxscore").getByRole("columnheader", { name: "STS" }).waitFor();
await page.locator(".boxscore").getByRole("columnheader", { name: "CPS" }).waitFor();
for (const column of ["AS", "FS", "FC", "CPF", "VAL"]) {
  await page.locator(".boxscore").getByRole("columnheader", { name: column, exact: true }).waitFor();
}
if (await page.getByText("EFF", { exact: true }).count()) throw new Error("EFF è ancora visibile nel report");
const pdfDownload = page.waitForEvent("download");
await page.getByRole("button", { name: "Scarica PDF" }).click();
const pdf = await pdfDownload;
await pdf.saveAs("artifacts/qa/report-advanced.pdf");
const excelDownload = page.waitForEvent("download");
await page.getByRole("button", { name: "Scarica Excel" }).click();
const excel = await excelDownload;
await excel.saveAs("artifacts/qa/report-advanced.xlsx");
if ((await stat("artifacts/qa/report-advanced.pdf")).size < 1_000 ||
    (await stat("artifacts/qa/report-advanced.xlsx")).size < 1_000) {
  throw new Error("Export PDF/XLSX non valido");
}
await page.screenshot({ path: "artifacts/qa/report-desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "artifacts/qa/report-mobile.png", fullPage: false });
const reportOverflow = await page.evaluate(() =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth);
if (reportOverflow) throw new Error("Overflow orizzontale nel report mobile");
await page.setViewportSize({ width: 1440, height: 900 });

await page.getByRole("button", { name: /Chiudi e torna/ }).click();
await page.getByRole("button", { name: "Stagione" }).click();
await page.getByRole("heading", { name: "Under 15 · 2026/27" }).waitFor();
await page.getByText("Rendimento giocatori").waitFor();
await page.getByRole("button", { name: "Partite" }).click();
await page.getByRole("button", { name: /Duplica partita contro Eagles QA/ }).click();
await page.locator(".ws-game").filter({ hasText: "Bozza" }).getByRole("button", { name: "Continua" }).click();
await page.getByLabel("Avversario", { exact: true }).fill("Falcons QA");
await page.getByRole("button", { name: /Inizia partita/ }).click();
await page.locator(".subject-picker select").selectOption({ label: "#4 Giocatore 4" });
await page.getByRole("button", { name: /2✓.*Segnato/ }).click();
await page.locator(".guided-flow").getByRole("button", { name: /Salta/ }).click();
await page.getByRole("button", { name: /Report live/ }).click();
await page.getByRole("heading", { name: "La partita, in numeri." }).waitFor();
await page.getByRole("button", { name: /Chiudi e torna/ }).click();
await page.getByRole("button", { name: "Stagione" }).click();
await page.getByText("2 gare analizzate").waitFor();
await page.screenshot({ path: "artifacts/qa/season-desktop.png", fullPage: true });
await page.getByRole("button", { name: "Partite" }).click();
await page.getByText("Eagles QA").waitFor();
await page.getByText("Falcons QA").waitFor();
await page.screenshot({ path: "artifacts/qa/archive-desktop.png", fullPage: true });
await page.waitForTimeout(500);
if (errors.length) throw new Error(`Errori browser prima del test offline: ${errors.join(" | ")}`);
await page.reload({ waitUntil: "networkidle" });
await page.getByText("Eagles QA").waitFor();
await context.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByText("Eagles QA").waitFor();
await context.setOffline(false);
errors.length = 0;

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const mobilePage = await mobile.newPage();
await mobilePage.goto(targetUrl, { waitUntil: "networkidle" });
await mobilePage.screenshot({ path: "artifacts/qa/mobile-start.png", fullPage: true });
const mobileOverflow = await mobilePage.evaluate(() =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth);

if (errors.length) throw new Error(`Errori browser: ${errors.join(" | ")}`);
if (mobileOverflow) throw new Error("Overflow orizzontale nella vista mobile");
console.log("QA workspace OK: multi-categoria, roster, contropiede, revisione, report, archivio, offline, mobile");
await mobile.close();
await context.close();
await browser.close();
