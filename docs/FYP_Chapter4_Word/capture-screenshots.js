/**
 * Capture JUST RMS screenshots via SPA navigation (no full reloads after portal select).
 * Auth briefly clears program tier on reload — so we only click in-app links.
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUT = path.resolve(__dirname, "../fyp-chapter4-figures");
const BASE = "http://localhost:5173";

const NAV = [
  { file: "fig-4-3-director-dashboard.png", href: "/dashboard", label: /Dashboard/i },
  { file: "fig-4-4-proposals.png", href: "/proposals", label: /^Proposals$/i },
  { file: "fig-4-6-ethics.png", href: "/ethics", label: /^Ethics$/i },
  { file: "fig-4-7-projects.png", href: "/projects", label: /^Projects$/i },
  { file: "fig-4-8-funding-calls.png", href: "/funding-calls", label: /Funding Calls/i },
  { file: "fig-4-9-budgets.png", href: "/budgets", label: /Finance & Budgets/i },
  { file: "fig-4-10-thesis.png", href: "/thesis", label: /^Thesis$/i },
  { file: "fig-4-11-publications.png", href: "/publications", label: /Publications/i },
];

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function shot(page, file) {
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  console.log("saved", file, page.url());
}

async function clickNav(page, href, label) {
  const ok = await page.evaluate(
    ({ href, labelSource }) => {
      const re = new RegExp(labelSource, "i");
      const links = [...document.querySelectorAll('nav a, a[href]')];
      const a =
        links.find((el) => (el.getAttribute("href") || "") === href) ||
        links.find((el) => re.test((el.textContent || "").trim()));
      if (!a) return false;
      a.click();
      return true;
    },
    { href, labelSource: label.source }
  );
  if (!ok) throw new Error(`Nav link not found: ${href}`);
  await page.waitForFunction((h) => location.pathname === h || location.pathname.startsWith(h + "/"), { timeout: 20000 }, href).catch(() => {});
  await sleep(1500);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const chromePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    defaultViewport: { width: 1440, height: 920 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  // --- Login ---
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(1500);
  await shot(page, "fig-4-1-login.png");

  await page.waitForSelector('input[autocomplete="email"], input[placeholder*="email"]');
  await page.click('input[autocomplete="email"], input[placeholder*="email"]', { clickCount: 3 });
  await page.type('input[autocomplete="email"], input[placeholder*="email"]', "director@rms.edu", { delay: 5 });
  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', "Director2024!", { delay: 5 });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /Sign In/i.test(b.textContent || ""));
    if (btn) btn.click();
  });
  await page.waitForFunction(() => location.pathname.includes("program-tier") || location.pathname.includes("dashboard"), {
    timeout: 60000,
  });
  await sleep(1200);

  // --- Portal select ---
  if (!page.url().includes("program-tier")) {
    // click top bar switch if already inside
    await page.goto(`${BASE}/program-tier`, { waitUntil: "domcontentloaded" });
    await sleep(1000);
  }
  await shot(page, "fig-4-2-program-portal.png");

  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const ug = buttons.find((b) => /Undergraduate/i.test(b.textContent || "") && /Enter/i.test(b.textContent || ""));
    if (ug) ug.click();
    else {
      const any = buttons.find((b) => /Undergraduate/i.test(b.textContent || ""));
      if (any) any.click();
    }
  });
  await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 60000 });
  await sleep(2000);

  // --- Module pages via SPA clicks ---
  for (const item of NAV) {
    if (item.href !== "/dashboard") {
      await clickNav(page, item.href, item.label);
    }
    // Guard: if bounced to program-tier, re-enter once
    if (page.url().includes("program-tier")) {
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll("button")];
        const ug = buttons.find((b) => /Undergraduate/i.test(b.textContent || ""));
        if (ug) ug.click();
      });
      await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 30000 });
      await sleep(1000);
      await clickNav(page, item.href, item.label);
    }
    await shot(page, item.file);
  }

  // --- Proposal review ---
  await clickNav(page, "/proposals", /^Proposals$/i);
  const reviewHref = await page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((el) => /^Review$/i.test((el.textContent || "").trim()));
    return a ? a.getAttribute("href") : null;
  });
  if (reviewHref) {
    await page.evaluate((href) => {
      const a = document.querySelector(`a[href="${href}"]`);
      if (a) a.click();
    }, reviewHref);
    await sleep(2000);
    await shot(page, "fig-4-5-proposal-review.png");
  } else {
    fs.copyFileSync(path.join(OUT, "fig-4-4-proposals.png"), path.join(OUT, "fig-4-5-proposal-review.png"));
    console.log("fallback fig-4-5-proposal-review.png");
  }

  await browser.close();

  // size uniqueness check
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png"));
  const sizes = files.map((f) => ({ f, n: fs.statSync(path.join(OUT, f)).size }));
  console.log(sizes.map((s) => `${s.f}\t${s.n}`).join("\n"));
  const uniq = new Set(sizes.map((s) => s.n));
  console.log("unique_sizes", uniq.size, "of", sizes.length);
  console.log("ALL_DONE", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
