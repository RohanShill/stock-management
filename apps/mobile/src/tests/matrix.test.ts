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

  it('filters out any elbow or albow items and general brands from variants', async () => {
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
    expect(data.sizes).toEqual(['1/2"']);
    expect(data.sizes).not.toContain('Elbow 1/2"');
    expect(data.cells['1/2"___supreme'].currentStock).toBe(25);
    expect(data.cells['1/2"___finolex'].currentStock).toBe(15);
  });
});
