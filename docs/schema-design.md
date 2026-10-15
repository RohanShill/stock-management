# Hardware Store Schema & Data Integrity Design

## 1. Database Architecture
The application uses a hybrid dual-database architecture tailored for reliable offline-first retail operations:
- **Client (Android device):** Local SQLite (`hardware_store.db`) via `expo-sqlite` with WAL mode and foreign key enforcement. Primary store for UI reads/writes.
- **Backend (Cloud):** MongoDB Atlas via Mongoose. Authoritative store for multi-device data backup and sync.

---

## 2. Shared Data Models & SQLite Tables

### `stores`
- `id` (TEXT, UUID primary key)
- `name` (TEXT)
- `ownerName` (TEXT)
- `phone` (TEXT)
- `email` (TEXT)
- `address` (TEXT)
- `gstin` (TEXT, optional tax identifier)
- `currency` (TEXT, default 'INR')
- `defaultTaxRatePercent` (REAL, default 18)
- `invoicePrefix` (TEXT, default 'INV')
- `invoiceSequence` (INTEGER, local offline counter)
- `negativeStockAllowed` (INTEGER 0/1)
- `pipeTrackingMethod` (TEXT 'aggregate' | 'segment')
- `costingMethod` (TEXT 'weighted_average' | 'fifo')

### `products` & `product_variants`
Hierarchy: Category → Subcategory → Product → Variant
- Supports **Count**, **Length**, **Weight**, **Volume**, and **Pack** measurement types.
- All product inventory is tracked internally in canonical base units:
  - Count: `piece`
  - Length: `mm` (integer millimetres to prevent floating point inaccuracies)
  - Weight: `g` (grams)
  - Volume: `ml` (millilitres)
- Financial fields stored in integer **Paise** (₹1 = 100 paise).

### `stock_movements` (Immutable Auditable Ledger)
Every inventory change is written as an append-only movement row:
- `id` (TEXT)
- `storeId` (TEXT)
- `variantId` (TEXT)
- `movementType` (`opening_stock`, `purchase_received`, `sale`, `sale_return`, `adjustment_increase`, `adjustment_decrease`, `damaged_goods`, `stock_loss`, `reconciliation`, `reversal`)
- `quantityChangeBase` (REAL, positive or negative)
- `balanceBeforeBase` (REAL)
- `balanceAfterBase` (REAL)
- `referenceType` (`sale`, `purchase`, `adjustment`, `return`, `manual`)
- `referenceId` (TEXT)
- `reason` (TEXT)
- `deviceId`, `userId`, `createdAt`

### `pipe_segments` (Method B: Individual Pieces & Usable Remnants)
- `id` (TEXT)
- `storeId` (TEXT)
- `variantId` (TEXT)
- `originalLengthMm` (REAL)
- `currentLengthMm` (REAL)
- `status` (`available`, `consumed`, `damaged`, `discarded`)

### `sales` & `sale_items`
- Sales record completed customer invoices with payment methods, tax breakdowns, discounts, and round-offs.
- Completed sales execute atomic local SQLite transactions that update `currentStock`, write `sale_items`, write `stock_movements`, and append to `sync_queue`.

### `purchases` & `purchase_items`
- Goods receipt from suppliers. Marks stock as received and increments balances exactly once.

### `sync_queue` (Persistent Outbox)
- `id` (TEXT, unique operation UUID)
- `storeId` (TEXT)
- `deviceId` (TEXT)
- `entityType` (TEXT)
- `entityId` (TEXT)
- `operationType` (`create`, `update`, `delete`)
- `payload` (TEXT, JSON string)
- `status` (`pending`, `processing`, `synced`, `failed`)
- `retryCount` (INTEGER)
- `lastError` (TEXT)
