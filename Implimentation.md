# Keells Supermarket Price Tracking API - Implementation Plan

## 1. Architecture & Requirements
- **Goal**: Track the entire catalog of Keells Supermarket, update prices once a day, and keep a historical record of price changes.
- **Scraper approach**: Node.js with `puppeteer-extra` + `stealth` plugin, focusing on **Network Request Interception** rather than DOM HTML parsing, since the DOM is heavily guarded and obfuscated.
- **Database**: MongoDB (Atlas Free Tier) - Perfect for storing flexible product documents and price history time-series data.
- **API**: Express.js REST API to serve data to your MERN stack application.
- **Containerization**: Docker & Docker Compose for local testing and consistent environments.

## 2. Infrastructure & Hosting
- **Database**: **MongoDB Atlas (M0 Free Tier)**. Offers 512MB storage which is sufficient for a large catalog and historical tracking.
- **API Hosting**: **Render.com** (Free Web Service)
- **Scraping Automation**: **GitHub Actions**. We can set up a scheduled Cron job (running once daily) to execute the Puppeteer scraper and push updates directly to MongoDB Atlas. GitHub Actions provides plenty of free execution time for a daily scraping job.

## 3. Database Schema Design (MongoDB)
* **Product Collection**: Stores current product details (`sku` [unique], `name`, `category`, `imageUrl`, `currentPrice`, `lastUpdated`).
* **PriceHistory Collection**: Stores historical data points (`sku`, `price`, `date`). *Optimization: We will only append a new record if the daily scraped price is different from the `currentPrice` to save storage.*

## 4. Alternative Scraping Approaches

### Option A: Network Reqeust Interception (Highly Recommended)
Since Keells' HTML DOM is heavily guarded or obfuscated (making standard CSS selectors fail), we won't parse the HTML at all. Modern sites load data dynamically.
*   **How it works:** We use Puppeteer to open the page, but instead of looking at the visual HTML, we tell Puppeteer to silently monitor the "Network" tab (just like hitting F12 in Chrome). When the Keells frontend requests the product data from its own backend API, we intercept that exact JSON response.
*   **Pros:** The data is usually a perfectly formatted JSON array containing prices, real SKUs, and exact item names, bypassing the need to decode wacky HTML classes.

### Option B: Using LLM APIs for Scraping
*   **Recommendation: Use only if network requests are strongly encrypted.**
*   **How it works:** We pass the raw text of the page to an LLM (like `gpt-4o-mini`) and ask it to return a clean JSON array of products.
*   **Verdict:** Making thousands of LLM API calls every single day to parse the pages will become slow and expensive quickly. Network interception is much better.

## 5. Step-by-Step Implementation

### Phase 1: Local Setup & Scraper Development
- [x] Initialize Node.js project.
- [x] Install `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `mongoose`, `dotenv`.
- [x] Develop the Network Interception scraper:
  - [x] Implement request jitter/delays and user-agent rotation.
  - [x] Listen for the background XHR/Fetch API responses that Keells uses to load products.
  - [x] Save the intercepted JSON product data directly.
- [x] Implement database upsert logic (Update `Product`, conditionally append to `PriceHistory`).

### Phase 2: API Development
- [x] Install `express`, `cors`.
- [x] Define Mongoose models (`Product`, `PriceHistory`).
- [x] Build REST Endpoints:
  - [x] `GET /api/products` (List products, with search/pagination).
  - [x] `GET /api/products/category/:category` (Filter by category).
  - [x] `GET /api/products/:sku/history` (Get price history).

### Phase 3: Dockerization (Local Testing)
- [x] Create a `Dockerfile` for the Node.js API.
- [x] Create a `docker-compose.yml` to spin up both the API and a local `mongo` database container.
- [x] Test the full stack locally (`docker-compose up`).

### Phase 4: Production Deployment
- [/] Provision MongoDB Atlas cluster and acquire connection URI.
- [/] Deploy Dockerized API to Render.com.
- [x] Configure GitHub Actions workflow (`.github/workflows/scrape.yml`) to run the scraper daily.
