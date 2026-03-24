const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  sku:   { type: String, required: true, index: true },
  price: { type: Number, required: true },
  date:  { type: Date,   default: Date.now },
});

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
