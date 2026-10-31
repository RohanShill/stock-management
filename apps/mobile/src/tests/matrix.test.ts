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
});
