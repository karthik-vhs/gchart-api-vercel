import express from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const app = express();

// quick health + diag
app.get('/health', (req, res) => res.type('text').send('OK'));
app.get('/diag', async (req, res) => {
  res.json({
    node: process.version,
    platform: process.platform,
    execPath: await chromium.executablePath(),
    headless: chromium.headless
  });
});

// default rows
const defaultRows = [
  ['Defect', 'Qty'],
  ['Broken stitch / Run off stitch / Open seam', 25],
  ['Puckered seam / Pleated seam / Twisted seam', 20],
  ['Missed stitch / Missed bar-tuck', 4]
];

// render the same HTML used by your page + a “rendered” signal
const chartHtml = (rows) => `<!doctype html><html><head>
  <meta charset="utf-8"/>
  <script src="https://www.gstatic.com/charts/loader.js"></script>
  <style>
    html,body{margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif}
    #chart-wrap{display:flex;justify-content:center}
    #chart{width:800px;height:500px}
  </style>
</head><body>
  <div id="chart-wrap"><div id="chart"></div></div>
  <script>
    const chartData = ${JSON.stringify(rows)};
    const chartOptions = {
      is3D:true,
      chartArea:{left:10,top:30,width:'95%',height:'85%'},
      slices:{0:{color:'#f1c40f'},1:{color:'#2ecc71'},2:{color:'#0b2a58'}}
    };
    google.charts.load('current',{packages:['corechart']});
    google.charts.setOnLoadCallback(()=>{
      const data = google.visualization.arrayToDataTable(chartData);
      const chart = new google.visualization.PieChart(document.getElementById('chart'));
      google.visualization.events.addListener(chart,'ready',()=>document.body.setAttribute('data-rendered','1'));
      chart.draw(data, chartOptions);
    });
  </script>
</body></html>`;

// HTML page (fast)
app.get(['/', '/chart'], (req, res) => {
  let rows = defaultRows;
  if (req.query.data) { try { rows = JSON.parse(req.query.data); } catch {} }
  res.type('html').send(chartHtml(rows));
});

// PNG endpoint (optimized to avoid timeouts)
app.get('/chart.png', async (req, res) => {
  const t0 = Date.now();
  let rows = defaultRows;
  if (req.query.data) { try { rows = JSON.parse(req.query.data); } catch {} }

  let browser;
  try {
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    const execPath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      executablePath: execPath,
      // Always headless on Vercel
      headless: true,
      defaultViewport: { width: 800, height: 500, deviceScaleFactor: 1 }
    });

    const page = await browser.newPage();

    // Faster than networkidle0; rely on our own "rendered" signal
    await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(chartHtml(rows)), {
      waitUntil: 'domcontentloaded',
      timeout: 5000
    });

    // Wait for the chart's 'ready' listener (body[data-rendered="1"])
    await page.waitForSelector('body[data-rendered="1"]', { timeout: 7000 });

    const png = await page.screenshot({ type: 'png' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(png);
  } catch (err) {
    res.status(500).send('Render failed: ' + err.message);
  } finally {
    if (browser) await browser.close();
    // console timing (visible in Runtime Logs)
    console.log('chart.png total ms:', Date.now() - t0);
  }
});

export default app;
