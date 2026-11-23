const { chromium } = require("playwright");
const testPath = require("path");
const testFs = require("fs");
const OUTPUT = testPath.join(__dirname, "results");
testFs.mkdirSync(OUTPUT, { recursive: true });
const { default: AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  let out = [];
  for (const route of ["discover", "saved", "settings"]) {
    await p.goto("http://127.0.0.1:4173/" + route);
    await p.locator("h1").waitFor();
    await p.evaluate(() =>
      Promise.all(
        document.getAnimations().map((a) => a.finished.catch(() => {})),
      ),
    );
    let r = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    out.push({
      route,
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          summary: n.failureSummary,
        })),
      })),
    });
  }
  await p.goto("http://127.0.0.1:4173/discover");
  await p.locator(".image-button").first().click();
  await p.locator("dialog[open]").waitFor();
  await p.evaluate(() =>
    Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    ),
  );
  let r = await new AxeBuilder({ page: p })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  out.push({ route: "reader", violations: r.violations });
  fs.writeFileSync(
    testPath.join(OUTPUT, "accessibility.json"),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
  if (out.some((r) => r.violations.length))
    throw Error("Accessibility check found violations");
  await b.close();
})();
