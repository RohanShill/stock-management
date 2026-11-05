import { describe, it, expect, vi } from 'vitest';

vi.mock('../database/db.js', () => ({
  getDatabase: vi.fn().mockResolvedValue({}),
}));

vi.mock('../database/repositories/syncQueueRepository.js', () => ({
  SyncQueueRepository: {
    enqueue: vi.fn().mockResolvedValue(undefined),
  },
}));

import { MatrixRepository } from '../database/repositories/matrixRepository.js';

describe('MatrixRepository Utilities', () => {
  it('correctly sorts pipe sizes in natural ascending order', () => {
    const unsortedSizes = ['2"', '1/2"', '1 1/2"', '3/4"', '1"', '1 1/4"'];
    const sorted = MatrixRepository.sortSizes(unsortedSizes);

    expect(sorted).toEqual([
      '1/2"',
      '3/4"',
      '1"',
      '1 1/4"',
      '1 1/2"',
      '2"',
    ]);
  });

  it('handles metric or text sizes predictably', () => {
    const fittings = ['Nipple 1/2"', 'Tee 1/2"', 'Nipple 3/4"', 'Socket 1/2"'];
    const sorted = MatrixRepository.sortSizes(fittings);
    expect(sorted.length).toBe(4);
    expect(sorted).toContain('Nipple 1/2"');
  });

  it('correctly sorts sizes with unit words like inch and mm', () => {
    const sizes = ['3/4 inch', '1/2 inch', '1 1/2 inch', '1 inch'];
    const sorted = MatrixRepository.sortSizes(sizes);
    expect(sorted).toEqual(['1/2 inch', '3/4 inch', '1 inch', '1 1/2 inch']);

    const metric = ['110mm', '20mm', '50mm', '25mm'];
    const sortedMetric = MatrixRepository.sortSizes(metric);
    expect(sortedMetric).toEqual(['20mm', '25mm', '50mm', '110mm']);
  });

  it('retrieves matrix data including brands even when section has no variants yet', async () => {
    const mockDb = {
      getAllAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM products')) {
          return Promise.resolve([
            { id: 'p1', brand: 'Supreme', name: 'Supreme Items' },
            { id: 'p2', brand: 'General', name: 'General Items' },
          ]);
        }
        if (sql.includes('FROM product_variants')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
      runAsync: vi.fn().mockResolvedValue({}),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    const data = await MatrixRepository.getMatrixData('store-1', 'cat-1', 'sub-1');
    expect(data.brands).toEqual(['Supreme']);
    expect(data.sizes).toEqual([]);
    expect(Object.keys(data.cells)).toHaveLength(0);
  });

  it('allows elbow and albow items in sizes and variants while excluding general brands', async () => {
    const mockDb = {
      getAllAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM products')) {
          return Promise.resolve([
            { id: 'p1', brand: 'Supreme', name: 'Supreme Items' },
            { id: 'p2', brand: 'Finolex', name: 'Finolex Items' },
          ]);
        }
        if (sql.includes('FROM product_variants')) {
          return Promise.resolve([
            { id: 'v1', productId: 'p1', size: '1/2"', currentStock: 25 },
            { id: 'v2', productId: 'p1', size: 'Elbow 1/2"', currentStock: 10 },
            { id: 'v3', productId: 'p2', size: '1/2"', currentStock: 15 },
          ]);
        }
        return Promise.resolve([]);
      }),
      runAsync: vi.fn().mockResolvedValue({}),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    const data = await MatrixRepository.getMatrixData('store-1', 'cat-1', 'sub-1');
    expect(data.brands).toContain('Supreme');
    expect(data.brands).toContain('Finolex');
    expect(data.sizes).toContain('1/2"');
    expect(data.sizes).toContain('Elbow 1/2"');
    expect(data.cells['1/2"___supreme'].currentStock).toBe(25);
    expect(data.cells['Elbow 1/2"___supreme'].currentStock).toBe(10);
    expect(data.cells['1/2"___finolex'].currentStock).toBe(15);
  });

  it('does not auto-seed default sections so fresh installations start with zero sections', async () => {
    const mockDb = {
      getAllAsync: vi.fn().mockResolvedValue([]),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    const tabs = await MatrixRepository.ensureDefaultSubTabs('store-1', 'cat-pipes', 'Pipes', 'dev-1');
    expect(tabs).toEqual([]);
  });

  it('returns only active sections created for that specific category without sharing across categories', async () => {
    const mockSubcategories = [
      { id: 's1', categoryId: 'cat-bath', name: 'Taps', displayOrder: 1, active: 1 },
      { id: 's2', categoryId: 'cat-bath', name: 'Showers', displayOrder: 2, active: 1 },
    ];
    const mockDb = {
      getAllAsync: vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('FROM subcategories')) {
          const catId = params?.[0];
          return Promise.resolve(mockSubcategories.filter((s) => s.categoryId === catId));
        }
        return Promise.resolve([]);
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    const bathTabs = await MatrixRepository.ensureDefaultSubTabs('store-1', 'cat-bath', 'Bath fittings', 'dev-1');
    expect(bathTabs.map((t) => t.name)).toEqual(['Taps', 'Showers']);

    // Another category has no sections and gets zero sections from bath
    const powderTabs = await MatrixRepository.ensureDefaultSubTabs('store-1', 'cat-powder', 'Powder', 'dev-1');
    expect(powderTabs).toEqual([]);
  });

  it('filters out dummy general brands and demo IDs from getMatrixData while preserving user brands', async () => {
    const mockDb = {
      getAllAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM products')) {
          return Promise.resolve([
            { id: 'p1', brand: 'Jaquar', name: 'Jaquar Tap' },
            { id: 'p2', brand: 'Asian Paints', name: 'Apex Weatherproof Emulsion' },
            { id: 'p3', brand: 'General', name: 'General Item' },
          ]);
        }
        if (sql.includes('FROM product_variants')) {
          return Promise.resolve([
            { id: 'v1', productId: 'p1', size: '1/2"', currentStock: 14 },
            { id: 'v2', productId: 'p2', size: '4L', currentStock: 8 },
            { id: 'v3', productId: 'p3', size: '10L', currentStock: 5 },
          ]);
        }
        return Promise.resolve([]);
      }),
      runAsync: vi.fn().mockResolvedValue({}),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    const data = await MatrixRepository.getMatrixData('store-1', 'cat-bath', 'sub-bath');
    expect(data.brands).toContain('Jaquar');
    expect(data.brands).toContain('Asian Paints');
    expect(data.brands).not.toContain('General');
    expect(data.sizes).toContain('1/2"');
    expect(data.sizes).toContain('4L');
  });

  it('does not resurrect an explicitly deleted section in ensureDefaultSubTabs', async () => {
    const mockDb = {
      getAllAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT LOWER(name) as name, deletedAt FROM subcategories')) {
          // Pipes was active, Others was deleted
          return Promise.resolve([
            { name: 'pipes', deletedAt: null },
            { name: 'others', deletedAt: '2026-10-27T00:00:00Z' },
          ]);
        }
        if (sql.includes('FROM subcategories')) {
          // Active rows (only Pipes)
          return Promise.resolve([
            { id: 'sub-p1', name: 'Pipes', displayOrder: 1, active: 1 },
          ]);
        }
        return Promise.resolve([]);
      }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    const tabs = await MatrixRepository.ensureDefaultSubTabs('store-1', 'cat-pipes', 'Pipes', 'dev-1');
    const names = tabs.map((t) => t.name);
    // Pipes remains, Pipe Fittings was never created so it was added, but Others was deleted so NOT re-created!
    expect(names).toContain('Pipes');
    expect(names).not.toContain('Others');
  });

  it('cascades deleteSubTab to both subcategories and products', async () => {
    const executedSql: string[] = [];
    const mockDb = {
      runAsync: vi.fn().mockImplementation((sql: string) => {
        executedSql.push(sql);
        return Promise.resolve({ changes: 1 });
      }),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    await MatrixRepository.deleteSubTab('store-1', 'sub-123', 'dev-1');
    expect(executedSql.some((s) => s.includes('UPDATE subcategories SET deletedAt = ?, active = 0'))).toBe(true);
    expect(executedSql.some((s) => s.includes('UPDATE products SET deletedAt = ?, active = 0'))).toBe(true);
    expect(executedSql.some((s) => s.includes('UPDATE product_variants SET deletedAt = ?, active = 0'))).toBe(true);
  });

  it('preserves custom size order in getMatrixData when saved', async () => {
    const customOrder = ['2"', '1"', '1/2"'];
    const mockDb = {
      getAllAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM products')) {
          return Promise.resolve([
            { id: 'p1', brand: 'Supreme', name: 'Supreme Pipe' },
          ]);
        }
        if (sql.includes('FROM product_variants')) {
          return Promise.resolve([
            { id: 'v1', productId: 'p1', size: '1/2"', currentStock: 10 },
            { id: 'v2', productId: 'p1', size: '1"', currentStock: 20 },
            { id: 'v3', productId: 'p1', size: '2"', currentStock: 30 },
          ]);
        }
        return Promise.resolve([]);
      }),
      getFirstAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT customValues FROM subcategories')) {
          return Promise.resolve({
            customValues: JSON.stringify({ sizeOrder: customOrder }),
          });
        }
        return Promise.resolve(null);
      }),
      runAsync: vi.fn().mockResolvedValue({}),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    const data = await MatrixRepository.getMatrixData('store-1', 'cat-1', 'sub-1');
    // Expect custom dragged order: 2", then 1", then 1/2"
    expect(data.sizes).toEqual(['2"', '1"', '1/2"']);
  });

  it('updates product and variants when renaming a brand', async () => {
    const executedSql: string[] = [];
    const mockDb = {
      runAsync: vi.fn().mockImplementation((sql: string) => {
        executedSql.push(sql);
        return Promise.resolve({ changes: 1 });
      }),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    await MatrixRepository.renameBrand('store-1', 'cat-1', 'sub-1', 'akg', 'AKG Pipes', 'dev-1');

    expect(executedSql.some((s) => s.includes('UPDATE products \n       SET brand = ?, \n           name = ? || \' Items\''))).toBe(true);
    expect(executedSql.some((s) => s.includes('UPDATE product_variants \n       SET name = ? || \' \' || size'))).toBe(true);
  });

  it('updates variant size and subcategory customValues when renaming a size', async () => {
    const executedSql: string[] = [];
    const mockDb = {
      getFirstAsync: vi.fn().mockResolvedValue({
        customValues: JSON.stringify({ sizeOrder: ['1/2', 'T', '3/4'] }),
      }),
      runAsync: vi.fn().mockImplementation((sql: string) => {
        executedSql.push(sql);
        return Promise.resolve({ changes: 1 });
      }),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    await MatrixRepository.renameSize('store-1', 'cat-1', 'sub-1', 'T', 'Tee', 'dev-1');

    expect(executedSql.some((s) => s.includes('UPDATE product_variants \n       SET size = ?'))).toBe(true);
    expect(executedSql.some((s) => s.includes('UPDATE subcategories SET customValues = ?'))).toBe(true);
  });

  it('saves custom brand order and applies custom brand order when loading matrix', async () => {
    let savedCustomValues = '';
    const mockDb = {
      getFirstAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM subcategories')) {
          return Promise.resolve({
            customValues: JSON.stringify({ brandOrder: ['Finolex', 'Supreme', 'Astral'] }),
          });
        }
        return Promise.resolve(null);
      }),
      getAllAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM products')) {
          return Promise.resolve([
            { id: 'p1', brand: 'Supreme', name: 'Supreme Items' },
            { id: 'p2', brand: 'Astral', name: 'Astral Items' },
            { id: 'p3', brand: 'Finolex', name: 'Finolex Items' },
          ]);
        }
        if (sql.includes('FROM product_variants')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
      runAsync: vi.fn().mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('UPDATE subcategories SET customValues = ?')) {
          savedCustomValues = params[0];
        }
        return Promise.resolve({ changes: 1 });
      }),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    // Test saveBrandOrder
    await MatrixRepository.saveBrandOrder('store-1', 'cat-1', 'sub-1', ['Finolex', 'Astral', 'Supreme']);
    expect(savedCustomValues).toContain('Finolex');
    expect(savedCustomValues).toContain('Astral');
    expect(savedCustomValues).toContain('Supreme');

    // Test getMatrixData with custom brandOrder
    const data = await MatrixRepository.getMatrixData('store-1', 'cat-1', 'sub-1');
    expect(data.brands).toEqual(['Finolex', 'Supreme', 'Astral']);
  });

  it('addSubTab supports creating child subsections with depth and enforces 4 levels under section (max depth 5)', async () => {
    const subcats: any[] = [];
    const mockDb = {
      getFirstAsync: vi.fn().mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT depth FROM subcategories')) {
          const found = subcats.find((s) => s.id === params[0]);
          return Promise.resolve(found ? { depth: found.depth } : null);
        }
        if (sql.includes('SELECT MAX(displayOrder)')) {
          return Promise.resolve({ maxOrder: subcats.length });
        }
        return Promise.resolve(null);
      }),
      runAsync: vi.fn().mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO subcategories')) {
          subcats.push({
            id: params[0],
            storeId: params[1],
            categoryId: params[2],
            parentId: params[3],
            depth: params[4],
            name: params[5],
          });
        }
        return Promise.resolve({ changes: 1 });
      }),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    // Root section (depth 1)
    const sec1 = await MatrixRepository.addSubTab('store-1', 'cat-1', 'dev-1', 'Water Pipes', null);
    expect(sec1.depth).toBe(1);
    expect(sec1.parentId).toBeNull();

    // Subsection 1 (depth 2)
    const sub1 = await MatrixRepository.addSubTab('store-1', 'cat-1', 'dev-1', 'UPVC Pipe', sec1.id);
    expect(sub1.depth).toBe(2);
    expect(sub1.parentId).toBe(sec1.id);

    // Subsection 2 (depth 3)
    const sub2 = await MatrixRepository.addSubTab('store-1', 'cat-1', 'dev-1', 'Schedule 80', sub1.id);
    expect(sub2.depth).toBe(3);

    // Subsection 3 (depth 4)
    const sub3 = await MatrixRepository.addSubTab('store-1', 'cat-1', 'dev-1', '4-Metre', sub2.id);
    expect(sub3.depth).toBe(4);

    // Subsection 4 (depth 5)
    const sub4 = await MatrixRepository.addSubTab('store-1', 'cat-1', 'dev-1', 'Threaded', sub3.id);
    expect(sub4.depth).toBe(5);

    // Exceeding depth 5 (attempting 5th level under section, depth 6) should throw
    await expect(
      MatrixRepository.addSubTab('store-1', 'cat-1', 'dev-1', 'Beyond Depth', sub4.id)
    ).rejects.toThrow('Maximum subsection nesting (Level 4 under Section) reached.');
  });

  it('updates variant selling price in paise and custom priceDisplay text', async () => {
    let executedSql = '';
    let executedParams: any[] = [];
    const mockDb = {
      runAsync: vi.fn().mockImplementation((sql: string, params: any[]) => {
        executedSql = sql;
        executedParams = params;
        return Promise.resolve({ changes: 1 });
      }),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    await MatrixRepository.updateVariantPrice(
      'var-123',
      'sell',
      5000, // ₹50.00
      'store-1',
      'device-1',
      '50 per pics'
    );

    expect(executedSql).toContain('UPDATE product_variants SET sellingPricePaise = ?, priceDisplay = ?');
    expect(executedParams[0]).toBe(5000);
    expect(executedParams[1]).toBe('50 per pics');
    expect(executedParams[3]).toBe('var-123');
  });

  it('maps sellingPricePaise, purchasePricePaise and priceDisplay in matrix cells', async () => {
    const mockDb = {
      getAllAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM products')) {
          return Promise.resolve([
            { id: 'prod-1', brand: 'Supreme', name: 'Supreme Pipe' },
          ]);
        }
        if (sql.includes('FROM product_variants')) {
          return Promise.resolve([
            {
              id: 'var-1',
              productId: 'prod-1',
              size: '1/2"',
              currentStock: 25,
              sellingPricePaise: 5000,
              purchasePricePaise: 4000,
              priceDisplay: '50 per litter',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      getFirstAsync: vi.fn().mockResolvedValue(null),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    const data = await MatrixRepository.getMatrixData('store-1', 'cat-1', 'sub-1');
    const cellKey = '1/2"___supreme';
    expect(data.cells[cellKey]).toBeDefined();
    expect(data.cells[cellKey].currentStock).toBe(25);
    expect(data.cells[cellKey].sellingPricePaise).toBe(5000);
    expect(data.cells[cellKey].purchasePricePaise).toBe(4000);
    expect(data.cells[cellKey].priceDisplay).toBe('50 per litter');
    expect(data.cells[cellKey].hasStockHistory).toBe(true);
  });

  it('distinguishes between brand new unstocked items and genuinely out-of-stock items', () => {
    // Case 1: Brand new item (never filled, currentStock: 0, no stock history)
    const unstockedCell = {
      variantId: 'v-new',
      currentStock: 0,
      hasStockHistory: false,
    };
    const isUnstockedOut = unstockedCell.hasStockHistory && unstockedCell.currentStock <= 0;
    expect(isUnstockedOut).toBe(false); // MUST NOT trigger red alert

    // Case 2: Stocked out item (was previously filled or moved, now reached 0)
    const stockedOutCell = {
      variantId: 'v-depleted',
      currentStock: 0,
      hasStockHistory: true,
    };
    const isGenuinelyOut = stockedOutCell.hasStockHistory && stockedOutCell.currentStock <= 0;
    expect(isGenuinelyOut).toBe(true); // MUST trigger red alert 0 •
  });

  it('supports multi-word query filtering matching size and brand across tokens', () => {
    const matrix = {
      brands: ['Supreme', 'Finolex'],
      sizes: ['1/2"', '3/4"'],
      cells: {
        '1/2"___supreme': { brand: 'Supreme', size: '1/2"', currentStock: 10, sellingPricePaise: 5000, purchasePricePaise: 0, variantId: 'v1', productId: 'p1', priceDisplay: '50 per pc' },
        '3/4"___supreme': { brand: 'Supreme', size: '3/4"', currentStock: 5, sellingPricePaise: 8000, purchasePricePaise: 0, variantId: 'v2', productId: 'p1', priceDisplay: null },
        '1/2"___finolex': { brand: 'Finolex', size: '1/2"', currentStock: 8, sellingPricePaise: 4500, purchasePricePaise: 0, variantId: 'v3', productId: 'p2', priceDisplay: null },
      },
    };

    const filterMatrix = (query: string) => {
      const rawQuery = query.trim().toLowerCase();
      if (!rawQuery) return matrix;
      const tokens = rawQuery.split(/\s+/).filter(Boolean);
      const matchingSizes = new Set<string>();
      const matchingBrands = new Set<string>();

      for (const size of matrix.sizes) {
        for (const brand of matrix.brands) {
          const cellKey = `${size}___${brand.toLowerCase()}`;
          const cell = matrix.cells[cellKey as keyof typeof matrix.cells];
          const combinedText = `${size} ${brand} ${cell?.priceDisplay || ''}`.toLowerCase();
          const allTokensMatch = tokens.every((token) => combinedText.includes(token));
          if (allTokensMatch) {
            matchingSizes.add(size);
            matchingBrands.add(brand);
          }
        }
      }

      if (matchingSizes.size > 0 && matchingBrands.size > 0) {
        return {
          brands: matrix.brands.filter((b) => matchingBrands.has(b)),
          sizes: matrix.sizes.filter((s) => matchingSizes.has(s)),
          cells: matrix.cells,
        };
      }
      return { brands: matrix.brands, sizes: [], cells: matrix.cells };
    };

    // Test 1: Single size
    expect(filterMatrix('1/2').sizes).toEqual(['1/2"']);
    // Test 2: Combined size and brand in any order
    expect(filterMatrix('supreme 1/2').brands).toEqual(['Supreme']);
    expect(filterMatrix('supreme 1/2').sizes).toEqual(['1/2"']);
    expect(filterMatrix('1/2 supreme').brands).toEqual(['Supreme']);
    // Test 3: Search matching price display
    expect(filterMatrix('50 per pc').sizes).toEqual(['1/2"']);
    // Test 4: Non-matching
    expect(filterMatrix('unknown item').sizes).toEqual([]);
  });

  it('filters unbranded matrix categories with size-only catalog', () => {
    const unbrandedMatrix = {
      brands: [],
      sizes: ['10mm', '20mm', '30mm'],
      cells: {},
    };

    const filterUnbranded = (query: string) => {
      const rawQuery = query.trim().toLowerCase();
      if (!rawQuery) return unbrandedMatrix;
      const tokens = rawQuery.split(/\s+/).filter(Boolean);
      const matchingSizes = unbrandedMatrix.sizes.filter((s) =>
        tokens.every((t) => s.toLowerCase().includes(t))
      );
      return {
        brands: [],
        sizes: matchingSizes,
        cells: {},
      };
    };

    expect(filterUnbranded('20mm').sizes).toEqual(['20mm']);
    expect(filterUnbranded('20').sizes).toEqual(['20mm']);
    expect(filterUnbranded('nonexistent').sizes).toEqual([]);
  });

  it('correctly matches multi-word history items across brand, size, price, and note', () => {
    const historyItem = {
      productName: 'Dulux paint Items',
      variantName: 'Dulux paint 5L',
      size: '5L',
      brand: 'Dulux paint',
      unit: 'pcs',
      sellingPricePaise: 5000,
      priceDisplay: '50 per pc',
      notes: 'Counter Cash Bill #104',
      reason: 'Sale',
    };

    const matchHistory = (query: string) => {
      const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let priceStr = '';
      if (historyItem.priceDisplay) priceStr += ` ${historyItem.priceDisplay}`;
      if (historyItem.sellingPricePaise && historyItem.sellingPricePaise > 0) {
        const rupees = historyItem.sellingPricePaise / 100;
        priceStr += ` ₹${rupees} ${rupees}`;
      }

      const combined = [
        historyItem.productName,
        historyItem.variantName,
        historyItem.size,
        historyItem.brand,
        historyItem.unit,
        historyItem.reason,
        historyItem.notes,
        priceStr,
      ].join(' ').toLowerCase();

      return terms.every((t) => combined.includes(t));
    };

    // Brand + size across separate fields
    expect(matchHistory('Dulux 5L')).toBe(true);
    // Size + price
    expect(matchHistory('5L 50')).toBe(true);
    expect(matchHistory('5L ₹50')).toBe(true);
    // Custom note
    expect(matchHistory('Counter Cash')).toBe(true);
    // Non-matching term fails even if other term matches
    expect(matchHistory('Dulux 100L')).toBe(false);
  });

  it('searches cross-section products and variants matching multi-word tokens', async () => {
    const mockDb = {
      getAllAsync: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM product_variants v')) {
          return Promise.resolve([
            {
              variantId: 'v1',
              size: '10L',
              currentStock: 24,
              sellingPricePaise: 45000,
              priceDisplay: '450',
              productId: 'p1',
              productName: 'Primium Finolex paint Items',
              brand: 'Primium Finolex',
              unit: 'piece',
              categoryId: 'cat-paint',
              subcategoryId: 'sub-wall-paint',
              categoryName: 'Paint',
              subcategoryName: 'Wall paint',
            },
            {
              variantId: 'v2',
              size: '5kg',
              currentStock: 10,
              sellingPricePaise: 25000,
              priceDisplay: '250',
              productId: 'p2',
              productName: 'Birla White Putty',
              brand: 'Birla White',
              unit: 'bag',
              categoryId: 'cat-paint',
              subcategoryId: 'sub-putty',
              categoryName: 'Paint',
              subcategoryName: 'Putty',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      runAsync: vi.fn().mockResolvedValue({}),
    };

    const { getDatabase } = await import('../database/db.js');
    vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

    // Searching 'putty' from 'sub-wall-paint' should return the Putty item
    const results = await MatrixRepository.searchCrossSections('store-1', 'putty', 'sub-wall-paint', 'cat-paint');
    expect(results).toHaveLength(1);
    expect(results[0].subcategoryName).toBe('Putty');
    expect(results[0].brand).toBe('Birla White');
    expect(results[0].priceDisplay).toBe('250');

    // Searching 'paint' should exclude current subcategory 'sub-wall-paint' and match other Paint sections
    const paintResults = await MatrixRepository.searchCrossSections('store-1', 'paint', 'sub-wall-paint', 'cat-paint');
    expect(paintResults).toHaveLength(1);
    expect(paintResults[0].subcategoryName).toBe('Putty');

    // Empty query returns empty array
    const emptyResults = await MatrixRepository.searchCrossSections('store-1', '   ', 'sub-wall-paint');
    expect(emptyResults).toHaveLength(0);
  });
});
