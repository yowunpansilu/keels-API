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

async function scrapeAll() {
  let browser;
  try {
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    console.log('Connected to MongoDB');

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
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Visit a category to trigger the session header
    console.log('Triggering session via Vegetables category...');
    await page.goto(CATEGORIES[0].url, { waitUntil: 'networkidle2', timeout: 30000 });
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
        
        console.log(`    API Page ${pageNo}...`);
        try {
            await page.goto(apiUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            const content = await page.evaluate(() => document.body.innerText);
            
            const data = JSON.parse(content);
            if (data.statusCode !== 200) {
                console.log(`    API returned status ${data.statusCode}. End of category.`);
                break;
            }

            const items = data.result?.itemDetailResult?.itemDetails || [];
            console.log(`    Processing ${items.length} items.`);
            for (const item of items) {
                item.departmentId = cat.id; 
                item.departmentName = cat.name; // Use the provided category name
                await upsertProduct(item);
            }
            
            if (items.length === 0 || pageNo >= data.result.itemDetailResult.pageCount) {
                hasMore = false;
            } else {
                pageNo++;
                await new Promise(r => setTimeout(r, 1500));
            }
        } catch (err) {
            console.error(`    Error on page ${pageNo}: ${err.message}`);
            break;
        }
      }
    }

    console.log('\nGlobal Scrape finished successfully.');
  } catch (error) {
    console.error('Global Scrape failed:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function upsertProduct(item) {
  const sku = item.itemCode;
  if (!sku) return;

  const currentPrice = item.amount;
  const existingProduct = await Product.findOne({ sku });

  if (existingProduct) {
    if (existingProduct.currentPrice !== currentPrice) {
      await new PriceHistory({ sku, price: currentPrice, date: new Date() }).save();
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
  } else {
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
  }
}

if (require.main === module) { scrapeAll(); }
module.exports = scrapeAll;
