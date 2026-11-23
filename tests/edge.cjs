const { chromium } = require("playwright");
const testPath = require("path");
const testFs = require("fs");
const OUTPUT = testPath.join(__dirname, "results");
testFs.mkdirSync(OUTPUT, { recursive: true });
const assert = require("node:assert/strict");
const fs = require("fs");
(async () => {
  const b = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  const c = await b.newContext();
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4173/discover");
  await p.locator(".language").click();
  const second = await c.newPage();
  await second.goto("http://127.0.0.1:4173/saved");
  await p.locator(".post-actions button").last().click();
  await second.waitForFunction(
    () => document.querySelectorAll("article").length === 1,
  );
  await p.evaluate(() => localStorage.removeItem("cofeed.local.v1"));
  await second.waitForFunction(
    () => document.querySelectorAll("article").length === 0,
  );
  console.log("PASS cross-tab save and deletion update");
  await p.reload();
  await p.locator(".language").click();
  await p.getByRole("link", { name: "Saved 0", exact: true }).click();
  for (const name of ["Notes", "notes", "   "]) {
    await p
      .getByRole("textbox", { name: "New collection", exact: true })
      .fill(name);
    await p.getByRole("button", { name: "Create", exact: true }).click();
  }
  assert.equal(await p.locator(".collection-select option").count(), 3);
  console.log("PASS duplicate case and whitespace names rejected");
  await p.getByRole("link", { name: "Settings", exact: true }).click();
  await p
    .getByLabel("Choose a JSON backup", { exact: true })
    .setInputFiles({
      name: "huge.json",
      mimeType: "application/json",
      buffer: Buffer.alloc(200001, 32),
    });
  await p.waitForFunction(() =>
    document
      .querySelector("[role=status]")
      .textContent.includes("Invalid backup"),
  );
  console.log("PASS oversized import rejected");
  const original = JSON.parse(
    await p.evaluate(() => localStorage.getItem("cofeed.local.v1")),
  );
  const unsafe = {
    ...original,
    collections: [
      { id: "inbox", name: "Inbox" },
      { id: "x", name: "<img src=x onerror=alert(1)>" },
    ],
    saved: { space: "x" },
  };
  await p
    .getByLabel("Choose a JSON backup", { exact: true })
    .setInputFiles({
      name: "markup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(unsafe)),
    });
  await p
    .getByRole("button", { name: "Confirm import & replace", exact: true })
    .click();
  await p.getByRole("link", { name: "Saved 1", exact: true }).click();
  assert.ok(
    (await p.locator(".collection-select").innerText()).includes("<img"),
  );
  assert.equal(await p.locator(".collections img").count(), 0);
  console.log("PASS collection content renders as text, not markup");
  await p.goto("http://127.0.0.1:4173/unknown");
  await p.waitForURL("**/discover");
  console.log("PASS unknown route returns Discover");
  await c.close();
  const f = await b.newContext();
  await f.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  const fp = await f.newPage();
  await fp.goto("http://127.0.0.1:4173/settings");
  await fp.getByRole("alert").waitFor();
  await fp.locator(".language").click();
  assert.equal(await fp.locator("html").getAttribute("lang"), "en");
  console.log("PASS storage-read failure preserves usable app");
  await f.close();
  const q = await b.newContext();
  const qp = await q.newPage();
  await qp.goto("http://127.0.0.1:4173/settings");
  await qp.locator(".language").click();
  await qp.evaluate(
    () =>
      (Storage.prototype.setItem = () => {
        throw new DOMException("full", "QuotaExceededError");
      }),
  );
  await qp
    .getByLabel("Choose a JSON backup", { exact: true })
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(unsafe)),
    });
  await qp
    .getByRole("button", { name: "Confirm import & replace", exact: true })
    .click();
  assert.equal(
    await qp
      .getByRole("heading", { name: "Review before replacing", exact: true })
      .count(),
    1,
  );
  assert.ok(
    (await qp.getByRole("status").innerText()).includes("State") ||
      (await qp.getByRole("status").innerText()).includes("not changed"),
  );
  assert.equal(
    await qp.getByRole("link", { name: "Saved 0", exact: true }).count(),
    1,
  );
  console.log("PASS failed import write does not apply pending data");
  await q.close();
  await b.close();
})();
