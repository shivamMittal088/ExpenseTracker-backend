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

# Optional: Axiom logging
AXIOM_TOKEN=your-axiom-api-token
AXIOM_ORG_ID=your-org-id
AXIOM_DATASET=expense-tracker
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
| POST | `/api/expense` | Add new expense |
| GET | `/api/expenses` | Get expenses (with filters) |
| PATCH | `/api/expense/:id` | Update expense |
| DELETE | `/api/expense/:id` | Soft delete expense |

### Profile & Tiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile/view` | Get user profile |
| GET | `/api/profile/streak` | Get streak data |
| GET | `/api/profile/login-history` | Get login history |
| GET | `/api/profile/search-users` | Search other users by name/email |
| GET | `/api/profile/user/:userId` | Get minimal public profile |
| POST | `/api/profile/upload-avatar` | Upload profile avatar |
| GET | `/api/tiles` | Get category tiles |
| POST | `/api/tile` | Create tile |

## Authentication

The API uses JWT tokens stored in HTTP-only cookies:

- **Development:** `sameSite: "lax"`, `secure: false`
- **Production:** `sameSite: "none"`, `secure: true`

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
   - `AXIOM_TOKEN` (optional)
   - `AXIOM_ORG_ID` (optional)
   - `AXIOM_DATASET` (optional)

---

## TODO & Feature Status

### Planned
- [ ] Notification feature
- [ ] Streak tracking
- [ ] Badges support
- [ ] Multi-language support
- [ ] Private accounts
- [ ] Following feature
- [ ] PWA support
- [ ] Analytics dashboard
- [ ] Recurring expenses
- [ ] Budget limits & alerts
- [ ] Export expenses (CSV/PDF)

### Implemented
- [x] Add expense with validation and payment mode normalization
- [x] Fetch daily expenses by local date with timezone handling
- [x] Soft hide/restore expenses via `deleted` flag
- [x] Update expense fields (amount, category, notes, payment mode, currency, occurredAt)
- [x] Auth-protected routes using `userAuth` middleware
- [x] Single-device login enforcement
- [x] Session token management with expiry
- [x] User signup with password hashing (bcrypt)
- [x] User login with JWT HTTP-only cookies
- [x] Password update with session invalidation
- [x] User profile view and update (name, statusMessage, currency, preferences)
- [x] Login history tracking (IP, browser, OS, device)
- [x] Category tiles (CRUD) with built-in and user-created tiles
- [x] Axiom logging integration for production monitoring
- [x] Request/error logging with user context
