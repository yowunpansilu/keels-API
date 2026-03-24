module.exports = {
  CATEGORIES: [
    { name: 'Vegetables', id: 16, url: 'https://www.keellssuper.com/fresh-vegetables' },
    { name: 'Fruits', id: 6, url: 'https://www.keellssuper.com/fresh-fruits' },
    { name: 'Meat', id: 12, url: 'https://www.keellssuper.com/fresh-meat' },
    { name: 'Seafood', id: 4, url: 'https://www.keellssuper.com/fresh-seafood' },
    { name: 'Grocery', id: 7, url: 'https://www.keellssuper.com/grocery' },
    { name: 'Household', id: 9, url: 'https://www.keellssuper.com/household' }
  ],
  OUTLET_CODE: 'SCBI',
  BASE_URL: 'https://www.keellssuper.com',
  API_BASE: 'https://zebraliveback.keellssuper.com',
  DEFAULT_ITEMS_PER_PAGE: 60,
  MAX_PAGES_PER_CATEGORY: 20,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 mins
  RATE_LIMIT_MAX: 200 // max 200 requests per 15 mins
};
