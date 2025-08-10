import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const {
    w = '800', h = '500',
    type = 'pie',            // pie | bar | line
    title = 'Google Chart',
    format = 'png',          // png | jpeg
    background = 'white'
  } = req.query;

  let rows;
  try {
    rows = req.query.data ? JSON.parse(req.query.data) : null;
  } catch {
    return res.status(400).send('Invalid JSON in `data` query param');
  }

  const width = Math.max(100, Math.min(4000, parseInt(w, 10) || 800));
  const height = Math.max(100, Math.min(4000, parseInt(h, 10) || 500));

  if (!rows) {
    rows = type === 'pie'
      ? [['Task','Hours per Day'],['Work',11],['Eat',2],['Commute',2],['Watch TV',2],['Sleep',7]]
      : [['Year','Sales','Expenses'],['2019',1000,400],['2020',1170,460],['2021',660,1120],['2022',1030,540]];
  }

  const datasetJson = JSON.stringify(rows);
  const html = `<!doctype html><html><head>
    <meta charset="utf-8"/>
    <style>html,body{margin:0;background:${escapeCss(background)};}#c{width:${width}px;height:${height}px}</style>
    <script src="https://www.gstatic.com/charts/loader.js"></script>
    <script>
      const rows = ${datasetJson};
      const type = ${JSON.stringify(type)};
      const title = ${JSON.stringify(title)};
      const width = ${width}, height=${height};
      google.charts.load('current',{packages:['corechart']});
      google.charts.setOnLoadCallback(draw);
      function draw(){
        const data = google.visualization.arrayToDataTable(rows);
        const opts = {title, width, height, backgroundColor:${JSON.stringify(background)},
                      legend:{position:'right'}, chartArea:{width:'85%',height:'75%'}};
        const el = document.getElementById('c');
        const chart = type==='bar' ? new google.visualization.ColumnChart(el)
                     : type==='line'? new google.visualization.LineChart(el)
                     : new google.visualization.PieChart(el);
        google.visualization.events.addListener(chart,'ready',()=>document.body.setAttribute('data-rendered','1'));
        chart.draw(data, opts);
      }
    </script></head><body><div id="c"></div></body></html>`;

  let browser;
  try {
    const exePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width, height, deviceScaleFactor: 1 },
      executablePath: exePath,          // works locally & on Vercel
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForSelector('body[data-rendered="1"]', { timeout: 15000 });

    const asJpeg = String(format).toLowerCase() === 'jpeg';
    const buf = await page.screenshot({ type: asJpeg ? 'jpeg' : 'png' });

    res.setHeader('Content-Type', asJpeg ? 'image/jpeg' : 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).send('Render failed: ' + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

function escapeCss(s = '') { return String(s).replace(/[(){};"]/g, ''); }
