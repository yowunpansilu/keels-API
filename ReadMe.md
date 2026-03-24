# Keells Price Tracker API

A robust, automated price-tracking system for Keells Supermarket. This API scrapes product data and price history from the Keells website and provides a clean REST interface for developers and AI agents.

## 🚀 How it Works
The system uses a **Hybrid Scraping Strategy**:
1. **Authenticated Session**: Uses Puppeteer to simulate a real browser visit to `keellssuper.com` and automatically captures the `usersessionid` required for API access.
2. **Direct API Interception**: Uses the captured credentials to fetch data directly from the Keells internal back-end (`zebraliveback.keellssuper.com`), bypassing standard web blocks.
3. **Data Persistence**: Products and price history are stored in a MongoDB database.
4. **Monitoring**: A status endpoint provides real-time progress of the scraping tasks.

---

## 🛠 Developer & AI Agent Guide

### 1. Filtering Products
You can filter products by their department using either a numeric ID or a human-readable name.

#### Filter by Department ID
Use the `departmentId` query parameter.
```bash
GET /api/products?departmentId=16
```

#### Filter by Category Name (Recommended for AI)
Use the `category` query parameter for a partial, case-insensitive match on the department name.
```bash
GET /api/products?category=vegetables
```

#### Common Department IDs:
| Department | ID |
| :--- | :--- |
| Vegetables | 16 |
| Fruits | 6 |
| Meat | 12 |
| Seafood | 4 |
| Grocery | 7 |
| Household | 9 |

---

### 2. Requesting Product Details
To get full details or tracking history for a specific item, use the product's `sku` (itemCode).

#### Get Current Details
```bash
GET /api/products/:sku
```

#### Get Price History
```bash
GET /api/products/:sku/history
```

---

### 3. API Responses
All endpoints return standard JSON.

#### Example Product Response:
```json
{
  "sku": "916002",
  "name": "Ambarella",
  "currentPrice": 290,
  "imageUrl": "https://...",
  "isAvailable": true,
  "departmentName": "Vegetables",
  "lastUpdated": "2026-03-24T..."
}
```

#### Example Status Response:
```json
{
  "status": "success",
  "totalProducts": 336,
  "byDepartment": [
    { "_id": "Vegetables", "id": 16, "count": 190 },
    { "_id": "Fruits", "id": 6, "count": 66 }
  ]
}
```

---

## 📦 Running Locally
1. Ensure you have Docker and Docker Compose installed.
2. Clone the repo and run:
   ```bash
   docker-compose up -d --build
   ```
3. Trigger the initial scrape (requires API Key):
   ```bash
   curl -X POST http://localhost:3000/api/scraper/run -H "X-API-KEY: your_secure_api_key_here"
   ```

## 🔒 Security
The API includes several production-grade security measures:
- **Helmet**: Adds secure HTTP headers to prevent common vulnerabilities.
- **Rate Limiting**: Limits requests per IP. You can adjust this in the `.env` file:
  - `RATE_LIMIT_WINDOW`: The window in milliseconds (default 900000 = 15 mins).
  - `RATE_LIMIT_MAX`: The maximum number of requests (default 100).
- **API Key Protection**: Sensitive operations like building the scraper's session or manual runs require the `X-API-KEY` header.
- **CORS**: Configured to restrict cross-origin access (can be refined in `server.js`).

## 🔍 Tools
- **API**: `http://localhost:3000`
- **Mongo Express (DB Viewer)**: `http://localhost:8081`
