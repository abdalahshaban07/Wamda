const { chromium } = require("playwright");
const testPath = require("path");
const testFs = require("fs");
const OUTPUT = testPath.join(__dirname, "results");
testFs.mkdirSync(OUTPUT, { recursive: true });
(async () => {
  const b = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: {
      dir: testPath.join(OUTPUT, "motion"),
      size: { width: 1280, height: 900 },
    },
  });
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4173/discover");
  await p.waitForTimeout(1300);
  await p.locator(".language").click();
  await p.waitForTimeout(700);
  await p.locator(".image-button").first().hover();
  await p.waitForTimeout(800);
  await p.locator(".image-button").first().click();
  await p.waitForTimeout(1400);
  await p.getByRole("button", { name: "Keep +", exact: true }).last().click();
  await p.waitForTimeout(700);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(600);
  await p.getByRole("link", { name: /Saved 1/ }).click();
  await p.waitForTimeout(800);
  await p
    .getByRole("textbox", { name: "New collection", exact: true })
    .fill("Visual studies");
  await p.getByRole("button", { name: "Create", exact: true }).click();
  await p.waitForTimeout(700);
  await p.locator(".collection-select select").selectOption("all");
  await p.waitForTimeout(600);
  const id = await p
    .locator(".collection-select option", { hasText: "Visual studies" })
    .getAttribute("value");
  await p.locator(".move select").selectOption(id);
  await p.waitForTimeout(600);
  await p.locator(".language").click();
  await p.waitForTimeout(700);
  await p.getByRole("link", { name: "اكتشف", exact: true }).click();
  await p.waitForTimeout(800);
  for (let y = 0; y < 1000; y += 200) {
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(900);
  await c.close();
  await b.close();
})();
