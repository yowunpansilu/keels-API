# Keells Supermarket - Network Interception Findings

> **Date:** 2026-03-24  
> **Status:** ✅ Network Interception **CONFIRMED WORKING** — We do NOT need DOM scraping.

---

## 1. Discovery: Internal API Found

Keells Supermarket uses an internal REST API hosted at:

```
https://zebraliveback.keellssuper.com/1.0/
```

This API is called by the frontend to load all product data. By intercepting these network requests using Puppeteer Stealth, we can capture clean, structured JSON data directly — **no HTML parsing needed**.

---

## 2. Key API Endpoints Discovered

| Endpoint | Purpose | Notes |
|---|---|---|
| `/1.0/Web/GetInitialDataCollection?locationCode=SCDR&shippingDetailsId=0` | Departments (12), sub-departments (87), categories (322), 6,734 product suggestions, deals, best sellers | 510,853 chars — run once at startup |
| **`/2.0/WebV2/GetItemDetails`** | **Full paginated product list with prices** | ✅ CONFIRMED WORKING |
| `/1.0/Common/GetSystemConfiguration` | System settings | 2,161 chars |
| `/1.0/Login/GuestLogin` | Guest session token | 842 chars |

> **`GetItemDetails` is the scraping endpoint.** Call it per-department, paginated, to get every product with live price data.

### GetItemDetails Parameters
```
GET https://zebraliveback.keellssuper.com/2.0/WebV2/GetItemDetails
  ?pageNo=1
  &itemsPerPage=12          # can increase for efficiency
  &outletCode=SCBI
  &departmentId=16          # iterate over all 12 departments
  &itemPricefrom=0
  &itemPriceTo=5000
  &isFeatured=0
  &isPromotionOnly=false
  &sortBy=default
  &isShowOutofStockItems=true
```

### Pagination
- Response includes `pageCount` (e.g., 16 pages for Vegetables at 12 items/page)
- Must iterate `pageNo` from 1 → `pageCount` per department
- **Strategy**: Increase `itemsPerPage` (try 100) to reduce requests

---

## 3. Data Structure Inside `GetInitialDataCollection`

### 3.1 Departments (16 total)
Examples: Vegetables, Fruits, Bakery, Meats, Seafood, Beverages, etc.

### 3.2 Sub-Departments (87 total)
Examples: Desserts, Buns, Frozen Meats, Canned Fish, etc.

### 3.3 Categories (322 total)
Each category has: `categoryID`, `departmentID`, `subDepartmentID`, `categoryCode`, `categoryName`

### 3.4 Product Suggestions (6,734 items)
Contains `itemID` and `itemName` for every product in the catalog.
```json
{ "itemID": 78247, "itemName": "Myco Farm Abalone Mushroom 200g" }
```

### 3.5 Deals / Best Sellers (with full price data)
Each product object contains rich data:
```json
{
  "itemID": 46460,
  "itemCode": "5125",
  "name": "Milo Malted Food Drink Packet 400g",
  "amount": 890,
  "imageUrl": "https://essstr.blob.core.windows.net/essimg/350x/Small/Pic5125.jpg",
  "stockInHand": 11,
  "isPromotionApplied": true,
  "promotionDiscountValue": 133.5,
  "isAvailable": true,
  "departmentCode": "...",
  "subDepartmentCode": "...",
  "categoryCode": "..."
}
```

**Fields available per product:**
`itemID`, `itemCode`, `name`, `longDescription`, `amount` (price), `imageUrl`, `minQty`, `maxQty`, `stockInHand`, `uom`, `isPromotionApplied`, `promotionDiscountValue`, `discountValue`, `isAvailable`, `departmentCode`, `subDepartmentCode`, `categoryCode`, `isSellingToday`

### 3.6 Promotions (10 detail records)
Contains `discountPercentage`, `discountValue`, `promotionTypeID`, linked to products by `itemID`.

---

## 4. Scraping Strategy (Confirmed ✅)

1. Call `GetInitialDataCollection` once → extract all 12 **departmentIds**.
2. For each department, call `GetItemDetails` with `departmentId` + `pageNo=1` → read `pageCount`.
3. Loop `pageNo` from 1 → `pageCount`, collecting all `itemDetails` arrays.
4. Upsert each product into MongoDB `products` collection; if `amount` changed → append to `priceHistory`.

### Scraping without Puppeteer
The `GetItemDetails` endpoint is a **plain HTTPS GET** — no browser needed. We can call it directly with `node-fetch` or `axios`, making the scraper much faster and lighter (no Chrome dependency).

### Confirmed Fields
`itemID`, `itemCode`, `name`, `longDescription`, `amount` (LKR price), `imageUrl`, `minQty`, `maxQty`, `slabQty`, `uom`, `stockInHand`, `isPromotionApplied`, `promotionDiscountValue`, `discountValue`, `isAvailable`, `isSellingToday`, `departmentCode`, `subDepartmentCode`, `categoryCode`

### Performance Note
- Server response time is ~8s per page at 12 items/page
- Plan: use `itemsPerPage=100` to minimize round trips
- Add 1–2s delay between department requests to avoid rate limiting

### Next Steps ✅
- [x] Discover category product listing endpoint
- [ ] Build scraper using direct `axios` calls (no Puppeteer needed)
- [ ] Test with `itemsPerPage=100` to confirm larger pages work

---

## 5. Tools Used
- `puppeteer-core` (uses system Chrome — no download needed)
- `puppeteer-extra` + `puppeteer-extra-plugin-stealth`
- System Chrome at `/Applications/Google Chrome.app/`
