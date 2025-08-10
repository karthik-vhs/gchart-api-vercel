import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Required on Vercel/AWS
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

// Pin runtime/region for Vercel
export const config = {
  runtime: 'nodejs20.x',
  regions: ['bom1'], // Mumbai (optional)
};

export default async function handler(req, res) {
  const { w='800', h='500', type='pie', title='Google Chart', format='png', background='white' } = req.query;

  // … build `rows` + `html` exactly like we had before …

  const width  = Math.max(100, Math.min(4000, parseInt(w, 10) || 800));
  const height = Math.max(100, Math.min(4000, parseInt(h, 10) || 500));

  const html = /* the same HTML string you already used */;

  let browser;
  try {
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: { width, height, deviceScaleFactor: 1 },
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForSelector('body[data-rendered="1"]', { timeout: 15000 });

    const isJpeg = String(format).toLowerCase() === 'jpeg';
    const buf = await page.screenshot({ type: isJpeg ? 'jpeg' : 'png' });

    res.setHeader('Content-Type', isJpeg ? 'image/jpeg' : 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).send('Render failed: ' + err.message);
  } finally {
    if (browser) await browser.close();
  }
}
