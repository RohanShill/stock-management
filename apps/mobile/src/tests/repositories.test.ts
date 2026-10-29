import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTables, mockDb } = vi.hoisted(() => {
  const tables: Record<string, any[]> = {
    categories: [],
    subcategories: [],
    custom_field_definitions: [],
    products: [],
    product_variants: [],
    sync_queue: [],
  };

  const db = {
    execAsync: vi.fn().mockResolvedValue(undefined),
    withTransactionAsync: vi.fn(async (callback: () => Promise<any>) => callback()),
    runAsync: vi.fn(async (sql: string, params: any[] = []) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('INSERT INTO CATEGORIES')) {
        tables.categories.push({
          id: params[0],
          storeId: params[1],
          name: params[2],
          description: params[3],
          icon: params[4],
          displayOrder: params[5],
          active: 1,
          createdAt: params[6],
          updatedAt: params[7],
        });
      } else if (trimmed.startsWith('INSERT INTO SUBCATEGORIES')) {
        tables.subcategories.push({
          id: params[0],
          storeId: params[1],
          categoryId: params[2],
          name: params[3],
          description: params[4],
          displayOrder: params[5],
          active: 1,
          createdAt: params[6],
          updatedAt: params[7],
        });
      } else if (trimmed.startsWith('INSERT INTO CUSTOM_FIELD_DEFINITIONS')) {
        tables.custom_field_definitions.push({
          id: params[0],
          storeId: params[1],
          targetLevel: params[2],
          targetId: params[3],
          name: params[4],
          label: params[5],
          fieldType: params[6],
          unit: params[7],
          required: params[8],
          options: params[9],
          defaultValue: params[10],
          displayOrder: params[11],
          active: 1,
          createdAt: params[12],
          updatedAt: params[13],
        });
      } else if (trimmed.startsWith('INSERT INTO SYNC_QUEUE')) {
        tables.sync_queue.push({
          id: params[0],
          storeId: params[1],
          deviceId: params[2],
          entityType: params[3],
          entityId: params[4],
          operationType: params[5],
          payload: params[6],
          status: 'pending',
        });
      } else if (trimmed.startsWith('UPDATE CATEGORIES')) {
        const id = params[params.length - 2];
        const cat = tables.categories.find((c) => c.id === id);
        if (cat) {
          if (sql.includes('deletedAt = ?')) {
            cat.deletedAt = params[0];
            cat.active = 0;
          }
        }
      } else if (trimmed.startsWith('UPDATE SUBCATEGORIES')) {
        const id = params[params.length - 2];
        const sub = tables.subcategories.find((s) => s.id === id);
        if (sub) {
          if (sql.includes('categoryId = ?')) sub.categoryId = params[0];
          if (sql.includes('deletedAt = ?')) {
            sub.deletedAt = params[0];
            sub.active = 0;
          }
        }
      } else if (trimmed.startsWith('UPDATE PRODUCTS')) {
        const id = params[params.length - 1];
        const prod = tables.products.find((p) => p.id === id);
        if (prod && sql.includes('deletedAt = ?')) {
          prod.deletedAt = params[0];
          prod.active = 0;
        }
      } else if (trimmed.startsWith('UPDATE PRODUCT_VARIANTS')) {
        const prodId = params[params.length - 1];
        tables.product_variants.forEach((v) => {
          if (v.productId === prodId && sql.includes('deletedAt = ?')) {
            v.deletedAt = params[0];
            v.active = 0;
          }
        });
      }
      return { lastInsertRowId: 1, changes: 1 };
    }),
    getAllAsync: vi.fn(async (sql: string, params: any[] = []) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.includes('FROM CATEGORIES')) {
        return tables.categories.filter((c) => !c.deletedAt);
      }
      if (trimmed.includes('FROM SUBCATEGORIES')) {
        return tables.subcategories.filter((s) => !s.deletedAt);
      }
      if (trimmed.includes('FROM CUSTOM_FIELD_DEFINITIONS')) {
        return tables.custom_field_definitions.filter((f) => !f.deletedAt);
      }
      if (trimmed.includes('FROM PRODUCT_VARIANTS')) {
        return tables.product_variants.filter((v) => !v.deletedAt);
      }
      if (trimmed.includes('FROM PRODUCTS')) {
        return tables.products.filter((p) => !p.deletedAt);
      }
      return [];
    }),
    getFirstAsync: vi.fn(async (sql: string, params: any[] = []) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.includes('FROM CATEGORIES WHERE ID = ?')) {
        return tables.categories.find((c) => c.id === params[0]) || null;
      }
      if (trimmed.includes('FROM SUBCATEGORIES WHERE ID = ?')) {
        return tables.subcategories.find((s) => s.id === params[0]) || null;
      }
      if (trimmed.includes('SELECT COUNT(*) AS COUNT FROM SUBCATEGORIES')) {
        const count = tables.subcategories.filter((s) => s.categoryId === params[0] && !s.deletedAt).length;
        return { count };
      }
      if (trimmed.includes('SELECT COUNT(*) AS COUNT FROM PRODUCTS')) {
        const count = tables.products.filter((p) => p.categoryId === params[0] && !p.deletedAt).length;
        return { count };
      }
      return { count: 0 };
    }),
  };

  return { mockTables: tables, mockDb: db };
});

vi.mock('../database/db.js', () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

import { CategoryRepository } from '../database/repositories/categoryRepository.js';
import { CustomFieldRepository } from '../database/repositories/customFieldRepository.js';
import { ProductRepository } from '../database/repositories/productRepository.js';

describe('CategoryRepository Offline Operations', () => {
  beforeEach(() => {
    mockTables.categories.length = 0;
    mockTables.subcategories.length = 0;
    mockTables.custom_field_definitions.length = 0;
    mockTables.products.length = 0;
    mockTables.sync_queue.length = 0;
    vi.clearAllMocks();
  });

  it('creates category and enqueues sync operation offline', async () => {
    const category = await CategoryRepository.createCategory(
      {
        name: 'Plumbing',
        description: 'Pipes and fittings',
        icon: 'pipe',
        displayOrder: 1,
      },
      'store-1',
      'dev-1'
    );

    expect(category.id).toBeDefined();
    expect(category.name).toBe('Plumbing');
    expect(mockTables.categories.length).toBe(1);
    expect(mockTables.sync_queue.length).toBe(1);
    expect(mockTables.sync_queue[0].entityType).toBe('category');
    expect(mockTables.sync_queue[0].operationType).toBe('create');
  });

  it('creates multiple subcategories under a category and enqueues sync', async () => {
    const cat = await CategoryRepository.createCategory(
      { name: 'Electrical' },
      'store-1',
      'dev-1'
    );

    const sub1 = await CategoryRepository.createSubcategory(
      {
        categoryId: cat.id,
        name: 'Wires',
        displayOrder: 0,
      },
      'store-1',
      'dev-1'
    );

    const sub2 = await CategoryRepository.createSubcategory(
      {
        categoryId: cat.id,
        name: 'Cables',
        displayOrder: 1,
      },
      'store-1',
      'dev-1'
    );

    expect(sub1.categoryId).toBe(cat.id);
    expect(sub2.categoryId).toBe(cat.id);
    expect(mockTables.subcategories.length).toBe(2);
    expect(mockTables.sync_queue.filter((q) => q.entityType === 'subcategory').length).toBe(2);
  });

  it('moves a subcategory safely to another parent category', async () => {
    const cat1 = await CategoryRepository.createCategory({ name: 'Plumbing' }, 'store-1', 'dev-1');
    const cat2 = await CategoryRepository.createCategory({ name: 'Hardware' }, 'store-1', 'dev-1');

    const sub = await CategoryRepository.createSubcategory(
      { categoryId: cat1.id, name: 'Valves' },
      'store-1',
      'dev-1'
    );

    await CategoryRepository.moveSubcategory(sub.id, cat2.id, 'store-1', 'dev-1');

    // Verify subcategory sync queue contains the move
    const moveOp = mockTables.sync_queue.find(
      (q) => q.entityType === 'subcategory' && q.operationType === 'update'
    );
    expect(moveOp).toBeDefined();
    const payload = JSON.parse(moveOp!.payload);
    expect(payload.categoryId).toBe(cat2.id);
  });

  it('checks affected records before safe archiving a category', async () => {
    const cat = await CategoryRepository.createCategory({ name: 'Fasteners' }, 'store-1', 'dev-1');

    // With 0 products and subcategories, affected counts are zero
    const check1 = await CategoryRepository.getAffectedCounts(cat.id, 'store-1');
    expect(check1.productsCount).toBe(0);
    expect(check1.subcategoriesCount).toBe(0);

    // Archive category
    const archiveResult = await CategoryRepository.archiveCategory(cat.id, 'store-1', 'dev-1');
    expect(archiveResult.productsCount).toBe(0);

    const archived = mockTables.categories.find((c) => c.id === cat.id);
    expect(archived?.active).toBe(0);
    expect(archived?.deletedAt).toBeDefined();
  });
});

describe('CustomFieldRepository Dynamic Specifications', () => {
  beforeEach(() => {
    mockTables.custom_field_definitions.length = 0;
    mockTables.sync_queue.length = 0;
    vi.clearAllMocks();
  });

  it('creates custom field definition and enqueues sync', async () => {
    const field = await CustomFieldRepository.createCustomField(
      {
        targetLevel: 'subcategory',
        targetId: 'sub-cpvc-pipes',
        name: 'pressure_rating',
        label: 'Pressure Rating',
        fieldType: 'dropdown',
        options: ['SDR 11', 'SDR 13.5', 'SCH 40', 'SCH 80'],
        unit: 'PSI',
        required: true,
      },
      'store-1',
      'dev-1'
    );

    expect(field.id).toBeDefined();
    expect(field.name).toBe('pressure_rating');
    expect(field.options).toEqual(['SDR 11', 'SDR 13.5', 'SCH 40', 'SCH 80']);
    expect(mockTables.custom_field_definitions.length).toBe(1);

    const syncItem = mockTables.sync_queue.find((q) => q.entityType === 'custom_field');
    expect(syncItem).toBeDefined();
    expect(syncItem?.operationType).toBe('create');
  });

  it('queries custom fields filtering active definitions', async () => {
    await CustomFieldRepository.createCustomField(
      {
        targetLevel: 'category',
        targetId: 'cat-electrical',
        name: 'voltage_rating',
        label: 'Voltage Rating',
        fieldType: 'text',
      },
      'store-1',
      'dev-1'
    );

    const fields = await CustomFieldRepository.getCustomFields(
      'store-1',
      'category',
      'cat-electrical'
    );
    expect(fields.length).toBe(1);
    expect(fields[0].name).toBe('voltage_rating');
  });

  it('archives product and creates sync delete entry', async () => {
    mockTables.products.push({
      id: 'prod-test-del',
      storeId: 'store-1',
      name: 'To Delete Pipe',
      active: 1,
    });
    mockTables.product_variants.push({
      id: 'var-test-del',
      productId: 'prod-test-del',
      storeId: 'store-1',
      sku: 'SKU-DEL',
      name: '1 inch',
      active: 1,
    });

    await ProductRepository.archiveProduct('prod-test-del', 'store-1', 'dev-1');

    const prod = mockTables.products.find((p) => p.id === 'prod-test-del');
    expect(prod?.active).toBe(0);
    expect(prod?.deletedAt).toBeDefined();

    const variant = mockTables.product_variants.find((v) => v.id === 'var-test-del');
    expect(variant?.active).toBe(0);
    expect(variant?.deletedAt).toBeDefined();

    const syncItem = mockTables.sync_queue.find(
      (s) => s.entityType === 'product' && s.entityId === 'prod-test-del'
    );
    expect(syncItem).toBeDefined();
    expect(syncItem?.operationType).toBe('delete');
  });

  it('getProductsWithVariants filters out products with deleted category or subcategory', async () => {
    mockTables.categories.push({ id: 'cat-active', storeId: 'store-1', name: 'Pipes', active: 1 });
    mockTables.categories.push({ id: 'cat-deleted', storeId: 'store-1', name: 'Old Cat', deletedAt: '2026-10-29', active: 0 });

    mockTables.subcategories.push({ id: 'sub-active', storeId: 'store-1', categoryId: 'cat-active', name: 'Pipes', active: 1 });
    mockTables.subcategories.push({ id: 'sub-deleted', storeId: 'store-1', categoryId: 'cat-active', name: 'Deleted Sub', deletedAt: '2026-10-29', active: 0 });

    // Active product
    mockTables.products.push({
      id: 'prod-valid',
      storeId: 'store-1',
      categoryId: 'cat-active',
      subcategoryId: 'sub-active',
      name: 'Finolex Pipe',
      brand: 'Finolex',
      active: 1,
    });
    mockTables.product_variants.push({
      id: 'var-valid',
      productId: 'prod-valid',
      name: '1/2',
      size: '1/2',
      currentStock: 50,
      active: 1,
    });

    // Product under deleted category
    mockTables.products.push({
      id: 'prod-under-del-cat',
      storeId: 'store-1',
      categoryId: 'cat-deleted',
      subcategoryId: undefined,
      name: 'Old Paint',
      brand: 'Berger',
      active: 1,
    });
    mockTables.product_variants.push({
      id: 'var-old',
      productId: 'prod-under-del-cat',
      name: '1L',
      size: '1L',
      currentStock: 10,
      active: 1,
    });

    // Product under deleted subcategory
    mockTables.products.push({
      id: 'prod-under-del-sub',
      storeId: 'store-1',
      categoryId: 'cat-active',
      subcategoryId: 'sub-deleted',
      name: 'Deleted Section Prod',
      brand: 'AKG',
      active: 1,
    });
    mockTables.product_variants.push({
      id: 'var-del-sub',
      productId: 'prod-under-del-sub',
      name: '1/2',
      size: '1/2',
      currentStock: 10,
      active: 1,
    });

    const results = await ProductRepository.getProductsWithVariants('store-1');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('prod-valid');
    expect(results[0].variants.length).toBe(1);
  });
});
