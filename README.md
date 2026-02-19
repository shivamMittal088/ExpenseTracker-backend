<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../frontend/public/logo.svg">
  <source media="(prefers-color-scheme: light)" srcset="../frontend/public/logo.svg">
  <img src="../frontend/public/logo.svg" alt="Expense Tracker" width="220"/>
</picture>

### Fast, secure, social-ready Expense Tracker backend

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

</div>

---

## 💡 What is this backend?

This backend powers the Expense Tracker app with:

- secure JWT cookie-based auth
- expense CRUD + analytics endpoints
- follow system + notifications flow
- profile/avatar management
- category tile customization
- export xcl report
- Lazy loading for optimisation
- Redux State library Management
- Soft delete Feature 

It is optimized for mobile-first frontend usage with lazy-loaded UI and API patterns.

---

## 📸 Screenshots

### 🏠 Home Experience

<p align="center">
  <img src="./docs/images/mobile-home.png" width="200" alt="Mobile Home"/>
  &nbsp;
  <img src="./docs/images/mobile-home-2.png" width="200" alt="Mobile Home 2"/>
  &nbsp;
  <img src="./docs/images/mobile-home-3.png" width="200" alt="Mobile Home 3"/>
  &nbsp;
  <img src="./docs/images/mobile-home-4.png" width="200" alt="Mobile Home 4"/>
</p>

---

### 📈 Analytics + 💸 Transactions

<p align="center">
  <img src="./docs/images/mobile-analytics.png" width="240" alt="Mobile Analytics"/>
  &nbsp;&nbsp;
  <img src="./docs/images/mobile-analytics-2.png" width="240" alt="Mobile Analytics 2"/>
  &nbsp;&nbsp;
  <img src="./docs/images/mobile-transactions.png" width="240" alt="Mobile Transactions"/>
</p>

---

### 👤 Profiles + 📤 Export

<p align="center">
  <img src="./docs/images/mobile-profile.png" width="220" alt="Mobile Profile"/>
  &nbsp;&nbsp;
  <img src="./docs/images/mobile-public-profile.png" width="220" alt="Mobile Public Profile"/>
  &nbsp;&nbsp;
  <img src="./docs/images/mobile-public-profile-2.png" width="220" alt="Mobile Public Profile 2"/>
  &nbsp;&nbsp;
  <img src="./docs/images/mobile-export.png" width="220" alt="Mobile Export"/>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 Auth + Session | Signup/login/logout, password update, JWT in HTTP-only cookies |
| 💳 Expense APIs | Add, update, date-based fetch, range fetch, pagination |
| 📊 Analytics APIs | Recurring insights, payment breakdown, spending trends, heatmap |
| 👥 Social Layer | Follow requests, accept/decline, followers/following pagination |
| 👤 Profile | Name/status updates, avatar upload, privacy controls, public profile |
| 🔎 Discovery | User search and recent searches |
| 🧩 Tiles | Built-in + custom category tiles, seed endpoint |
| 📈 Monitoring | Structured request/error logging + optional Axiom sink |

---

## 🛠️ Tech Stack

| Layer | Technology |
|:------|:-----------|
| Runtime | Node.js |
| Framework | Express 5 |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Auth | JWT + HTTP-only cookies |
| Uploads | Cloudinary (optional in prod) |
| Logging | Axiom (optional) |
| Deploy | Vercel |

---

## 🚀 Getting Started

### 1) Install

```bash
cd Backend
npm install
```

### 2) Configure environment

Create `.env` in `Backend/`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/expense-tracker
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

# Optional: Axiom logging
AXIOM_TOKEN=your-axiom-api-token
AXIOM_ORG_ID=your-org-id
AXIOM_DATASET=expense-tracker

# Optional: Cloudinary avatar uploads
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3) Run

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Dev (after build changes)
npx nodemon dist/src/server.js
```

Server default: `http://localhost:5000`

---

## 🔌 API Highlights

### Authentication

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/update/password`

### Expenses

- `POST /api/expense/add`
- `GET /api/expense/:date`
- `GET /api/expenses/paged`
- `PATCH /api/expense/:expenseId`
- `GET /api/expenses/range`
- `GET /api/expenses/recurring`
- `GET /api/expenses/payment-breakdown`
- `GET /api/expenses/spending-trends`
- `GET /api/expenses/heatmap`
- `GET /api/expenses/export/excel`

### Profile + Follow + Search

- `GET /api/profile/view`
- `PATCH /api/profile/update`
- `PATCH /api/profile/privacy`
- `POST /api/profile/upload-avatar`
- `GET /api/profile/search-users`
- `GET /api/profile/follow-requests`
- `POST /api/profile/follow-requests/:requestId/accept`
- `DELETE /api/profile/follow-requests/:requestId`

---

## 📋 TODOs

- [ ] CSV/PDF export parity with Excel
- [ ] Streaks and badges
- [ ] Story-like activity updates
- [ ] PWA support
- [ ] Additional test coverage
- [ ] More observability dashboards
