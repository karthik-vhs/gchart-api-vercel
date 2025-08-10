import chromium from '@sparticuz/chromium';

export const config = { runtime: 'nodejs20.x', regions: ['bom1'] };

export default async function handler(req, res) {
  const exec = await chromium.executablePath();
  res.json({
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    chromiumExecutablePath: exec,
    headless: chromium.headless,
    usingEnvExecutable: !!process.env.PUPPETEER_EXECUTABLE_PATH
  });
}
