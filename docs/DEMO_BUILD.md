# Hardware Store Management — Client Evaluation Demo Build Guide

This document specifies the architecture, build instructions, and distribution workflows for the **Client-Evaluation Demo Build** of the Hardware Store Management suite.

---

## 1. Architectural Separation & Integrity

To preserve 100% of the production codebase while providing a safe, client-facing evaluation environment, the system utilizes a **dual-configuration profile strategy**:

| Configuration Property | Production Build (`preview` / `production`) | Demo Build (`demo`) |
| :--- | :--- | :--- |
| **App Display Name** | `Manju Store Management Beta v1.0` | `Hardware Store (Demo)` |
| **Android Application ID** | `com.hardwarestore.manager` | `com.hardwarestore.manager.demo` |
| **iOS Bundle Identifier** | `com.hardwarestore.manager` | `com.hardwarestore.manager.demo` |
| **Deep Link Scheme** | `hardwarestore://` | `hardwarestore-demo://` |
| **Database File (Native)** | `hardware_store.db` | `hardware_store_demo.db` (Physically Isolated) |
| **Web Storage Key** | `hw_store_local_db_v1` | `hw_store_demo_db_v1` (Physically Isolated) |
| **Cloud Synchronization** | Enabled (via JWT & Sync Queue) | **Hard-blocked by Code Boundary** |
| **Sample Data Seeding** | Store Owner Setup Flow | Pre-populated Fictional Catalog |
| **UI Banner** | None | `⚠️ DEMO VERSION — SAMPLE DATA` |

> [!IMPORTANT]
> **Co-Existence on Same Device:** Because the Demo build utilizes a separate Android application ID (`com.hardwarestore.manager.demo`), **both the client demo APK and the production APK can be installed and operated side-by-side on the exact same physical Android device** without package conflicts, shared state leaks, or cache collisions.

---

## 2. Security Boundaries & Data Isolation (Tested & Verified)

1. **No Production Database Connections:**
   - The demo application runs in an isolated offline-first local sandbox.
   - In `apps/mobile/src/sync/syncEngine.ts`, `isDemoMode()` acts as an immutable software boundary. Any call to `SyncEngine.synchronize()` immediately aborts with:
     ```text
     Demo Mode: Synchronization to production database is strictly disabled for security & data isolation.
     ```
   - Zero operations are pushed to or pulled from the client's production MongoDB or Express backend.
2. **Physical Database Partitioning:**
   - On native Android devices, the app connects to `hardware_store_demo.db` instead of `hardware_store.db`. Even direct file operations cannot alter production databases.
3. **Zero Real Client Information:**
   - All sample categories, products, suppliers, customers, purchases, and sales contain purely fictional data (e.g. `@example.com` domains, generic GSTINs, and dummy phone numbers).

---

## 3. Fictional Sample Data & Reset Functionality

The demo comes pre-populated with:
- **5 Core Hardware Categories**: Plumbing & Pipes, Paints & Primers, Tools & Fasteners, Sanitaryware & Bath, Building & Adhesives.
- **10 Subcategories & 12 Products with Variants**: Complete with SKUs, MRP, cost prices, selling prices, unit conversions (meters, liters, pieces, kilograms), rack locations, and stock levels.
- **3 Fictional Suppliers**: Apex Wholesale Hardware, National Paints, Astral & Jaquar Regional Depot.
- **3 Fictional Customers**: Ramesh Builders, Sunil Sharma Plumber, Modern Home Renovations.
- **Sample Purchases & Sales**: Demonstrating stock inward history, counter sales, and ledger reductions.
- **Stock Movement Audit Trail**: Verifying balance-before and balance-after tracking.

### Safe Demo-Data Reset Function
Evaluators can safely experiment with modifying stock, adding products, or making mock sales, and revert back to a clean state at any time:
1. **Via Top Demo Banner**: Tap **`[ Reset Data ]`** on the prominent amber header banner.
2. **Via More Tab**: Go to **More > DEMO EVALUATION SANDBOX > Reset Sample Demo Data**.
3. Confirm the dialog. The local SQLite database tables are cleared and re-seeded back to the pristine factory demo state.

---

## 4. Build Instructions

### Option A: Build Standalone Demo APK via EAS (Cloud / Local)

To build the standalone Demo APK with package ID `com.hardwarestore.manager.demo`:

```bash
# 1. Navigate to apps/mobile or root
cd "d:/Stock Managment/apps/mobile"

# 2. Trigger Demo APK build
npx eas-cli build -p android --profile demo
```

*(To build the production APK instead, run `npx eas-cli build -p android --profile preview`)*.

---

### Option B: Build Local Android APK via Gradle

If building locally using Android Studio / Android SDK build tools:

```bash
# 1. Clean and generate the native Android project with the demo profile
cd "d:/Stock Managment/apps/mobile"
npx cross-env APP_ENV=demo EXPO_PUBLIC_DEMO_MODE=true npx expo prebuild --clean

# 2. Build the Android APK using Gradle
cd android
./gradlew assembleRelease

# 3. Output APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

---

### Option C: Run Local Demo Server for Real-Device Testing (Expo Go / USB)

To evaluate on a connected phone or browser:

```bash
# 1. Start Expo dev server in Demo mode
npm run demo:mobile

# 2. If testing over USB (Zero Firewall Issues):
adb reverse tcp:8081 tcp:8081
# Inside Expo Go on Android phone, open: exp://localhost:8081
```

---

## 5. Verification Checklist for Client Evaluation

Before handing over the demo APK to the client:
- [x] Application installs under name **`Hardware Store (Demo)`**.
- [x] Application installs alongside the production app without overwriting it.
- [x] Top header prominently displays **`DEMO VERSION — SAMPLE DATA`**.
- [x] Sample categories, paints, pipes, tools, and sanitary items load with live stocks.
- [x] Testing stock deductions updates cards and audit trails accurately.
- [x] Tapping **`Reset Data`** cleanly resets all stock and sample data.
- [x] Production database and production API endpoints remain untouched.
