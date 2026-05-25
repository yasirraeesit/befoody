# Befoody — Project Plan (Detailed, Phased)

This plan is meant to be followed in order. Each phase includes:
- Objective (what success looks like)
- Tasks (what to do)
- Commands (what to run)
- Exit criteria (how you confirm completion)

---

## Phase 0 — Prerequisites

### Objective
The machine can run Node + MongoDB, and required ports are available.

### Tasks
- Install Node.js (LTS recommended).
- Ensure MongoDB server is running locally (Compass is a client; the server must be running too).
- Ensure ports are free:
  - Backend: `5000`
  - Frontend: `5173`

### Commands
- `node -v`
- `npm -v`

### Exit criteria
- Node and npm versions print correctly.
- MongoDB is reachable at `mongodb://127.0.0.1:27017`.

---

## Phase 1 — Install & Configure

### Objective
Both apps install cleanly and can read their environment variables.

### Tasks
1) Install backend dependencies
2) Install frontend dependencies
3) Configure environment variables
4) Confirm secrets are not committed

### Commands
- Backend:
  - `cd backend`
  - `npm install`
- Frontend:
  - `cd ../frontend`
  - `npm install`

### Environment Variables

#### Backend (`backend/.env`)
- `PORT=5000`
- `MONGO_URI=mongodb://127.0.0.1:27017/befoody`
- `JWT_SECRET=<long-random-string>`
- `FRONTEND_URL=http://localhost:5173`

#### Frontend (`frontend/.env`)
- `VITE_API_BASE_URL=http://localhost:5000`

### Exit criteria
- `backend/node_modules/` exists.
- `frontend/node_modules/` exists.

---

## Phase 2 — Database Bootstrap & Seed Data

### Objective
The local MongoDB database (`befoody`) contains demo users, restaurants, and food items.

### Notes
- Restaurant seeding requires an admin user (used as `ownerId`).

### Tasks
1) Create admin user (if missing)
2) Seed restaurants and food items
3) (Optional) Seed extra users/riders
4) Inspect DB counts and sample records

### Commands (run from `backend/`)
- Create admin:
  - `node createAdmin.js`
- Seed restaurants + food items:
  - `node seedData.js`
- Optional extra users/riders:
  - `node seedUsersAndRiders.js`
- Inspect DB:
  - `npm run db:inspect`

### Expected demo credentials
- Admin: `admin@befoody.com` / `admin123`
- Restaurant: `owner@restaurant.com` / `password123`
- Rider: `alex.rider@befoody.com` / `password123`
- Customer: `john.doe@gmail.com` / `password123`

### Exit criteria
- `npm run db:inspect` shows non-zero counts for:
  - Users
  - Restaurants
  - Food items

---

## Phase 3 — Run Locally & Validate Core Flows

### Objective
The app runs locally end-to-end (frontend ↔ backend ↔ MongoDB).

### Tasks
1) Start backend
2) Start frontend
3) Verify role login + redirects
4) Verify browsing and ordering UI does not crash

### Commands
- Backend (from `backend/`):
  - `npm run dev`
- Frontend (from `frontend/`):
  - `npm run dev`

### Validation checklist
- Home loads and shows restaurants.
- Login works for all demo roles.
- Role redirects:
  - Admin → `/admin`
  - Restaurant → `/restaurant-dashboard`
  - Rider → `/rider-dashboard`
- Restaurant detail page loads and shows menu items.
- Cart and checkout pages render without errors.

### Exit criteria
- No blocking console errors during normal navigation.
- Core browse → detail → cart → checkout flow works.

---

## Phase 4 — Performance Work (Home Page)

### Objective
Home page feels smooth (no noticeable lag), and improvements are measurable.

### Step 4.1 — Baseline (measure before changing more)
Capture and record:
- Chrome Performance trace: initial load + first scroll
- React DevTools Profiler: commits and slow components for Home route
- Network: API calls count + payload sizes on initial load

### Step 4.2 — Fixes (highest impact first)

#### A) Network/data
- Avoid “fetch everything then filter on the client”.
- Request only what Home needs (e.g. top 6 restaurants, 6 random dishes).
- Cache by category/query to avoid refetch loops.

#### B) Rendering
- Memoize derived arrays (e.g. `featuredRestaurants`).
- Stabilize callbacks passed to children.
- Split/lazy-load below-the-fold sections so initial render is smaller.
- If lists grow large, add list virtualization.

#### C) Assets/visuals
- Use lazy-loading for below-the-fold images.
- Reduce expensive effects:
  - `backdrop-blur` overlays are expensive
  - very large `blur-*` glows are expensive
  - respect `prefers-reduced-motion`

### Step 4.3 — Re-measure and document
Repeat the same baseline measurements and write a short summary under “Performance Notes”.

### Exit criteria
- Noticeably smoother scroll on Home (no major jank).
- Reduced API payload and/or API call count on first load.
- Profiler shows fewer or cheaper commits on Home route.

---

## Phase 5 — QA & Hardening

### Objective
The app handles errors and edge cases without crashing.

### Tasks
- Auth
  - login/logout
  - protected routes
  - invalid credentials messaging
- Data states
  - empty restaurants/foods
  - backend down (friendly errors)
- Role checks
  - restaurant-only actions blocked for customers
  - admin-only actions blocked for others
- Mobile sanity
  - Home, restaurant detail, dashboards at common breakpoints

### Exit criteria
- No crash loops or blank pages in common edge cases.

---

## Phase 6 — Deployment (Optional)

### Objective
Build and prepare for production hosting.

### Tasks
- Frontend production build
- Backend hosting plan (Node server + Mongo)
- Production environment variables + CORS alignment

### Commands
- Frontend (from `frontend/`):
  - `npm run build`
  - `npm run preview`

### Exit criteria
- Production build completes.
- Backend CORS allows the production frontend URL.

---

## Current Status (As of 2026-05-25)

### Setup
- Backend and frontend `.env` files exist locally and are git-ignored.

### DB tooling
- Added DB inspector:
  - `backend/inspectDb.js`
  - `backend` → `npm run db:inspect`

### Performance changes already implemented
- Backend endpoints support limiting/sampling:
  - Restaurants: `GET /api/restaurants?limit=6&cuisine=...`
  - Food items: `GET /api/fooditems?limit=6&random=1`
- Home page:
  - Fetches limited restaurant results and caches per category
  - Lazy-loads and defers below-the-fold sections
  - Reduces expensive hero blur/animation work

---

## Performance Notes (Fill in after profiling)

### Baseline
- Date:
- Device/browser:
- Home initial load:
- Notable slow components:

### After changes
- Date:
- What changed:
- Measurable improvements:
