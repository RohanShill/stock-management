# Hardware Store Stock Management & Inventory Android App

A production-oriented, offline-first mobile and cloud application built for hardware and building-materials stores in India (default currency ₹ INR, metric/imperial conversions, GST breakdown, pipe length cutting calculators, and English/Hindi language options).

---

## 1. Project Overview

Hardware stores have unique inventory requirements:
- Selling pipes, wires, and cables by variable length (e.g. 7.5 metres cut from standard 3-metre pipes).
- Handling count, weight (kg/g), volume (litres/ml), and box packaging units.
- Uninterrupted daily billing and inventory management even when internet connectivity is intermittent or completely down.
- Automatic, idempotent background synchronization with MongoDB Atlas when online.

---

## 2. Monorepo Structure

```
hardware-store-manager/
├── apps/
│   └── mobile/              # React Native + Expo Android app
│       ├── app/             # Expo Router screens (tabs, auth, modals)
│       ├── src/
│       │   ├── database/    # SQLite tables, WAL mode, repositories
│       │   ├── sync/        # Dedicated Offline Sync Engine
│       │   ├── store/       # Zustand application state
│       │   └── i18n/        # English & Hindi translation dictionaries
│       ├── eas.json         # EAS Android APK & AAB build profiles
│       └── app.json         # Expo Android package & configuration
├── services/
│   └── api/                 # Express.js + Mongoose (MongoDB Atlas) backend
│       ├── src/
│       │   ├── models/      # Mongoose schemas & indexes
│       │   ├── routes/      # REST API v1 endpoints
│       │   └── middleware/  # JWT auth & role validation
│       └── .env.example
├── packages/
│   └── shared/              # Shared types, Zod schemas, unit conversion & pipe math
│       └── src/
│           ├── types/       # Units, Pipe math, Money (Paise), Models, Sync
│           ├── schemas/     # Zod validation schemas
│           └── utils/       # SKU generator, calculation algorithms
├── docs/                    # Schema, Sync Engine, & API Reference documentation
├── package.json             # Root npm workspace
└── README.md
```

---

## 3. Technology Stack & Versions

- **Mobile Client:** React Native 0.76.6, Expo SDK 52, Expo Router v4, `expo-sqlite` v15, React Native Paper v5, Zustand v5, TanStack Query v5.
- **Backend Service:** Node.js v24+, Express 4.21, Mongoose 8.9 (MongoDB Atlas), Zod 3.24, Helmet 8.0, JWT, bcryptjs.
- **Shared Domain:** TypeScript 5.7 strict mode, Vitest 3.2.

---

## 4. Prerequisites

1. **Node.js:** v18+ (tested on Node v24.19)
2. **npm:** v10+ (tested on npm 11.13)
3. **MongoDB:** MongoDB Atlas cluster URI or local MongoDB instance (`mongodb://127.0.0.1:27017/hardware_store_db`)
4. **Android Development (Optional for device builds):** Android Studio / Expo Go app on an Android phone.

---

## 5. Quick Start Instructions

### Step 1: Install Dependencies & Build Shared Core
```bash
npm install
npm run build:shared
```

### Step 2: Run All Automated Tests
```bash
npm test
```
*Verifies unit conversions, critical pipe length cutting calculations (120m - 7.5m = 112.5m), monetary paise calculations, API endpoints, and mobile SQLite schemas.*

### Step 3: Configure & Start Backend API
```bash
cd services/api
copy .env.example .env
npm run dev
```
The API starts at `http://localhost:4000/api/v1` with a health check at `http://localhost:4000/health`.

### Step 4: Start Mobile App
```bash
cd apps/mobile
npm start
```
Scan the QR code with the **Expo Go** Android app or run `npm run android` on an Android emulator.

---

## 6. Offline-First Architecture & Data Flow

```
+--------------------------------------------------------+
|                     Android Device                     |
|                                                        |
|  [ User UI: POS Billing, Purchases, Adjustments ]      |
|                         |                              |
|                         v (Atomic SQLite Transaction)  |
|            +--------------------------+                |
|            |  Local SQLite Database   |                |
|            |  - Products & Variants   |                |
|            |  - Sales & Line Items    |                |
|            |  - Stock Movements       |                |
|            |  - Outbox (sync_queue)   |                |
|            +--------------------------+                |
|                         |                              |
|                         v                              |
|            +--------------------------+                |
|            |   Offline Sync Engine    |                |
|            +--------------------------+                |
+-------------------------|------------------------------+
                          | (When Online)
                          | Push: Outbox batches
                          | Pull: Incremental cursors
                          v
+--------------------------------------------------------+
|                   Cloud API Service                    |
|                                                        |
|  [ Express.js REST API v1 + Idempotency Validator ]    |
|                         |                              |
|                         v                              |
|             [ MongoDB Atlas Database ]                 |
+--------------------------------------------------------+
```

### Local Database Persistence (SQLite)
- All sales, purchases, product updates, and inventory changes write directly to SQLite.
- Operations survive app restarts, crashes, and network loss.
- Foreign keys and WAL (Write-Ahead Logging) are active for transactional safety.

### Sync Outbox & Idempotency
- Every local change enqueues an operation into `sync_queue` with a client UUID.
- The backend verifies operation IDs: retried requests acknowledge without duplicating sales or deducting stock twice.
- Incremental pulls use a high-water mark timestamp (`server_cursor`) so the app never redownloads unchanged catalogue data.

---

## 7. Pipe Length Stock & Pipe Cutting Logic

Hardware shops buy whole pipes (e.g. 3m) but sell custom partial lengths (e.g. 7.5m).

### Method A: Aggregate Length Tracking
- Tracks total stock in canonical millimetres (120,000 mm = 40 pipes × 3m).
- Selling 7.5 metres (7,500 mm) leaves 112.5 metres (112,500 mm).
- Avoids deducting whole pipes when fractional lengths are sold.

### Method B: Individual Pieces & Remnants
- Tracks physical segments with `originalLengthMm`, `currentLengthMm`, and `status`.
- **Best-Fit Algorithm:** When cutting 800 mm, the engine first searches for an existing remnant that is ≥ 800 mm (to avoid cutting into a whole pipe), cuts the requested amount, and leaves the remaining usable length available for subsequent customers.

---

## 8. Money, Tax, & Rounding Precision

- Financial calculations use integer **Paise** (₹ 1 = 100 paise) to eliminate JavaScript floating-point rounding errors.
- Line items compute taxable amounts, GST (with 50/50 CGST and SGST splits), and discounts.
- Invoice totals include automatic nearest-rupee round-off adjustments.

---

## 9. Testing on Physical Android Phones

1. Ensure the phone and computer are on the same Wi-Fi network.
2. In the mobile app's **More → Settings**, set the API URL to your computer's local IP (e.g. `http://192.168.1.15:4000`).
3. Run `npx expo start` in `apps/mobile` and scan the QR code using Expo Go.

---

## 10. Building Standalone Android APK & AAB

Using Expo Application Services (EAS):
```bash
cd apps/mobile

# Build testable standalone APK for Android phones:
npx eas-cli build -p android --profile preview

# Build production Android App Bundle (AAB) for Google Play:
npx eas-cli build -p android --profile production
```

---

## 11. Multi-Device Offline Consistency Limitations

When several devices operate offline simultaneously:
- **Stock Contention:** If Device A and Device B both sell the last remaining pipe while disconnected, both sales will be completed locally to keep the shop running.
- **Cloud Reconciliation:** When connecting to the cloud, the backend audits both transactions and raises a **Stock Reconciliation Flag** for the store owner. Sales history is never deleted or hidden.

---

## 12. Verification & Test Summary

All 33 automated tests passed:
- **`packages/shared`:** 13/13 tests passed (unit conversions, critical pipe calculations, monetary precision, GST splits, invoice round-off, SKU generation).
- **`services/api`:** 5/5 tests passed (health check, unauthorized request blocking, JWT authentication).
- **`apps/mobile`:** 15/15 tests passed (SQLite table schemas, English/Hindi dictionary lookup, Zustand state mutations, Demo isolation & security boundaries, deterministic sample data reset).

---

## 13. Client Evaluation Demo Build

For safe demonstration and client testing without exposing production systems or live client records:
- **Separate Demo App Name:** `Hardware Store (Demo)`
- **Separate Android Application ID:** `com.hardwarestore.manager.demo`
- **Isolated SQLite Storage:** `hardware_store_demo.db`
- **Security Boundary:** Cloud synchronization to production servers is strictly blocked by code policy in demo mode.
- **Sample Data Reset:** Safe 1-tap reset restores all sample categories, products, stock levels, and invoices back to pristine factory demo state.
- **Build Command:** `npx eas-cli build -p android --profile demo`
- **Full Guide:** See [DEMO_BUILD.md](file:///d:/Stock%20Managment/docs/DEMO_BUILD.md) for full instructions.
