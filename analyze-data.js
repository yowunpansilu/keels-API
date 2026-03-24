const puppeteer = require('puppeteer-extra');
const Stealth = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(Stealth());

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  let captured = null;

  page.on('response', async (res) => {
    if (res.url().includes('GetInitialDataCollection') && captured === null) {
      try {
        captured = await res.text();
      } catch (e) {
        console.log('Failed to read response:', e.message);
      }
    }
  });

  await page.goto('https://www.keellssuper.com/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  if (!captured) {
    console.log('ERROR: No data captured');
    await browser.close();
    return;
  }

  const parsed = JSON.parse(captured);
  const result = parsed.result;

  // Departments
  console.log('=== DEPARTMENTS (' + (result.departmentList || []).length + ') ===');
  if (result.departmentList) {
    result.departmentList.forEach(d => console.log('  ' + d.departmentID + ' | ' + d.departmentName));
  }

  // Top-level keys
  console.log('\n=== TOP-LEVEL KEYS IN result ===');
  Object.keys(result).forEach(key => {
    const val = result[key];
    if (Array.isArray(val)) {
      console.log('  ' + key + ': Array[' + val.length + ']');
    } else if (typeof val === 'object' && val !== null) {
      console.log('  ' + key + ': Object with keys ' + JSON.stringify(Object.keys(val)));
    } else {
      console.log('  ' + key + ': ' + typeof val);
    }
  });

  // Find arrays that contain product-like objects (with price fields)
  console.log('\n=== LOOKING FOR PRODUCT DATA ===');
  for (const key of Object.keys(result)) {
    if (Array.isArray(result[key]) && result[key].length > 0) {
      const sample = result[key][0];
      const sampleKeys = Object.keys(sample);
      const hasPrice = sampleKeys.some(k => k.toLowerCase().includes('price'));
      const hasName = sampleKeys.some(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('item'));
      if (hasPrice || hasName) {
        console.log('\n--- Key: "' + key + '" | Count: ' + result[key].length + ' ---');
        console.log('Fields:', sampleKeys.join(', '));
        console.log('Sample:', JSON.stringify(sample, null, 2).substring(0, 600));
      }
    }
  }

  // Save full overview
  const overview = {};
  for (const key of Object.keys(result)) {
    if (Array.isArray(result[key])) {
      overview[key] = {
        count: result[key].length,
        sampleKeys: result[key].length > 0 ? Object.keys(result[key][0]) : [],
        sample: result[key].length > 0 ? result[key][0] : null
      };
    } else {
      overview[key] = { type: typeof result[key], value: result[key] };
    }
  }
  fs.writeFileSync('./data-structure-overview.json', JSON.stringify(overview, null, 2));
  console.log('\nFull structure overview saved to data-structure-overview.json');

  await browser.close();
  console.log('Done.');
})();
