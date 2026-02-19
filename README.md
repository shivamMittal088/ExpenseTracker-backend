<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../frontend/public/logo.svg">
  <source media="(prefers-color-scheme: light)" srcset="../frontend/public/logo.svg">
  <img src="../frontend/public/logo.svg" alt="Expense Tracker" width="320"/>
</picture>

### Track expenses smarter. Analyze trends faster. Scale social features securely.

[![Live Demo](https://img.shields.io/badge/Live-Demo-22C55E?style=for-the-badge&logo=vercel&logoColor=white)](https://www.track-expense.com/)

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-111111?logo=express&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![JWT](https://img.shields.io/badge/Auth-JWT-EF4444?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Media-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

</div>

---

## 🌐 Live Deployment

- **Project URL:** [https://www.track-expense.com/](https://www.track-expense.com/)

---

## 💡 What is Expense Tracker Backend?

Expense Tracker Backend is the API engine behind a mobile-first expense management app. It can be used to log expenses and give you a clear view of your financial situation. It handles authentication, financial data processing, social interactions, file uploads, analytics pipelines, and export workflows.

Built for production-style usage with clean route structure, secure auth flows, and scalable pagination patterns.

---

## 🎯 Use of this Project

This project is useful when you want to:

- build a full-stack expense tracker with secure session handling
- implement social features like follow requests and public profiles
- support analytics-driven financial insights (heatmaps, trends, recurring patterns)
- handle profile photo uploads securely with Multer + Cloudinary
- implement scalable feed/list APIs using cursor pagination
- export filtered expense data to Excel for reporting/records

---

## 📸 Screenshots

### 🏠 Home → Quick Actions

<p align="center">
  <img src="./docs/images/mobile-home.png" width="230" alt="Mobile Home"/>
  &nbsp;&nbsp;&nbsp;
  <img src="./docs/images/mobile-home-2.png" width="230" alt="Mobile Home 2"/>
</p>
<p align="center">
  <img src="./docs/images/mobile-home-3.png" width="230" alt="Mobile Home 3"/>
  &nbsp;&nbsp;&nbsp;
  <img src="./docs/images/mobile-home-4.png" width="230" alt="Mobile Home 4"/>
</p>

> **Left/Right:** Streamlined home experience with quick add and activity-focused layout.

---

### 📈 Analytics → 💸 Transactions

<p align="center">
  <img src="./docs/images/mobile-analytics.png" width="240" alt="Mobile Analytics"/>
  &nbsp;&nbsp;&nbsp;
  <img src="./docs/images/mobile-analytics-2.png" width="240" alt="Mobile Analytics 2"/>
</p>
<p align="center">
  <img src="./docs/images/mobile-transactions.png" width="240" alt="Mobile Transactions"/>
</p>

> Advanced insights with trend visualizations and paginated transaction views.

---

### 👤 Profile → 📤 Export

<p align="center">
  <img src="./docs/images/mobile-profile.png" width="220" alt="Mobile Profile"/>
  &nbsp;&nbsp;&nbsp;
  <img src="./docs/images/mobile-public-profile.png" width="220" alt="Mobile Public Profile"/>
</p>
<p align="center">
  <img src="./docs/images/mobile-public-profile-2.png" width="220" alt="Mobile Public Profile 2"/>
  &nbsp;&nbsp;&nbsp;
  <img src="./docs/images/mobile-export.png" width="220" alt="Mobile Export"/>
</p>

> Profile customization, public visibility controls, and date-range export workflow.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **Auth + Sessions** | JWT cookie auth, signup/login/logout, password update, session safety |
| 📊 **Analytics APIs** | Recurring payments, payment breakdown, spending trends, heatmap insights |
| 📄 **Export to Excel** | Date-range-based Excel export for receipt/report workflows |
| 👥 **Social Graph** | Follow requests, accept/decline flow, followers/following APIs |
| 🧭 **Pagination Strategy** | Cursor-based APIs for scalable feeds + offset-style day feed support |
| 🖼️ **Media Uploads** | Multer validation + Cloudinary storage for profile photos |
| ⚡ **Performance-Oriented** | Supports lazy-loading architecture and reduced API churn patterns |
| 📈 **Observability** | Structured logger + optional Axiom integration |

---

## 🧠 Engineering Highlights

- Implemented session-based authentication with centralized logging for API monitoring and error tracking.
- Built scalable follower APIs using cursor-based pagination with infinite scroll and private account handling.
- Optimized frontend performance enablement using route/component lazy loading strategies and modal prefetching support.
- Enhanced efficiency by reducing redundant API calls and supporting debounced request patterns.
- Configured secure profile photo uploads using Multer with Cloudinary storage.
- Built data-driven APIs for recurring payments, expense history, advanced filtering, trend analysis, and interactive heatmap insights.
- Implemented Excel export support with date-range filtering for receipt/report downloads.

---

## 🛠️ Tech Stack

| Layer | Technology |
|:------|:-----------|
| Runtime | Node.js |
| Framework | Express 5 |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Authentication | JWT + HTTP-only cookies |
| File Upload | Multer |
| Media Storage | Cloudinary |
| Logging | Axiom (optional) |
| Deployment | Vercel |

---

## 🚀 Getting Started

### 1) Install

```bash
cd Backend
npm install
```

### 2) Configure environment

Create a `.env` file in `Backend/`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/expense-tracker
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

# Optional: Axiom logging
AXIOM_TOKEN=your-axiom-api-token
AXIOM_ORG_ID=your-org-id
AXIOM_DATASET=expense-tracker

# Optional: Cloudinary uploads
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

# Dev mode (after build output exists)
npx nodemon dist/src/server.js
```

Server default: `http://localhost:5000`

---

## 🔌 API Highlights

### Authentication

<table align="center" border="1" cellpadding="8" cellspacing="0" width="100%">
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>POST</code></td><td><code>/api/auth/signup</code></td><td>Register a new user</td></tr>
    <tr><td><code>POST</code></td><td><code>/api/auth/login</code></td><td>Authenticate user session</td></tr>
    <tr><td><code>POST</code></td><td><code>/api/auth/logout</code></td><td>End active session</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/auth/me</code></td><td>Get currently logged-in user</td></tr>
    <tr><td><code>PATCH</code></td><td><code>/api/auth/update/password</code></td><td>Change account password</td></tr>
  </tbody>
</table>

### Expenses

<table align="center" border="1" cellpadding="8" cellspacing="0" width="100%">
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>POST</code></td><td><code>/api/expense/add</code></td><td>Add a new expense</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/expense/:date</code></td><td>Get expenses for a local date</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/expenses/paged</code></td><td>Cursor-paginated expense feed</td></tr>
    <tr><td><code>PATCH</code></td><td><code>/api/expense/:expenseId</code></td><td>Update an expense</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/expenses/range</code></td><td>Filter expenses by date range</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/expenses/recurring</code></td><td>Recurring payment insights</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/expenses/payment-breakdown</code></td><td>Payment mode analytics</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/expenses/spending-trends</code></td><td>Trend analytics over time</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/expenses/heatmap</code></td><td>Heatmap-ready spending data</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/expenses/export/excel</code></td><td>Export filtered expenses to Excel</td></tr>
  </tbody>
</table>

### Profile + Follow + Search

<table align="center" border="1" cellpadding="8" cellspacing="0" width="100%">
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>GET</code></td><td><code>/api/profile/view</code></td><td>Get current profile data</td></tr>
    <tr><td><code>PATCH</code></td><td><code>/api/profile/update</code></td><td>Update name/status</td></tr>
    <tr><td><code>PATCH</code></td><td><code>/api/profile/privacy</code></td><td>Update profile privacy</td></tr>
    <tr><td><code>POST</code></td><td><code>/api/profile/upload-avatar</code></td><td>Upload profile photo</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/profile/search-users</code></td><td>Search users</td></tr>
    <tr><td><code>GET</code></td><td><code>/api/profile/follow-requests</code></td><td>Fetch pending requests</td></tr>
    <tr><td><code>POST</code></td><td><code>/api/profile/follow-requests/:requestId/accept</code></td><td>Accept follow request</td></tr>
    <tr><td><code>DELETE</code></td><td><code>/api/profile/follow-requests/:requestId</code></td><td>Decline follow request</td></tr>
  </tbody>
</table>

---

## 🤝 Contributing

Contributions are welcome:

1. 🐛 Report bugs with clear reproduction steps
2. 💡 Propose improvements via issues/discussions
3. 🔧 Submit PRs with focused, tested changes

---

## 📋 TODOs

- [ ] Unit testing coverage for critical APIs
- [ ] Streaks and badges support
- [ ] Story-like user activity updates
- [ ] PWA support
- [ ] Additional performance monitoring dashboards
