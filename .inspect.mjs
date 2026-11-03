import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto("http://localhost:5173/pricing", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const report = await page.evaluate(() => {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const cs = (el) => getComputedStyle(el);
  const cards = [...document.querySelectorAll(".plan-card")].map((card) => {
    const name = card.querySelector(".plan-card__name");
    const amount = card.querySelector(".plan-card__amount");
    const summary = card.querySelector(".plan-card__summary");
    const billing = card.querySelector(".plan-card__billing");
    const cta = card.querySelector(".plan-card__cta");
    const label = card.querySelector(".plan-card__label");
    const list = card.querySelector(".plan-card__features");
    return {
      cls: card.className,
      rect: rect(card),
      bg: cs(card).backgroundColor,
      border: cs(card).borderTopColor,
      radius: cs(card).borderRadius,
      name: name?.textContent,
      nameRect: name && rect(name),
      nameFont: name && `${cs(name).fontFamily} / ${cs(name).fontSize} / ${cs(name).fontWeight}`,
      nameColor: name && cs(name).color,
      summaryRect: summary && rect(summary),
      summaryColor: summary && cs(summary).color,
      amount: amount?.textContent,
      amountRect: amount && rect(amount),
      amountFont: amount && cs(amount).fontSize,
      amountColor: amount && cs(amount).color,
      billingRect: billing && rect(billing),
      labelRect: label && rect(label),
      listRect: list && rect(list),
      ctaRect: cta && rect(cta),
      ctaBg: cta && cs(cta).backgroundColor,
      ctaColor: cta && cs(cta).color,
      overflowX: card.scrollWidth - card.clientWidth,
      overflowY: card.scrollHeight - card.clientHeight,
    };
  });
  const stage = document.querySelector(".plans-stage");
  const h1 = document.querySelector("h1");
  return {
    viewport: { w: innerWidth, h: innerHeight },
    pageHeight: document.documentElement.scrollHeight,
    h1: h1 && { text: h1.textContent, rect: rect(h1), font: cs(h1).fontSize },
    stage: stage && {
      rect: rect(stage),
      cols: cs(stage).gridTemplateColumns,
      rows: cs(stage).gridTemplateRows,
      areas: cs(stage).gridTemplateAreas,
    },
    cards,
    text: document.body.innerText.slice(0, 900),
  };
});

console.log(JSON.stringify(report, null, 2));
console.log("ERRORS:", errors);
await browser.close();
