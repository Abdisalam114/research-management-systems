/**
 * Capture additional Chapter IV screenshots that were previously placeholders.
 * Run from docs/: node FYP_Chapter4_Word/capture-extra-screenshots.js
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUT = path.resolve(__dirname, "../fyp-chapter4-figures");
const BASE = "http://localhost:5173";
const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const ACCOUNTS = {
  director: { email: "director@rms.edu", password: "Director2024!", tier: "undergraduate" },
  coordinator: { email: "coordinator@rms.edu", password: "Coordinator2024!", tier: "undergraduate" },
  leadership: { email: "leadership@rms.edu", password: "Leadership2024!", tier: "undergraduate" },
  finance: { email: "finance@rms.edu", password: "Finance2024!", tier: "undergraduate" },
  researcher: { email: "asha@rms.edu", password: "Researcher2024!", tier: "undergraduate" },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shot(page, file) {
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  console.log("saved", file, page.url());
}

async function clickText(page, selector, pattern, required = true) {
  const ok = await page.evaluate(
    ({ selector, source }) => {
      const re = new RegExp(source, "i");
      const nodes = [...document.querySelectorAll(selector)];
      const el = nodes.find((n) => re.test((n.textContent || "").trim()));
      if (!el) return false;
      el.click();
      return true;
    },
    { selector, source: pattern.source }
  );
  if (!ok && required) {
    throw new Error(`Text target not found: ${pattern}`);
  }
  return ok;
}

async function waitForPath(page, pathStartsWith) {
  await page
    .waitForFunction(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`) || location.href.includes(p),
      { timeout: 30000 },
      pathStartsWith
    )
    .catch(() => {});
  await sleep(1200);
}

async function navigate(page, pathName, tier) {
  await page.evaluate((target) => {
    const navLink = [...document.querySelectorAll('nav a, a[href]')].find(
      (a) => (a.getAttribute("href") || "") === target
    );
    if (navLink) {
      navLink.click();
      return;
    }
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, pathName);
  await waitForPath(page, pathName);
  if (page.url().includes("/program-tier")) {
    await selectTier(page, tier);
    await page.evaluate((target) => {
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, pathName);
    await waitForPath(page, pathName);
  }
}

async function selectTier(page, tier) {
  const label = tier === "postgraduate" ? /Postgraduate/i : /Undergraduate/i;
  await clickText(page, "button", label);
  await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 30000 });
  await sleep(1500);
}

async function login(page, account) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('input[autocomplete="email"], input[placeholder*="email"]');
  await page.click('input[autocomplete="email"], input[placeholder*="email"]', { clickCount: 3 });
  await page.type('input[autocomplete="email"], input[placeholder*="email"]', account.email, { delay: 5 });
  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', account.password, { delay: 5 });
  await clickText(page, "button", /Sign In/i);
  await page.waitForFunction(
    () => location.pathname.includes("program-tier") || location.pathname.includes("dashboard"),
    { timeout: 60000 }
  );
  await sleep(1500);
  if (page.url().includes("/program-tier")) {
    await selectTier(page, account.tier);
  }
}

async function openFirstReviewFromProposals(page, tier) {
  await navigate(page, "/proposals", tier);
  const opened = await page.evaluate(() => {
    const direct = [...document.querySelectorAll('a[href*="/review"]')].find((a) =>
      /\/proposals\/.+\/review/.test(a.getAttribute("href") || "")
    );
    if (direct) {
      direct.click();
      return true;
    }
    const fallback = [...document.querySelectorAll("a,button")].find((el) => /^Review$/i.test((el.textContent || "").trim()));
    if (fallback) {
      fallback.click();
      return true;
    }
    return false;
  });
  if (!opened) {
    await navigate(page, "/proposals/6a6651750da5c74b57976f39/review", tier);
    return;
  }
  await waitForPath(page, "/proposals/");
}

async function expandFirstView(page) {
  const ok = await clickText(page, "button", /^View$/i, false);
  if (ok) await sleep(1200);
  return ok;
}

async function scrollToText(page, textPattern) {
  await page.evaluate((source) => {
    const re = new RegExp(source, "i");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const txt = (node.textContent || "").trim();
      if (txt && re.test(txt)) {
        node.scrollIntoView({ behavior: "instant", block: "center" });
        return true;
      }
      node = walker.nextNode();
    }
    return false;
  }, textPattern.source);
  await sleep(1000);
}

async function captureResearcher(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await login(page, ACCOUNTS.researcher);

  await navigate(page, "/proposals/new", ACCOUNTS.researcher.tier);
  await shot(page, "fig-4-5a-proposal-form.png");

  await navigate(page, "/funding-calls", ACCOUNTS.researcher.tier);
  const applied =
    (await clickText(page, "a,button", /Apply via this call/i, false)) ||
    (await clickText(page, "a,button", /Open my application/i, false));
  if (applied) {
    await sleep(1800);
    await shot(page, "fig-4-8a-grant-application-form.png");
  }

  await page.close();
}

async function captureDirector(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await login(page, ACCOUNTS.director);

  await openFirstReviewFromProposals(page, ACCOUNTS.director.tier);
  await scrollToText(page, /Assign peer reviewers/i);
  await shot(page, "fig-4-5b-director-assign-peer.png");

  await navigate(page, "/projects", ACCOUNTS.director.tier);
  await shot(page, "fig-4-5d-approved-proposal-projects.png");

  await navigate(page, "/thesis", ACCOUNTS.director.tier);
  await clickText(page, "button", /\+ New thesis group|Create thesis group/i);
  await sleep(1200);
  await shot(page, "fig-4-10a-create-thesis-group.png");

  await navigate(page, "/notifications", ACCOUNTS.director.tier);
  await shot(page, "fig-4-13-notifications.png");

  await navigate(page, "/pending-users", ACCOUNTS.director.tier);
  await shot(page, "fig-4-14-users.png");

  await page.close();
}

async function captureLeadership(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await login(page, ACCOUNTS.leadership);

  await navigate(page, "/review-assignments", ACCOUNTS.leadership.tier);
  const opened = await clickText(page, "a,button", /Open & submit review|View review|Open review/i, false);
  if (opened) {
    await sleep(1800);
    await scrollToText(page, /Submit peer review|Your peer review/i);
    await shot(page, "fig-4-5c-leadership-peer-review.png");
  } else {
    await shot(page, "fig-4-5c-leadership-peer-review.png");
  }

  await page.close();
}

async function captureFinance(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await login(page, ACCOUNTS.finance);

  await navigate(page, "/finance/reviews", ACCOUNTS.finance.tier);
  await shot(page, "fig-4-8b-finance-review-queue.png");

  await page.close();
}

async function captureCoordinator(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await login(page, ACCOUNTS.coordinator);

  await navigate(page, "/thesis", ACCOUNTS.coordinator.tier);
  await expandFirstView(page);
  await shot(page, "fig-4-10b-title-accept-reject.png");

  await scrollToText(page, /Chapter progress/i);
  await shot(page, "fig-4-10c-chapter-meeting-log.png");

  await scrollToText(page, /Final thesis document/i);
  await shot(page, "fig-4-10d-final-thesis-upload.png");

  await page.close();
}

async function captureArchitecture(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  await page.setContent(
    `<!doctype html>
    <html>
      <head>
        <style>
          body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(180deg,#0b1220,#111827); color: #e5eef9; }
          .wrap { padding: 48px; }
          h1 { margin: 0 0 8px; font-size: 36px; }
          p { margin: 0 0 28px; color: #cbd5e1; font-size: 18px; }
          .row { display: flex; gap: 28px; align-items: center; justify-content: center; margin-top: 40px; }
          .box { width: 360px; min-height: 260px; border-radius: 22px; padding: 26px; box-sizing: border-box; border: 1px solid rgba(125,211,252,.35); background: rgba(15,23,42,.92); box-shadow: 0 18px 40px rgba(0,0,0,.25); }
          .title { font-size: 26px; font-weight: 800; margin-bottom: 14px; color: #7dd3fc; }
          ul { margin: 0; padding-left: 20px; line-height: 1.75; font-size: 18px; color: #e2e8f0; }
          .arrow { font-size: 48px; color: #38bdf8; font-weight: 700; }
          .footer { margin-top: 34px; text-align: center; color: #cbd5e1; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Backend Architecture Diagram</h1>
          <p>Actual implementation stack of the JUST Research Management System.</p>
          <div class="row">
            <div class="box">
              <div class="title">Frontend Client</div>
              <ul>
                <li>React 19 + Vite</li>
                <li>React Router protected routes</li>
                <li>JWT session storage</li>
                <li>Portal selection: UG / PG</li>
              </ul>
            </div>
            <div class="arrow">→</div>
            <div class="box">
              <div class="title">Express API</div>
              <ul>
                <li>Node.js + Express 5</li>
                <li>Controllers, routes, middleware</li>
                <li>RBAC + program-tier scoping</li>
                <li>Multer uploads and notifications</li>
              </ul>
            </div>
            <div class="arrow">→</div>
            <div class="box">
              <div class="title">MongoDB Data Layer</div>
              <ul>
                <li>Mongoose 9 models</li>
                <li>Proposals, projects, grants, budgets</li>
                <li>Thesis groups, users, publications</li>
                <li>Notifications and audit records</li>
              </ul>
            </div>
          </div>
          <div class="footer">Request flow: Browser → Express middleware/controllers → MongoDB → JSON response</div>
        </div>
      </body>
    </html>`,
    { waitUntil: "domcontentloaded" }
  );
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, "fig-4-15-backend-architecture.png"), fullPage: false });
  console.log("saved", "fig-4-15-backend-architecture.png", "local-html");
  await page.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    defaultViewport: { width: 1440, height: 920 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    await captureResearcher(browser);
    await captureDirector(browser);
    await captureLeadership(browser);
    await captureFinance(browser);
    await captureCoordinator(browser);
    await captureArchitecture(browser);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
