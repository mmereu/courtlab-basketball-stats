import { chromium } from "playwright";

const target = process.env.COURTLAB_QA_URL ?? "https://basketcoach.duckdns.org";
const email = "qa-cloud@basketcoach.invalid";
const coachEmail = "qa-viewer@basketcoach.invalid";
const password = process.env.COURTLAB_QA_PASSWORD
  ?? `CourtLab-QA-${crypto.randomUUID()}!`;
const browser = await chromium.launch({ headless: true });

const first = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await first.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(target, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Crea squadra" }).click();
await page.getByRole("heading", { name: "Under 14" }).waitFor();
await page.getByRole("button", { name: "Account e cloud" }).click();
await page.getByRole("button", { name: "Crea un nuovo account" }).click();
await page.getByLabel("Nome").fill("QA CourtLab");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Crea account" }).click();
await page.locator(".cloud-popover").getByText("QA CourtLab", { exact: true }).waitFor();
await page.getByText(/Ultima sincronizzazione/).waitFor();
await page.getByRole("button", { name: "Gestisci collaboratori" }).click();
await page.getByRole("button", { name: "Invita viewer" }).click();
const inviteUrl = await page.getByLabel("Link invito").inputValue();

const second = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const secondPage = await second.newPage();
await secondPage.goto(inviteUrl, { waitUntil: "networkidle" });
await secondPage.getByLabel("Email").fill(coachEmail);
await secondPage.getByLabel("Password").fill(password);
await secondPage.getByRole("button", { name: "Accetta invito" }).click();
await secondPage.getByRole("heading", { name: "Under 14" }).waitFor();
await secondPage.getByText(/Modalità viewer/).waitFor();
if (await secondPage.getByRole("button", { name: /Nuova partita/ }).count()) {
  throw new Error("Il viewer non deve poter creare partite");
}

await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: /QA CourtLab/ }).click();
await page.getByRole("button", { name: "Gestisci collaboratori" }).click();
await page.getByText(coachEmail).waitFor();

if (errors.length) throw new Error(errors.join(" | "));
console.log("QA cloud OK: account, snapshot, invito viewer, permessi read-only e ripristino su secondo dispositivo");
await second.close();
await first.close();
await browser.close();
