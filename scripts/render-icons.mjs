// Render the PWA icons from public/icons/icon.svg (run once; outputs are committed).
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/icons/icon.svg", "utf8");
const browser = await chromium.launch();
for (const [size, name, pad] of [[192, "icon-192.png", 0], [512, "icon-512.png", 0], [512, "maskable-512.png", 64], [180, "apple-touch-icon.png", 0], [32, "favicon-32.png", 0]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = size - pad * 2;
  await page.setContent(`<html><body style="margin:0;background:${pad ? "#F7F9FF" : "transparent"}"><div style="padding:${pad}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: !pad });
  await page.close();
}
await browser.close();
