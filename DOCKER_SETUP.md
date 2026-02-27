# Docker setup for Expense Tracker

This setup runs the complete app in containers:
- `frontend` (Vite build served by Nginx)
- `backend` (Node + Express)
- `redis` (Redis 7 for rate limiting + session caching)
- MongoDB is hosted on **MongoDB Atlas** (cloud)

## 1) Prerequisites
- Install Docker Desktop
- Make sure Docker is running

## 2) Create docker env file
From the Backend directory:

```powershell
Copy-Item .env.docker.example .env
```

Fill in `MONGODB_URI` with your Atlas connection string. Axiom and Cloudinary values are optional.

## 3) Pull images
From project root:

```powershell
docker compose pull
```

## 4) Start all services

```powershell
docker compose up -d
```

## 5) Open the app
- Frontend: http://localhost:5173
- Backend health check route: http://localhost:5000/test

## 6) Stop services

```powershell
docker compose down
```

To remove DB volume too:

```powershell
docker compose down -v
```

---

## Images used

- `shivammittal088/expense-tracker:frontend-latest`
- `shivammittal088/expense-tracker:backend-latest`
- `redis:7-alpine`

---

## How this works (step-by-step)

1. `redis` starts first and persists cache data in Docker volume `redis_data`.
2. `backend` waits until Redis is healthy, then connects to Atlas via `MONGODB_URI` from `.env`.
3. `frontend` serves static React build via Nginx.
4. Nginx proxies `/api/*` requests to `http://backend:5000`, so your production-style relative API calls work without changing frontend code.
5. Browser talks only to `http://localhost:5173`; API requests are forwarded internally to backend container.

## Useful commands

```powershell
# See running containers
docker compose ps

# Tail logs
docker compose logs -f

# Pull one service image
docker compose pull backend
```
