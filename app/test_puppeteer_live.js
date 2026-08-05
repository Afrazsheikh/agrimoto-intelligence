import puppeteer from 'puppeteer-core';
import fs from 'fs';

function findBrowserPath() {
  const paths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function testStealthScrape() {
  const browserPath = findBrowserPath();

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  const url = 'https://www.meesho.com/honda-gx80-carburator-for-petrol-generator-replacement/p/gt6ooa';
  console.log('Navigating stealthily to:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

  const nextData = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__');
    return el ? el.textContent : null;
  });

  if (nextData) {
    console.log('🎉 STEALTH SUCCESS! __NEXT_DATA__ CAPTURED!');
    const json = JSON.parse(nextData);
    const detailsData = json.props?.pageProps?.initialState?.product?.details?.data;
    console.log('REAL NAME:', detailsData?.name);
    console.log('REAL PRICE:', detailsData?.price);
    console.log('REAL SUPPLIER:', detailsData?.supplier_name);
    console.log('REAL IMAGE:', detailsData?.images?.[0]);
  } else {
    console.log('No __NEXT_DATA__, checking page title:', await page.title());
  }

  await browser.close();
}

testStealthScrape();
