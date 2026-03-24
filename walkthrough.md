# Keells Price Tracker API - Walkthrough

## Summary
I have successfully implemented a full price-tracking system for Keells Supermarket. This system avoids expensive and fragile DOM scraping by directly interacting with Keells' internal REST API.

---

## 🏗️ Architecture
- **Scraper**: A lightweight Node.js script using `axios` to fetch data from `zebraliveback.keellssuper.com`.
- **Database**: MongoDB (with local Docker setup and Atlas support).
- **API**: Express.js server providing endpoints for product search, categories, and price history.
- **Automation**: GitHub Actions workflow for daily price updates.

---

## 📂 Key Files
- [scraper.js](file:///Users/yowunpansilu/Documents/GitHub/keels%20API/scraper.js): The brain that fetches and saves data.
- [server.js](file:///Users/yowunpansilu/Documents/GitHub/keels%20API/server.js): The API that serves the data.
- [models/Product.js](file:///Users/yowunpansilu/Documents/GitHub/keels%20API/models/Product.js): Product schema.
- [models/PriceHistory.js](file:///Users/yowunpansilu/Documents/GitHub/keels%20API/models/PriceHistory.js): Price change historical data.

---

## 🚀 How to Run Locally

### 1. Setup Environment
Rename [.env.example](file:///Users/yowunpansilu/Documents/GitHub/keels%20API/.env.example) to `.env` and provide your MongoDB URI:
```bash
cp .env.example .env
```

### 2. Run with Docker
This will spin up the API and a local MongoDB instance:
```bash
docker-compose up --build
```

### 3. Run Manually
```bash
npm install
node scraper.js # to populate data
npm start       # to run the API
```

---

## 📈 API Endpoints
- `GET /api/products`: Paginated list with search.
- `GET /api/products/:sku`: Detailed view.
- `GET /api/products/:sku/history`: Price history.
- `POST /api/scraper/run`: Trigger scrape manually.

---

## ✅ Progress Check
All tasks from the original plan are complete. The system is ready to be deployed to your preferred hosting (Render/Render/Fly.io) and automated via GitHub Actions.
