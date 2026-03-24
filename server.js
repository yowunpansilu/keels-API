require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_WINDOW, RATE_LIMIT_MAX } = require('./config/constants');
const Product = require('./models/Product');
const PriceHistory = require('./models/PriceHistory');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting (Adjustable via .env or constants.js)
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW) : RATE_LIMIT_WINDOW,
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : RATE_LIMIT_MAX,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Simple API Key Middleware
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.header('X-API-KEY');
  if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }
  next();
};

// 1. Get all products with pagination and search
app.get('/api/products', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', departmentId } = req.query;

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (departmentId) {
      query.departmentId = departmentId;
    }
    if (req.query.category) {
      query.departmentName = { $regex: req.query.category, $options: 'i' };
    }

    const products = await Product.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 })
      .exec();

    const count = await Product.countDocuments(query);

    res.json({
      products,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalItems: count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get specific product details
app.get('/api/products/:sku', async (req, res) => {
  try {
    const product = await Product.findOne({ sku: req.params.sku });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get price history for a product
app.get('/api/products/:sku/history', async (req, res) => {
  try {
    const history = await PriceHistory.find({ sku: req.params.sku }).sort({ date: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Status API - See how many items are scraped
app.get('/api/status', async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalHistory = await PriceHistory.countDocuments();
    const latestProduct = await Product.findOne().sort({ lastUpdated: -1 });

    // Group by department to see progress
    const byDept = await Product.aggregate([
      {
        $group: {
          _id: '$departmentName',
          id: { $first: '$departmentId' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      status: 'success',
      totalProducts,
      totalHistory,
      lastUpdate: latestProduct ? latestProduct.lastUpdated : null,
      byDepartment: byDept
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Manual trigger for scraper (Protected)
app.post('/api/scraper/run', apiKeyMiddleware, async (req, res) => {
  const scrapeAll = require('./scraper');
  res.json({ message: 'Scraper started in background' });
  scrapeAll().catch(console.error);
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
