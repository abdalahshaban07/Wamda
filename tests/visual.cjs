const { chromium } = require("playwright");
const testPath = require("path");
const testFs = require("fs");
const OUTPUT = testPath.join(__dirname, "results");
testFs.mkdirSync(OUTPUT, { recursive: true });
const assert = require("node:assert/strict");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  let requests = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4173")) requests.push(r.url());
  });
  let outputs = [];
  for (const lang of ["ar", "en"])
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("http://127.0.0.1:4173/discover");
      await page.locator("article").first().waitFor();
      if ((await page.locator("html").getAttribute("lang")) !== lang)
        await page.locator(".language").click();
      for (const route of ["discover", "saved", "settings"]) {
        if (route === "saved") {
          await page.goto("http://127.0.0.1:4173/discover");
          await page.locator("article").first().waitFor();
          if (
            !(await page.evaluate(
              () =>
                JSON.parse(
                  localStorage.getItem("cofeed.local.v1") || '{"saved":{}}',
                ).saved.space,
            ))
          )
            await page
              .locator("article")
              .first()
              .locator(".post-actions button")
              .last()
              .click();
        }
        await page.goto("http://127.0.0.1:4173/" + route);
        await page.locator("h1").waitFor();
        await page.evaluate(async () => {
          document
            .querySelectorAll("img")
            .forEach((i) => (i.loading = "eager"));
          await Promise.all(
            Array.from(document.images).map((i) => i.decode().catch(() => {})),
          );
          await Promise.all(
            document.getAnimations().map((a) => a.finished.catch(() => {})),
          );
        });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          lang + " " + width + " " + route + " overflow",
        );
        let f = `${OUTPUT}/${lang}-${width}-${route}.png`;
        await page.screenshot({ path: f, fullPage: true });
        outputs.push(f);
      }
      await page.goto("http://127.0.0.1:4173/discover");
      await page.locator(".image-button").first().click();
      await page.locator("dialog[open]").waitFor();
      await page.screenshot({ path: `${OUTPUT}/${lang}-${width}-reader.png` });
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement.tagName),
        "SELECT",
      );
      await page.keyboard.press("Tab");
      assert.ok(
        (await page.evaluate(() => document.activeElement.className)).includes(
          "reader-close",
        ),
      );
      await page.keyboard.press("Escape");
    }
  assert.deepEqual(requests, []);
  fs.writeFileSync(
    testPath.join(OUTPUT, "visual-result.json"),
    JSON.stringify(
      { screenshots: outputs, overflow: "none", externalRequests: requests },
      null,
      2,
    ),
  );
  await browser.close();
  console.log(
    "PASS 18 route captures, six reader captures, no horizontal overflow, focus wraps, no external requests",
  );
})();
