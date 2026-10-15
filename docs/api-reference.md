# Hardware Store API Reference (v1)

Base URL: `http://localhost:4000/api/v1`

All protected endpoints require the header:
```
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

---

## Authentication
### `POST /auth/register-store`
Registers a new store, admin owner account, and initial device.
- **Body:** `{ storeName, ownerName, username, password, phone, address, gstin?, deviceName? }`
- **Response:** `{ success: true, data: { store, user, deviceId, tokens } }`

### `POST /auth/login`
- **Body:** `{ username, password, deviceId? }`
- **Response:** `{ success: true, data: { store, user, tokens } }`

### `POST /auth/refresh`
- **Body:** `{ refreshToken }`
- **Response:** `{ success: true, data: { tokens } }`

---

## Products & Inventory
### `GET /products?search=&categoryId=&stockStatus=`
List all products and their variants with live stock balances.

### `POST /products`
Creates a product, variants, and auditable initial stock movements.

### `POST /inventory/adjustments`
Records an auditable stock adjustment.
- **Body:** `{ variantId, adjustmentType: 'increase'|'decrease'|'damaged'|'loss', quantityChange, unit, reason, notes? }`

### `GET /inventory/:variantId/ledger`
Returns immutable stock movement history for a variant.

---

## Sales & Billing
### `POST /sales`
Creates a sale, calculates server totals, deducts stock, and records movements.
- **Body:** `{ invoiceNumber?, customerName?, customerPhone?, saleDate, items: [{ variantId, quantity, unit, unitPricePaise, discountPaise, taxRatePercent }], paymentMethod, paidAmountPaise, invoiceDiscountPaise? }`

### `POST /sales/:id/returns`
Processes customer return. Reusable goods increment stock; damaged goods log an audit without increasing usable stock.

---

## Purchases
### `POST /purchases`
Records a supplier invoice and inward goods receipt.
- **Body:** `{ invoiceNumber, supplierId?, purchaseDate, status: 'received', paymentMethod, paidAmountPaise, items: [...] }`

---

## Synchronization
### `POST /sync/push`
Idempotent batch processing of client outbox operations.
- **Body:** `{ storeId, deviceId, operations: SyncOperation[] }`
- **Response:** `{ success: true, processedCount, acknowledgements, serverTimestamp }`

### `GET /sync/pull?sinceCursor=&limit=`
Incremental cursor-based server changes.
- **Response:** `{ changes: EntityChange[], newCursor, hasMore, serverTimestamp }`

### `GET /sync/status`
Returns open conflicts count and sync health metrics.
