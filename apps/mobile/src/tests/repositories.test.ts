import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTables, mockDb } = vi.hoisted(() => {
  const tables: Record<string, any[]> = {
    categories: [],
    subcategories: [],
    custom_field_definitions: [],
    products: [],
    product_variants: [],
    stock_movements: [],
    sync_queue: [],
  };

  const db = {
    execAsync: vi.fn().mockResolvedValue(undefined),
    withTransactionAsync: vi.fn(async (callback: () => Promise<any>) => callback()),
    runAsync: vi.fn(async (sql: string, params: any[] = []) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('DELETE FROM STOCK_MOVEMENTS')) {
        const count = tables.stock_movements.length;
        tables.stock_movements = [];
        return { lastInsertRowId: 0, changes: count };
      }
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
        const isHierarchical = params.length >= 10;
        tables.subcategories.push({
          id: params[0],
          storeId: params[1],
          categoryId: params[2],
          parentId: isHierarchical ? params[3] : null,
          depth: isHierarchical ? params[4] : 1,
          name: isHierarchical ? params[5] : params[3],
          description: isHierarchical ? params[6] : params[4],
          displayOrder: isHierarchical ? params[7] : params[5],
          active: 1,
          createdAt: isHierarchical ? params[8] : params[6],
          updatedAt: isHierarchical ? params[9] : params[7],
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
        const id = sql.includes('storeId = ?') ? params[params.length - 2] : params[params.length - 1];
        const prod = tables.products.find((p) => p.id === id);
        if (prod) {
          if (sql.includes('deletedAt = ?')) {
            prod.deletedAt = params[0];
            prod.active = 0;
          } else if (sql.includes('SET name = ?')) {
            prod.name = params[0];
            prod.brand = params[1];
            prod.material = params[2];
            prod.description = params[3];
            prod.modelNumber = params[4];
            prod.imageUrl = params[5];
            prod.customValues = params[6];
          }
        }
      } else if (trimmed.startsWith('UPDATE PRODUCT_VARIANTS')) {
        if (sql.includes('WHERE id = ?')) {
          const varId = params[params.length - 2];
          const v = tables.product_variants.find((item) => item.id === varId);
          if (v) {
            v.name = params[0];
            v.sku = params[1];
            v.barcode = params[2];
            v.size = params[3];
            v.color = params[4];
            v.purchasePricePaise = params[5];
            v.sellingPricePaise = params[6];
            v.priceDisplay = params[7];
            v.currentStock = params[8];
            v.openingStock = params[9];
          }
        } else {
          const prodId = params[params.length - 1];
          tables.product_variants.forEach((v) => {
            if (v.productId === prodId && sql.includes('deletedAt = ?')) {
              v.deletedAt = params[0];
              v.active = 0;
            }
          });
        }
      }
      return { lastInsertRowId: 1, changes: 1 };
    }),
    getAllAsync: vi.fn(async (sql: string, params: any[] = []) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.includes('FROM CATEGORIES')) {
        return tables.categories.filter((c) => !c.deletedAt);
      }
      if (trimmed.includes('FROM SUBCATEGORIES')) {
        let subs = tables.subcategories.filter((s) => !s.deletedAt);
        if (sql.includes('parentId IS NULL')) {
          subs = subs.filter((s) => !s.parentId);
        } else if (sql.includes('parentId = ?')) {
          const parentParam = params[params.length - 1];
          subs = subs.filter((s) => s.parentId === parentParam);
        }
        return subs;
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
      if (trimmed.includes('FROM PRODUCTS WHERE ID = ?')) {
        return tables.products.find((p) => p.id === params[0]) || null;
      }
      if (trimmed.includes('FROM PRODUCT_VARIANTS WHERE ID = ?')) {
        return tables.product_variants.find((v) => v.id === params[0]) || null;
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
import { InventoryRepository } from '../database/repositories/inventoryRepository.js';

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

  it('supports 4 levels of nested subsections under a section (total depth 5) and enforces max limit', async () => {
    const cat = await CategoryRepository.createCategory({ name: 'Plumbing & Pipes' }, 'store-1', 'dev-1');

    // Level 1: Section (depth 1)
    const l1Section = await CategoryRepository.createSubcategory(
      { categoryId: cat.id, name: 'Water Pipes', parentId: null },
      'store-1',
      'dev-1'
    );
    expect(l1Section.depth).toBe(1);

    // Level 2: Sub-section 1 (depth 2)
    const l2Sub = await CategoryRepository.createSubcategory(
      { categoryId: cat.id, name: 'UPVC Pipe', parentId: l1Section.id },
      'store-1',
      'dev-1'
    );
    expect(l2Sub.depth).toBe(2);
    expect(l2Sub.parentId).toBe(l1Section.id);

    // Level 3: Sub-section 2 (depth 3)
    const l3Sub = await CategoryRepository.createSubcategory(
      { categoryId: cat.id, name: 'Schedule 80', parentId: l2Sub.id },
      'store-1',
      'dev-1'
    );
    expect(l3Sub.depth).toBe(3);
    expect(l3Sub.parentId).toBe(l2Sub.id);

    // Level 4: Sub-section 3 (depth 4)
    const l4Sub = await CategoryRepository.createSubcategory(
      { categoryId: cat.id, name: '4-Metre', parentId: l3Sub.id },
      'store-1',
      'dev-1'
    );
    expect(l4Sub.depth).toBe(4);
    expect(l4Sub.parentId).toBe(l3Sub.id);

    // Level 5: Sub-section 4 (depth 5)
    const l5Sub = await CategoryRepository.createSubcategory(
      { categoryId: cat.id, name: 'Threaded End', parentId: l4Sub.id },
      'store-1',
      'dev-1'
    );
    expect(l5Sub.depth).toBe(5);
    expect(l5Sub.parentId).toBe(l4Sub.id);

    // Level 6: Should be rejected
    await expect(
      CategoryRepository.createSubcategory(
        { categoryId: cat.id, name: 'Too Deep Subsection', parentId: l5Sub.id },
        'store-1',
        'dev-1'
      )
    ).rejects.toThrow('Maximum subsection depth (Level 4 under Section) reached.');

    // Breadcrumb path from Level 5 to root
    const breadcrumbs = await CategoryRepository.getBreadcrumbPath(l5Sub.id, 'store-1');
    expect(breadcrumbs.map((b) => b.name)).toEqual([
      'Water Pipes',
      'UPVC Pipe',
      'Schedule 80',
      '4-Metre',
      'Threaded End',
    ]);

    // Querying root sections vs child subcategories
    const rootSections = await CategoryRepository.getSubcategories(cat.id, 'store-1', false, null);
    expect(rootSections.map((s) => s.name)).toEqual(['Water Pipes']);

    const l2Children = await CategoryRepository.getSubcategories(cat.id, 'store-1', false, l1Section.id);
    expect(l2Children.map((s) => s.name)).toEqual(['UPVC Pipe']);
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

  it('recursively archives subcategory and all nested child subcategories', async () => {
    const cat = await CategoryRepository.createCategory({ name: 'Plumbing' }, 'store-1', 'dev-1');
    const parentSub = await CategoryRepository.createSubcategory(
      { categoryId: cat.id, name: 'Pipes', parentId: null },
      'store-1',
      'dev-1'
    );
    const childSub1 = await CategoryRepository.createSubcategory(
      { categoryId: cat.id, name: 'PVC Pipes', parentId: parentSub.id },
      'store-1',
      'dev-1'
    );
    const grandChildSub = await CategoryRepository.createSubcategory(
      { categoryId: cat.id, name: 'Heavy Duty PVC', parentId: childSub1.id },
      'store-1',
      'dev-1'
    );

    const affected = await CategoryRepository.archiveSubcategory(parentSub.id, 'store-1', 'dev-1');
    expect(affected).toBe(0);

    const deletedSubs = mockTables.subcategories.filter((s) => s.active === 0 && s.deletedAt != null);
    const deletedIds = deletedSubs.map((s) => s.id);
    expect(deletedIds).toContain(parentSub.id);
    expect(deletedIds).toContain(childSub1.id);
    expect(deletedIds).toContain(grandChildSub.id);

    const deleteSyncOps = mockTables.sync_queue.filter(
      (q) => q.entityType === 'subcategory' && q.operationType === 'delete'
    );
    expect(deleteSyncOps.map((o) => o.entityId)).toContain(parentSub.id);
    expect(deleteSyncOps.map((o) => o.entityId)).toContain(childSub1.id);
    expect(deleteSyncOps.map((o) => o.entityId)).toContain(grandChildSub.id);
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

  it('clearStockHistory deletes all movements for store', async () => {
    mockTables.stock_movements.push(
      { id: 'sm-1', storeId: 'store-1', movementType: 'sale' },
      { id: 'sm-2', storeId: 'store-1', movementType: 'restock' }
    );
    expect(mockTables.stock_movements.length).toBe(2);

    await InventoryRepository.clearStockHistory('store-1');
    expect(mockTables.stock_movements.length).toBe(0);
  });

  it('preserves existing product and variant fields on partial updateProduct', async () => {
    mockTables.products.push({
      id: 'prod-partial',
      storeId: 'store-1',
      categoryId: 'cat-1',
      subcategoryId: 'sub-1',
      name: 'Original Product Name',
      brand: 'Dulux',
      material: 'Acrylic',
      description: 'Original Desc',
      modelNumber: 'M-100',
      active: 1,
    });

    mockTables.product_variants.push({
      id: 'var-partial',
      productId: 'prod-partial',
      storeId: 'store-1',
      name: 'Original Var Name',
      sku: 'SKU-ORIG-123',
      barcode: 'BARCODE-999',
      size: '10L',
      color: 'White',
      purchasePricePaise: 30000,
      sellingPricePaise: 45000,
      priceDisplay: '450',
      currentStock: 20,
      openingStock: 20,
      taxRatePercent: 18,
      minStockLevel: 5,
      active: 1,
    });

    // Partial update: only update description and change stock
    await ProductRepository.updateProduct(
      'prod-partial',
      { description: 'Brand new updated description' },
      [{ id: 'var-partial', currentStock: 25 }],
      'store-1',
      'dev-1'
    );

    const updatedProd = mockTables.products.find((p) => p.id === 'prod-partial');
    expect(updatedProd.name).toBe('Original Product Name');
    expect(updatedProd.brand).toBe('Dulux');
    expect(updatedProd.material).toBe('Acrylic');
    expect(updatedProd.description).toBe('Brand new updated description');

    const updatedVar = mockTables.product_variants.find((v) => v.id === 'var-partial');
    expect(updatedVar.name).toBe('Original Var Name');
    expect(updatedVar.sku).toBe('SKU-ORIG-123');
    expect(updatedVar.barcode).toBe('BARCODE-999');
    expect(updatedVar.size).toBe('10L');
    expect(updatedVar.sellingPricePaise).toBe(45000);
    expect(updatedVar.priceDisplay).toBe('450');
    expect(updatedVar.currentStock).toBe(25);
  });
});
