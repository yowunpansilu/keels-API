require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const mongoose = require('mongoose');
const Product = require('./models/Product');
const PriceHistory = require('./models/PriceHistory');

puppeteer.use(StealthPlugin());

const {
  CATEGORIES,
  OUTLET_CODE,
  BASE_URL,
  API_BASE,
  DEFAULT_ITEMS_PER_PAGE,
  MAX_PAGES_PER_CATEGORY
} = require('./config/constants');

async function safeNavigate(page, url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // Use domcontentloaded for faster JSON API response handling
      // Increase timeout on each retry (30s, 45s and 60s)
      const timeout = 30000 + (i * 15000);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      return true;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`    [Retry ${i + 1}/${retries}] Failed to navigate: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 3000 * (i + 1))); // Incremental backoff
    }
  }
}

async function scrapeAll() {
  let browser;
  const stats = { total: 0, new: 0, updated: 0, priceChanged: 0, errors: 0 };

  try {
    if (!mongoose.connection.readyState) {
      const uri = process.env.MONGODB_URI;
      if (!uri) {
        throw new Error('MONGODB_URI is not defined in environment variables');
      }
      const maskedUri = uri.replace(/:([^@]+)@/, ':****@');
      console.log(`Connecting to MongoDB: ${maskedUri}`);
      await mongoose.connect(uri);
    }
    console.log(`Connected to Database: ${mongoose.connection.db.databaseName}`);

    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);

    let capturedSessionId = null;

    page.on('request', request => {
      const headers = request.headers();
      if (headers['usersessionid'] && !capturedSessionId) {
        capturedSessionId = headers['usersessionid'];
        console.log(`Captured Session ID: ${capturedSessionId}`);
      }
    });

    console.log('Establishing session...');
    await safeNavigate(page, BASE_URL);

    // Visit a category to trigger the session header
    console.log('Triggering session via Vegetables category...');
    await safeNavigate(page, CATEGORIES[0].url);
    await new Promise(r => setTimeout(r, 5000));

    if (!capturedSessionId) {
      console.log('Session ID not captured from headers. Checking cookies...');
      const cookies = await page.cookies();
      const sCookie = cookies.find(c => c.name.includes('usersessionid'));
      if (sCookie) capturedSessionId = sCookie.value;
    }

    if (capturedSessionId) {
      console.log(`Authenticated with Session ID: ${capturedSessionId}`);
      await page.setExtraHTTPHeaders({ 'usersessionid': capturedSessionId });
    } else {
      console.warn('WARNING: No Session ID captured. Attempting scrape without authentication headers.');
    }

    for (const cat of CATEGORIES) {
      console.log(`\n--- Scraping ${cat.name} (ID: ${cat.id}) ---`);

      let pageNo = 1;
      let hasMore = true;
      while (hasMore && pageNo <= MAX_PAGES_PER_CATEGORY) {
        const apiUrl = `${API_BASE}/2.0/WebV2/GetItemDetails?pageNo=${pageNo}&itemsPerPage=${DEFAULT_ITEMS_PER_PAGE}&outletCode=${OUTLET_CODE}&departmentId=${cat.id}&itemPricefrom=0&itemPriceTo=200000&isFeatured=0&isPromotionOnly=false&sortBy=default&isShowOutofStockItems=true`;

        console.log(`    [Page ${pageNo}] Fetching API data...`);
        try {
          await safeNavigate(page, apiUrl);
          const content = await page.evaluate(() => document.body.innerText);

          const data = JSON.parse(content);
          if (data.statusCode !== 200) {
            console.log(`    [Page ${pageNo}] API returned status ${data.statusCode}. End of category.`);
            break;
          }

          const items = data.result?.itemDetailResult?.itemDetails || [];
          console.log(`    [Page ${pageNo}] Processing ${items.length} items...`);
          for (const item of items) {
            item.departmentId = cat.id;
            item.departmentName = cat.name;
            const result = await upsertProduct(item);

            stats.total++;
            if (result === 'new') stats.new++;
            else if (result === 'updated') stats.updated++;
            else if (result === 'price_changed') { stats.updated++; stats.priceChanged++; }
            else if (result === 'error') stats.errors++;
          }

          if (items.length === 0 || pageNo >= data.result.itemDetailResult.pageCount) {
            hasMore = false;
          } else {
            pageNo++;
            await new Promise(r => setTimeout(r, 1500));
          }
        } catch (err) {
          console.error(`    [Page ${pageNo}] Error: ${err.message}`);
          stats.errors++;
          break;
        }
      }
    }

    console.log('\n=====================================');
    console.log('      SCRAPE SUMMARY');
    console.log('=====================================');
    console.log(`Total Scanned:   ${stats.total}`);
    console.log(`New Added:       ${stats.new}`);
    console.log(`Price Changes:   ${stats.priceChanged}`);
    console.log(`Total Updated:   ${stats.updated}`);
    console.log(`Errors:          ${stats.errors}`);
    console.log('=====================================\n');

  } catch (error) {
    console.error('Global Scrape failed:', error.stack);
  } finally {
    if (browser) await browser.close();
  }
}

async function upsertProduct(item) {
  const sku = item.itemCode;
  if (!sku) {
    console.warn(`    [!] Missing SKU for item: ${item.name || 'Unknown'}`);
    return 'error';
  }

  try {
    const currentPrice = item.amount;
    const existingProduct = await Product.findOne({ sku });

    if (existingProduct) {
      let status = 'updated';
      if (existingProduct.currentPrice !== currentPrice) {
        console.log(`    [Price Change] ${sku}: ${existingProduct.currentPrice} -> ${currentPrice} (${item.name})`);
        await new PriceHistory({ sku, price: currentPrice, date: new Date() }).save();
        status = 'price_changed';
      }

      Object.assign(existingProduct, {
        itemID: item.itemID,
        name: item.name,
        currentPrice,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
        departmentId: item.departmentId,
        departmentName: item.departmentName,
        lastUpdated: new Date()
      });
      await existingProduct.save();
      return status;
    } else {
      console.log(`    [New Product] ${sku}: ${item.name} @ ${currentPrice}`);
      const newProduct = new Product({
        sku,
        itemID: item.itemID,
        name: item.name,
        currentPrice,
        imageUrl: item.imageUrl,
        uom: item.uom,
        isAvailable: item.isAvailable,
        departmentId: item.departmentId,
        departmentName: item.departmentName
      });
      await newProduct.save();
      await new PriceHistory({ sku, price: currentPrice, date: new Date() }).save();
      return 'new';
    }
  } catch (err) {
    console.error(`    [Error Saving] ${sku}: ${err.message}`);
    return 'error';
  }
}

if (require.main === module) { scrapeAll(); }
module.exports = scrapeAll;
