# Expense Tracker Backend

A RESTful API backend for the Expense Tracker application built with Express.js, TypeScript, and MongoDB.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Language:** TypeScript
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT with HTTP-only cookies
- **Logging:** Axiom (optional)
- **Deployment:** Vercel

## Project Structure

```
Backend/
├── api/              # Vercel serverless entry point
├── config/           # Database & Axiom configuration
├── Middlewares/      # Auth & logging middleware
├── Models/           # Mongoose schemas
├── Routes/           # API route handlers
├── src/
│   ├── app.ts        # Express app setup
│   ├── server.ts     # Server entry point
│   └── types/        # TypeScript declarations
└── utils/            # Logger utilities
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
cd Backend
npm install
```

### Environment Variables

Create a `.env` file in the Backend folder:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/expense-tracker
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

# Optional: Axiom logging
AXIOM_TOKEN=your-axiom-api-token
AXIOM_ORG_ID=your-org-id
AXIOM_DATASET=expense-tracker

# Optional: Cloudinary (profile photos in production)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Running Locally

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Or with auto-reload (development)
npx nodemon dist/src/server.js
```

Server runs at `http://localhost:5000`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/update/password` | Update password |

### Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/expense/add` | Add new expense |
| GET | `/api/expense/:date` | Get expenses for a local date (YYYY-MM-DD) |
| GET | `/api/expenses/paged` | Cursor-paginated expenses |
| PATCH | `/api/expense/:expenseId` | Update expense |
| GET | `/api/expenses/range` | Get expenses in a date range |
| GET | `/api/expenses/recurring` | Recurring expense insights |
| GET | `/api/expenses/payment-breakdown` | Payment mode breakdown |
| GET | `/api/expenses/spending-trends` | Spending trends data |
| GET | `/api/expenses/heatmap` | Heatmap data by year |

### Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile/view` | Get user profile |
| PATCH | `/api/profile/update` | Update profile (name, statusMessage) |
| PATCH | `/api/profile/privacy` | Update privacy (`isPublic`) |
| GET | `/api/profile/user/:userId` | Get public profile summary |
| POST | `/api/profile/upload-avatar` | Upload profile avatar |
| GET | `/api/profile/recent-searches` | Recent searches list |
| POST | `/api/profile/recent-searches` | Add to recent searches |
| DELETE | `/api/profile/recent-searches` | Clear recent searches |
| DELETE | `/api/profile/recent-searches/:userId` | Remove one recent search |
| GET | `/api/profile/search-users` | Search users by name/email/status |

### Follow

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile/follow-status/:userId` | Follow status for a user |
| POST | `/api/profile/follow/:userId` | Send follow request |
| DELETE | `/api/profile/follow/:userId` | Cancel/unfollow |
| GET | `/api/profile/follow-requests` | Pending follow requests |
| POST | `/api/profile/follow-requests/:requestId/accept` | Accept follow request |
| DELETE | `/api/profile/follow-requests/:requestId` | Decline follow request |
| GET | `/api/profile/all-followers` | Cursor-paginated followers |
| GET | `/api/profile/all-following` | Cursor-paginated following |

### Tiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tiles` | Get category tiles |
| POST | `/api/tiles/add` | Create tile |
| DELETE | `/api/tiles/remove/:id` | Delete tile |
| POST | `/api/seed/tiles` | Seed default tiles |

## Authentication

The API uses JWT tokens stored in HTTP-only cookies:

- **Development:** `sameSite: "lax"`, `secure: false`
- **Production:** `sameSite: "lax"`, `secure: true`

This allows cross-origin requests from the frontend.

## Axiom Logging

Logs are sent to Axiom in production for monitoring:
- Request method, path, status, duration
- User ID, IP address, user agent
- Error tracking

Set the `AXIOM_*` environment variables to enable. Falls back to console in development.

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables:
   - `MONGODB_URI`
   - `NODE_ENV=production`
   - `FRONTEND_ORIGIN`
   - `AXIOM_TOKEN` (optional)
   - `AXIOM_ORG_ID` (optional)
   - `AXIOM_DATASET` (optional)
   - `CLOUDINARY_CLOUD_NAME` (optional)
   - `CLOUDINARY_API_KEY` (optional)
   - `CLOUDINARY_API_SECRET` (optional)

---

## TODO & Feature Status

### Planned
- [ ] Notification feature
- [ ] Streak tracking
- [ ] Badges support
- [ ] Story addition with gallery support
- [ ] PWA support
- [ ] Export expenses (CSV/PDF)

### Implemented
- [x] Add expense with validation and payment mode normalization
- [x] Fetch daily expenses by local date with timezone handling
- [x] Cursor pagination for expenses and followers
- [x] Recurring expense insights and spending analytics
- [x] Auth-protected routes using `userAuth` middleware
- [x] Session token management with 1-day expiry
- [x] User signup/login with JWT HTTP-only cookies
- [x] Password update with session invalidation
- [x] User profile view/update and privacy toggle (`isPublic`)
- [x] Profile avatar upload (Cloudinary)
- [x] Category tiles (built-in + user-created)
- [x] Follow system with requests and cursor-paginated lists
- [x] Recent searches and user search
- [x] Axiom logging integration for production monitoring
- [x] Request/error logging with user context
- [x] Lazy loading at route and component level to improve Lighthouse score
