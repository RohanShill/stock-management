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
    const fittings = ['Elbow 1/2"', 'Tee 1/2"', 'Elbow 3/4"', 'Socket 1/2"'];
    const sorted = MatrixRepository.sortSizes(fittings);
    expect(sorted.length).toBe(4);
    expect(sorted).toContain('Elbow 1/2"');
  });
});
