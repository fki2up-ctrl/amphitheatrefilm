(async () => {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:5176/alphaprod');
  await new Promise(r => setTimeout(r, 2000));
  const els = await page.$$('.cursor-pointer.hover\\:bg-white\\/5');
  if (els.length > 0) {
    console.log('Clicking row...');
    await els[0].click();
    await new Promise(r => setTimeout(r, 2000));
  }
  await browser.close();
})();
