require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Product = require('./models/Product');
const PriceHistory = require('./models/PriceHistory');

const MONGODB_URI = process.env.MONGODB_URI;
const BASE_URL = 'https://zebraliveback.keellssuper.com';

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Origin': 'https://www.keellssuper.com',
  'Referer': 'https://www.keellssuper.com/',
};

async function scrapeAll() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Get Initial Data (Departments)
    console.log('Fetching initial data...');
    const initialData = await axios.get(`${BASE_URL}/1.0/Web/GetInitialDataCollection`, {
      params: { locationCode: 'SCDR', shippingDetailsId: 0 },
      headers: HEADERS
    });

    const departments = initialData.data.result.departmentList || [];
    console.log(`Found ${departments.length} departments.`);

    for (const dept of departments) {
      console.log(`\n--- Scraping Department: ${dept.departmentName} (ID: ${dept.departmentID}) ---`);
      
      let pageNo = 1;
      let pageCount = 1;

      while (pageNo <= pageCount) {
        console.log(`  Fetching page ${pageNo} of ${pageCount}...`);
        
        const response = await axios.get(`${BASE_URL}/2.0/WebV2/GetItemDetails`, {
          params: {
            pageNo: pageNo,
            itemsPerPage: 100, // Maximizing efficiency
            outletCode: 'SCBI',
            departmentId: dept.departmentID,
            itemPricefrom: 0,
            itemPriceTo: 100000,
            isFeatured: 0,
            isPromotionOnly: false,
            sortBy: 'default',
            isShowOutofStockItems: true
          },
          headers: HEADERS
        });

        if (response.data.statusCode !== 200) {
          console.error(`    Error fetching page ${pageNo}:`, response.data.errorList);
          break;
        }

        const result = response.data.result.itemDetailResult;
        pageCount = result.pageCount;
        const items = result.itemDetails || [];

        for (const item of items) {
          await upsertProduct(item, dept.departmentID);
        }

        console.log(`    Processed ${items.length} items from page ${pageNo}.`);
        pageNo++;

        // Jitter delay between pages to be a good citizen
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
      }
      
      // Delay between departments
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\nScrape completed successfully.');
  } catch (error) {
    console.error('Scrape failed:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

async function upsertProduct(item, deptId) {
  const sku = item.itemCode;
  const currentPrice = item.amount;

  // Find existing product
  const existingProduct = await Product.findOne({ sku });

  if (existingProduct) {
    // If price changed, record history
    if (existingProduct.currentPrice !== currentPrice) {
      console.log(`    [PRICE CHANGE] ${item.name}: ${existingProduct.currentPrice} -> ${currentPrice}`);
      await new PriceHistory({
        sku,
        price: currentPrice,
        date: new Date()
      }).save();
    }

    // Update product details
    Object.assign(existingProduct, {
      itemID: item.itemID,
      name: item.name,
      longDescription: item.longDescription,
      currentPrice: currentPrice,
      imageUrl: item.imageUrl,
      uom: item.uom,
      minQty: item.minQty,
      maxQty: item.maxQty,
      isPromotionApplied: item.isPromotionApplied,
      promotionDiscountValue: item.promotionDiscountValue,
      isAvailable: item.isAvailable,
      isSellingToday: item.isSellingToday,
      stockInHand: item.stockInHand,
      departmentCode: item.departmentCode,
      subDepartmentCode: item.subDepartmentCode,
      categoryCode: item.categoryCode,
      departmentId: deptId,
      lastUpdated: new Date()
    });

    await existingProduct.save();
  } else {
    // New product
    console.log(`    [NEW ITEM] ${item.name} at ${currentPrice}`);
    const newProduct = new Product({
      sku,
      itemID: item.itemID,
      name: item.name,
      longDescription: item.longDescription,
      currentPrice: currentPrice,
      imageUrl: item.imageUrl,
      uom: item.uom,
      minQty: item.minQty,
      maxQty: item.maxQty,
      isPromotionApplied: item.isPromotionApplied,
      promotionDiscountValue: item.promotionDiscountValue,
      isAvailable: item.isAvailable,
      isSellingToday: item.isSellingToday,
      stockInHand: item.stockInHand,
      departmentCode: item.departmentCode,
      subDepartmentCode: item.subDepartmentCode,
      categoryCode: item.categoryCode,
      departmentId: deptId
    });

    await newProduct.save();

    // Initial history entry
    await new PriceHistory({
      sku,
      price: currentPrice,
      date: new Date()
    }).save();
  }
}

if (require.main === module) {
  scrapeAll();
}

module.exports = scrapeAll;
