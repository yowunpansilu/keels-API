const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku:                   { type: String, required: true, unique: true }, // itemCode
  itemID:                Number,
  name:                  String,
  longDescription:       String,
  currentPrice:          Number,
  imageUrl:              String,
  uom:                   String,      // unit of measure (KG, NO, etc.)
  minQty:                Number,
  maxQty:                Number,
  isPromotionApplied:    Boolean,
  promotionDiscountValue: Number,
  isAvailable:           Boolean,
  isSellingToday:        Boolean,
  stockInHand:           Number,
  departmentCode:        String,
  subDepartmentCode:     String,
  categoryCode:          String,
  departmentId:          Number,
  lastUpdated:           { type: Date, default: Date.now },
});

module.exports = mongoose.model('Product', productSchema);
