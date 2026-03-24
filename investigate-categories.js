const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'https://www.keellssuper.com';

// We'll try a few known department slugs from the site
const DEPARTMENT_SLUGS = [
  '/fresh-vegetables',
  '/fresh-fruits',
  '/bakery',
];

async function investigate() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false, // visible so we can debug
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  for (const slug of DEPARTMENT_SLUGS) {
    console.log(`\n🔍 Navigating to: ${BASE_URL}${slug}`);
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    const captured = [];

    // Intercept all responses from the Keells internal API
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('zebraliveback.keellssuper.com') && !url.includes('GetInitialDataCollection')) {
        try {
          const body = await response.text();
          const entry = {
            url,
            status: response.status(),
            size: body.length,
            preview: body.substring(0, 500),
          };
          captured.push(entry);
          console.log(`  ✅ Captured: ${url} (${body.length} chars)`);
        } catch (e) {
          // ignore
        }
      }
    });

    try {
      await page.goto(`${BASE_URL}${slug}`, { waitUntil: 'networkidle2', timeout: 30000 });
      // Wait a bit more for lazy-loaded requests
      await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
      console.log(`  ⚠️  Navigation error for ${slug}: ${e.message}`);
    }

    results.push({ slug, captured });
    await page.close();

    // Jitter between requests
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
  }

  await browser.close();

  // Save results
  fs.writeFileSync('category-endpoints.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Done. Results saved to category-endpoints.json');

  // Print summary
  console.log('\n--- SUMMARY ---');
  for (const { slug, captured } of results) {
    console.log(`\n${slug}: ${captured.length} API calls intercepted`);
    for (const c of captured) {
      console.log(`  • ${c.url}`);
      console.log(`    Size: ${c.size} chars`);
    }
  }
}

investigate().catch(console.error);
