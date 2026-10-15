# Offline Synchronization Engine

## 1. Overview
The Hardware Store Manager implements an **Outbox Pattern with Incremental Pull & Idempotent Push**.
The device never depends on the cloud backend for everyday shop transactions.

---

## 2. Push Flow (Outbox)
1. Whenever a record is created or updated locally (product, sale, purchase, stock adjustment, party, expense), it is committed to local SQLite inside a database transaction alongside an entry in `sync_queue`.
2. When internet connectivity is active:
   - The device reads pending items from `sync_queue` in batches.
   - Dispatches `POST /api/v1/sync/push` with the operations array.
3. **Backend Idempotency:**
   - The server inspects each operation's `id`.
   - If an operation with that ID was already processed, it acknowledges immediately without reapplying or duplicating transactions.
   - If new, the backend updates MongoDB and records the operation.
4. **Partial Failure Handling:**
   - The server returns per-operation status acknowledgements (`acknowledged` or `rejected`).
   - The mobile client marks only acknowledged operations as `synced`. Failed operations remain in `pending`/`failed` with their error recorded for retry.

---

## 3. Pull Flow (Incremental Cursors)
1. The mobile client queries its local `sync_metadata` table for `server_cursor`.
2. Dispatches `GET /api/v1/sync/pull?sinceCursor=<cursor>`.
3. The server finds all documents modified in MongoDB since `<cursor>` scoped to the authenticated `storeId`.
4. The client applies the changes inside an SQLite transaction and updates `server_cursor` to the new high-water mark timestamp.

---

## 4. Multi-Device Stock Conflict Reconciliation
- **Movement-based accounting:** Stock changes are transferred as `stock_movement` records rather than overwriting absolute stock numbers.
- **Offline overselling policy:** If two devices sell the same last item while disconnected from the cloud, the backend audits both completed sales and flags a stock reconciliation item for the owner to review, avoiding silent data loss or discarded customer invoices.
