/**
 * Network Interception Test Script
 * 
 * This script opens keellssuper.com using stealth Puppeteer,
 * intercepts ALL network responses, and logs any that look like
 * product/price data (JSON responses from API endpoints).
 * 
 * Goal: Discover the internal API endpoints that Keells uses
 * to load product data on the frontend.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  console.log('🚀 Launching stealth browser...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();

  // Set a realistic viewport and user-agent
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Collect intercepted API responses
  const interceptedResponses = [];

  // Listen for all network responses
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // We're interested in JSON API responses (not images, CSS, JS bundles, etc.)
    if (contentType.includes('application/json') || contentType.includes('text/json')) {
      try {
        const body = await response.text();
        const entry = {
          url: url,
          status: response.status(),
          contentType: contentType,
          bodyPreview: body.substring(0, 500), // First 500 chars
          bodyLength: body.length,
        };
        interceptedResponses.push(entry);
        console.log(`\n📡 [JSON Response] ${response.status()} | ${url}`);
        console.log(`   Size: ${body.length} chars`);
        console.log(`   Preview: ${body.substring(0, 200)}...`);
      } catch (e) {
        // Some responses may not be readable
      }
    }
  });

  try {
    console.log('\n🌐 Navigating to https://www.keellssuper.com/ ...');
    await page.goto('https://www.keellssuper.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    console.log('✅ Page loaded. Waiting 5s for lazy-loaded content...');
    await new Promise((r) => setTimeout(r, 5000));

    // Now try clicking on a product category to trigger more API calls
    console.log('\n🔍 Scrolling down to trigger lazy loading...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 3000));

    // Try navigating to a category page
    console.log('\n🛒 Navigating to a category page...');
    await page.goto('https://www.keellssuper.com/category', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await new Promise((r) => setTimeout(r, 5000));

    // Also try the search feature which often uses APIs
    console.log('\n🔎 Trying search endpoint...');
    await page.goto('https://www.keellssuper.com/search?q=milk', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await new Promise((r) => setTimeout(r, 5000));

  } catch (err) {
    console.log(`⚠️ Navigation note: ${err.message}`);
  }

  // Save all intercepted responses to a file for analysis
  const outputPath = '/Users/yowunpansilu/Documents/GitHub/keels API/intercepted-responses.json';
  fs.writeFileSync(outputPath, JSON.stringify(interceptedResponses, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 RESULTS SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total JSON responses intercepted: ${interceptedResponses.length}`);
  console.log(`Full data saved to: intercepted-responses.json`);

  if (interceptedResponses.length > 0) {
    console.log(`\n🎯 Unique API endpoints found:`);
    const uniqueUrls = [...new Set(interceptedResponses.map((r) => {
      try { return new URL(r.url).pathname; } catch { return r.url; }
    }))];
    uniqueUrls.forEach((u) => console.log(`   - ${u}`));
  }

  await browser.close();
  console.log('\n🏁 Done! Check intercepted-responses.json for full data.');
})();
