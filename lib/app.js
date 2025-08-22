import express from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const app = express();

// === Your chart HTML (from your snippet), with a small "ready" signal ===
const buildChartHtml = (rows) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://www.gstatic.com/charts/loader.js"></script>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; }
    h2 { text-align: center; margin: 0 0 10px 0; letter-spacing: .5px; }
    #chart-wrap { display: flex; justify-content: center; }
    #chart { width: 800px; height: 500px; }
    .actions { text-align: center; margin-top: 12px; }
    button { padding: 8px 14px; margin: 0 6px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="chart-wrap"><div id="chart"></div></div>

  <script>
    const chartData = ${JSON.stringify(rows)};
    const chartOptions = {
      is3D: true,
      chartArea: { left: 10, top: 30, width: '95%', height: '85%' },
      slices: {
        0: { color: '#f1c40f' }, // yellow
        1: { color: '#2ecc71' }, // green
        2: { color: '#0b2a58' }  // dark blue
      }
    };

    let chart, dataTable;
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(draw);

    function draw() {
      dataTable = google.visualization.arrayToDataTable(chartData);
      chart = new google.visualization.PieChart(document.getElementById('chart'));
      google.visualization.events.addListener(chart, 'ready', () => {
        // Signal Puppeteer that rendering is done
        document.body.setAttribute('data-rendered','1');
      });
      chart.draw(dataTable, chartOptions);
    }

    window.addEventListener('resize', () => chart && chart.draw(dataTable, chartOptions));
  </script>
</body>
</html>`;

// Default rows if none supplied
const defaultRows = [
  ['Defect', 'Qty'],
  ['Broken stitch / Run off stitch / Open seam', 25],
  ['Puckered seam / Pleated seam / Twisted seam', 20],
  ['Missed stitch / Missed bar-tuck', 4]
];

// Helper: choose a browser path (local dev vs Vercel)
async function getExecutablePath() {
  // For local dev on Win/Mac, prefer a locally installed Chrome/Edge if provided
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  // On Vercel/Linux, use Sparticuz Chromium
  return await chromium.executablePath();
}

// ---- Routes ----

// HTML preview of the chart
app.get(['/', '/chart'], (req, res) => {
  let rows = defaultRows;
  if (req.query.data) {
    try { rows = JSON.parse(req.query.data); } catch {}
  }
  res.type('html').send(buildChartHtml(rows));
});

// PNG image of the chart
app.get('/chart.png', async (req, res) => {
  let rows = defaultRows;
  if (req.query.data) {
    try { rows = JSON.parse(req.query.data); } catch {}
  }

  let browser;
  try {
    const executablePath = await getExecutablePath();
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      executablePath,
      headless: true,
      defaultViewport: { width: 800, height: 500, deviceScaleFactor: 1 }
    });

    const page = await browser.newPage();
    await page.setContent(buildChartHtml(rows), { waitUntil: 'networkidle0' });
    await page.waitForSelector('body[data-rendered="1"]', { timeout: 15000 });

    const png = await page.screenshot({ type: 'png' });
    res.type('png').send(png);
  } catch (err) {
    res.status(500).send('Render failed: ' + err.message);
  } finally {
    if (browser) await browser.close();
  }
});

export default app;
