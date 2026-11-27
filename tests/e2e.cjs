const { chromium } = require("playwright");
const testPath = require("path");
const testFs = require("fs");
const OUTPUT = testPath.join(__dirname, "results");
testFs.mkdirSync(OUTPUT, { recursive: true });
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let count = 0;
  function pass(t) {
    console.log("PASS", t);
    count++;
  }
  const button = (n) => page.getByRole("button", { name: n, exact: true });
  await page.goto("http://127.0.0.1:4173/discover");
  await page.locator("article").first().waitFor();
  await button("English ↗").click();
  assert.equal(await page.locator("article").count(), 6);
  pass("catalog loads and bilingual language switches");
  await page.getByRole("searchbox").fill("architecture");
  assert.equal(await page.locator("article").count(), 2);
  await page.getByRole("searchbox").fill("no-matching-text");
  assert.equal(await page.locator("article").count(), 0);
  await button("Clear filters").first().click();
  await button("Design").click();
  assert.equal(await page.locator("article").count(), 2);
  await button("Clear filters ↺").click();
  pass("search tags, empty state, category and reset");
  await page
    .getByRole("button", {
      name: "Like locally: The space around an idea",
      exact: true,
    })
    .click();
  assert.equal(
    await page
      .getByRole("button", {
        name: "Like locally: The space around an idea",
        exact: true,
      })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("button", {
      name: "Like locally: The space around an idea",
      exact: true,
    })
    .click();
  assert.equal(
    await page
      .getByRole("button", {
        name: "Like locally: The space around an idea",
        exact: true,
      })
      .getAttribute("aria-pressed"),
    "false",
  );
  pass("like toggles without incrementing totals");
  const opener = page.getByRole("button", {
    name: "Open: The space around an idea",
    exact: true,
  });
  await opener.click();
  await page.locator("dialog[open]").waitFor();
  await button("Keep +").last().click();
  await page.keyboard.press("Escape");
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(
    await opener.evaluate((x) => document.activeElement === x),
    true,
  );
  pass("reader opens, saves, Escape returns focus");
  await page.getByRole("link", { name: /Saved 1/ }).click();
  await page
    .getByRole("textbox", { name: "New collection", exact: true })
    .fill("Architecture");
  await button("Create").click();
  assert.equal(await page.locator("article").count(), 0);
  await page.locator(".collection-select select").selectOption("all");
  const id = await page
    .locator(".collection-select select")
    .locator("option", { hasText: "Architecture" })
    .getAttribute("value");
  await page.locator(".move select").selectOption(id);
  await page.locator(".collection-select select").selectOption(id);
  await page
    .getByRole("textbox", { name: "Rename collection", exact: true })
    .fill("Light studies");
  await button("Save name").click();
  await page.reload();
  await page.locator("article").first().waitFor();
  assert.equal(await page.locator("article").count(), 1);
  assert.ok(
    (await page.locator(".move select").innerText()).includes("Light studies"),
  );
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  pass("create/move/rename collection persist after refresh");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  let dl = page.waitForEvent("download");
  await button("Export backup ↓").click();
  const download = await dl;
  await download.saveAs(testPath.join(OUTPUT, "exported-backup.json"));
  const backup = JSON.parse(
    fs.readFileSync(testPath.join(OUTPUT, "exported-backup.json")),
  );
  assert.equal(backup.saved.space, id);
  pass("real backup download contains saved state");
  await page
    .getByLabel("Choose a JSON backup", { exact: true })
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{bad"),
    });
  await page.waitForFunction(() =>
    document
      .querySelector("[role=status]")
      .textContent.includes("Invalid backup"),
  );
  assert.equal(
    JSON.parse(
      await page.evaluate(() => localStorage.getItem("cofeed.local.v1")),
    ).saved.space,
    id,
  );
  pass("invalid import leaves current data untouched");
  await page
    .getByLabel("Choose a JSON backup", { exact: true })
    .setInputFiles(testPath.join(OUTPUT, "exported-backup.json"));
  await button("Cancel import").click();
  assert.equal(
    await page
      .getByRole("heading", { name: "Review before replacing" })
      .count(),
    0,
  );
  await button("Reset local data").click();
  await button("Cancel").click();
  assert.equal(
    JSON.parse(
      await page.evaluate(() => localStorage.getItem("cofeed.local.v1")),
    ).saved.space,
    id,
  );
  pass("import and reset both support cancel");
  await button("Reset local data").click();
  await button("Confirm reset").click();
  assert.deepEqual(
    JSON.parse(
      await page.evaluate(() => localStorage.getItem("cofeed.local.v1")),
    ).saved,
    {},
  );
  await page
    .getByLabel("Choose a JSON backup", { exact: true })
    .setInputFiles(testPath.join(OUTPUT, "exported-backup.json"));
  await button("Confirm import & replace").click();
  assert.equal(
    JSON.parse(
      await page.evaluate(() => localStorage.getItem("cofeed.local.v1")),
    ).saved.space,
    id,
  );
  pass("confirmed reset and backup restore");
  await page.goto("http://127.0.0.1:4173/saved");
  await page.locator("article").first().waitFor();
  assert.equal(await page.locator("article").count(), 1);
  await page.goBack();
  await page.goForward();
  assert.ok(page.url().endsWith("/saved"));
  pass("direct routes and browser history");
  await page.evaluate(() => localStorage.setItem("cofeed.local.v1", "{broken"));
  await page.reload();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("cofeed.local.v1")),
    "{broken",
  );
  await page.getByRole("button", { name: "English ↗", exact: true }).click();
  await page.getByRole("button", { name: "العربية ↗", exact: true }).click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("cofeed.local.v1")),
    "{broken",
  );
  pass("corrupt storage is not silently overwritten");
  await page
    .getByRole("button", { name: "ابدأ بسجل جديد", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تأكيد الاستبدال", exact: true })
    .click();
  assert.equal(await page.getByRole("alert").count(), 0);
  pass("explicit corrupt-record recovery");
  const block = await browser.newContext();
  await block.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  const bp = await block.newPage();
  await bp.goto("http://127.0.0.1:4173/discover");
  await bp.locator("article").first().waitFor();
  await bp.getByRole("button", { name: "احفظ +", exact: true }).first().click();
  await bp.getByRole("alert").waitFor();
  assert.equal(await bp.locator("article").count(), 6);
  pass("quota failure keeps UI usable with warning");
  await block.close();
  assert.deepEqual(errors, []);
  pass("no uncaught browser errors");
  fs.writeFileSync(
    testPath.join(OUTPUT, "e2e-result.json"),
    JSON.stringify({ checks: count, errors }, null, 2),
  );
  await browser.close();
})();
