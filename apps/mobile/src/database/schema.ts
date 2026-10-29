export const SQL_CREATE_TABLES = `
-- Store configuration
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ownerName TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  gstin TEXT,
  currency TEXT DEFAULT 'INR',
  defaultTaxRatePercent REAL DEFAULT 18,
  invoicePrefix TEXT DEFAULT 'INV',
  invoiceSequence INTEGER DEFAULT 1000,
  negativeStockAllowed INTEGER DEFAULT 0,
  pipeTrackingMethod TEXT DEFAULT 'aggregate',
  costingMethod TEXT DEFAULT 'weighted_average',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Categories & Subcategories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  displayOrder INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_categories_store ON categories(storeId, displayOrder);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  displayOrder INTEGER DEFAULT 0,
  customValues TEXT, -- JSON key-value pairs (e.g. sizeOrder)
  active INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY (categoryId) REFERENCES categories(id)
);
CREATE INDEX IF NOT EXISTS idx_subcategories_cat ON subcategories(categoryId, displayOrder);

-- Dynamic Custom Field Definitions
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  targetLevel TEXT NOT NULL, -- category, subcategory, product, variant
  targetId TEXT,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  fieldType TEXT NOT NULL, -- text, number, decimal, dropdown, boolean, multiselect
  unit TEXT,
  required INTEGER DEFAULT 0,
  options TEXT, -- JSON array of strings
  defaultValue TEXT,
  displayOrder INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_cf_target ON custom_field_definitions(storeId, targetLevel, targetId, displayOrder);

-- Products & Variants
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  subcategoryId TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  material TEXT,
  description TEXT,
  modelNumber TEXT,
  imageUrl TEXT,
  measurementType TEXT NOT NULL,
  baseUnit TEXT NOT NULL,
  allowedUnits TEXT NOT NULL, -- JSON array of strings
  packMultiplier REAL DEFAULT 1,
  pipeDiameterMm REAL,
  standardLengthMm REAL,
  pipeTrackingMethod TEXT,
  customValues TEXT, -- JSON key-value pairs
  active INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_search ON products(name, brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(storeId, categoryId, subcategoryId);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(storeId, categoryId, subcategoryId, brand);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(storeId, deletedAt, active);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  productId TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  size TEXT,
  color TEXT,
  purchasePricePaise INTEGER NOT NULL DEFAULT 0,
  sellingPricePaise INTEGER NOT NULL DEFAULT 0,
  mrpPaise INTEGER,
  taxRatePercent REAL DEFAULT 18,
  minStockLevel REAL DEFAULT 5,
  openingStock REAL DEFAULT 0,
  currentStock REAL DEFAULT 0, -- in base units
  rackLocation TEXT,
  preferredSupplierId TEXT,
  customValues TEXT, -- JSON key-value pairs
  displayOrder INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY (productId) REFERENCES products(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(storeId, sku);
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(productId, deletedAt, active);
CREATE INDEX IF NOT EXISTS idx_variants_store ON product_variants(storeId, deletedAt, active);
CREATE INDEX IF NOT EXISTS idx_variants_size ON product_variants(productId, size);

-- Auditable Immutable Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  variantId TEXT NOT NULL,
  movementType TEXT NOT NULL,
  quantityChangeBase REAL NOT NULL,
  balanceBeforeBase REAL NOT NULL,
  balanceAfterBase REAL NOT NULL,
  referenceType TEXT,
  referenceId TEXT,
  reason TEXT,
  notes TEXT,
  deviceId TEXT,
  userId TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_variant ON stock_movements(variantId, createdAt);
CREATE INDEX IF NOT EXISTS idx_movements_store_created ON stock_movements(storeId, createdAt DESC);

-- Pipe Segments (Method B: physical remnants)
CREATE TABLE IF NOT EXISTS pipe_segments (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  variantId TEXT NOT NULL,
  originalLengthMm REAL NOT NULL,
  currentLengthMm REAL NOT NULL,
  batchNumber TEXT,
  purchaseId TEXT,
  status TEXT DEFAULT 'available',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pipe_segments ON pipe_segments(variantId, status);

-- Suppliers & Customers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  name TEXT NOT NULL,
  businessName TEXT,
  phone TEXT NOT NULL,
  alternatePhone TEXT,
  email TEXT,
  address TEXT,
  gstin TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  businessName TEXT,
  gstin TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

-- Purchases & Line Items
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  invoiceNumber TEXT NOT NULL,
  supplierId TEXT,
  purchaseDate TEXT NOT NULL,
  status TEXT DEFAULT 'received',
  totalTaxablePaise INTEGER NOT NULL,
  totalTaxPaise INTEGER NOT NULL,
  grandTotalPaise INTEGER NOT NULL,
  paidAmountPaise INTEGER NOT NULL,
  outstandingPaise INTEGER NOT NULL,
  paymentMethod TEXT NOT NULL,
  notes TEXT,
  deviceId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchaseId TEXT NOT NULL,
  variantId TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  quantityBase REAL NOT NULL,
  unitCostPaise INTEGER NOT NULL,
  taxRatePercent REAL DEFAULT 0,
  totalPaise INTEGER NOT NULL,
  pipeLengthPerPieceMm REAL,
  numberOfPieces INTEGER,
  FOREIGN KEY (purchaseId) REFERENCES purchases(id)
);

-- Sales & Line Items
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  invoiceNumber TEXT NOT NULL,
  customerId TEXT,
  customerName TEXT,
  customerPhone TEXT,
  saleDate TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  subtotalGrossPaise INTEGER NOT NULL,
  totalDiscountPaise INTEGER DEFAULT 0,
  totalTaxablePaise INTEGER NOT NULL,
  totalTaxPaise INTEGER DEFAULT 0,
  roundOffPaise INTEGER DEFAULT 0,
  grandTotalPaise INTEGER NOT NULL,
  paidAmountPaise INTEGER NOT NULL,
  outstandingPaise INTEGER DEFAULT 0,
  paymentMethod TEXT NOT NULL,
  notes TEXT,
  deviceId TEXT NOT NULL,
  userId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(saleDate);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  saleId TEXT NOT NULL,
  variantId TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  quantityBase REAL NOT NULL,
  unitPricePaise INTEGER NOT NULL,
  discountPaise INTEGER DEFAULT 0,
  taxRatePercent REAL DEFAULT 0,
  totalPaise INTEGER NOT NULL,
  pipeCutSummary TEXT,
  FOREIGN KEY (saleId) REFERENCES sales(id)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  category TEXT NOT NULL,
  amountPaise INTEGER NOT NULL,
  date TEXT NOT NULL,
  paymentMethod TEXT NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  createdAt TEXT NOT NULL
);

-- Persistent Synchronization Outbox
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  deviceId TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  operationType TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON stringified
  status TEXT DEFAULT 'pending', -- pending, processing, synced, failed
  retryCount INTEGER DEFAULT 0,
  lastError TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, createdAt);

-- Synchronization Metadata & High-Water Mark Cursors
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Synchronization Conflicts
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  localPayload TEXT NOT NULL,
  serverPayload TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  resolutionType TEXT,
  createdAt TEXT NOT NULL,
  resolvedAt TEXT
);
`;
