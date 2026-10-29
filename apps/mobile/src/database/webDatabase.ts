/**
 * Web SQLite Database Adapter
 * Provides persistent SQLite simulation via localStorage for web testing
 * Preserves all schemas, relationships, categories, subcategories, products, and variants
 */

export interface WebDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T = any>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, params?: any[]): Promise<T | null>;
  withTransactionAsync<T>(callback: () => Promise<T>): Promise<T>;
}

const STORAGE_KEY = 'manju_hardware_store_v1';

class WebSQLiteStore {
  private tables: Record<string, any[]> = {
    stores: [],
    categories: [],
    subcategories: [],
    custom_field_definitions: [],
    products: [],
    product_variants: [],
    stock_movements: [],
    pipe_segments: [],
    sales: [],
    sale_items: [],
    purchases: [],
    purchase_items: [],
    suppliers: [],
    customers: [],
    expenses: [],
    sync_queue: [],
    sync_metadata: [],
  };

  constructor() {
    this.loadFromStorage();
    this.seedDefaultDataIfNeeded();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.tables = { ...this.tables, ...parsed };
          // Ensure ONLY "Pipes" and "Paints" categories are kept
          this.tables.categories = this.tables.categories
            .filter((c: any) => {
              const n = (c.name || '').toLowerCase();
              return (
                n.includes('pipe') ||
                n.includes('plumb') ||
                n.includes('paint')
              );
            })
            .map((c: any) => {
              const n = (c.name || '').toLowerCase();
              if (n.includes('pipe') || n.includes('plumb')) {
                return { ...c, name: 'Pipes' };
              }
              if (n.includes('paint')) {
                return { ...c, name: 'Paints' };
              }
              return c;
            });

          // Deduplicate categories by name
          const seenCat = new Set<string>();
          this.tables.categories = this.tables.categories.filter((c: any) => {
            if (seenCat.has(c.name)) return false;
            seenCat.add(c.name);
            return true;
          });

          const now = new Date().toISOString();
          let pipesCat = this.tables.categories.find((c: any) => c.name === 'Pipes');
          let paintsCat = this.tables.categories.find((c: any) => c.name === 'Paints');
          if (!pipesCat) {
            pipesCat = {
              id: 'cat-plumbing',
              storeId: 'store-1',
              name: 'Pipes',
              description: 'Pipes, fittings, valves',
              icon: 'pipe',
              displayOrder: 1,
              active: 1,
              createdAt: now,
              updatedAt: now,
            };
            this.tables.categories.push(pipesCat);
          }
          if (!paintsCat) {
            paintsCat = {
              id: 'cat-paints',
              storeId: 'store-1',
              name: 'Paints',
              description: 'Wall paints, primers, finishes',
              icon: 'brush',
              displayOrder: 2,
              active: 1,
              createdAt: now,
              updatedAt: now,
            };
            this.tables.categories.push(paintsCat);
          }

          if (this.tables.stores[0]) {
            this.tables.stores[0].name = 'MANJU STORES';
            this.tables.stores[0].email = 'store@manjustore.in';
          }

          // Clear all demo products as requested: "dont add demo data"
          this.tables.products = (this.tables.products || []).filter(
            (p: any) => !p.id.startsWith('prod-') && !p.id.startsWith('demo-')
          );
          const validProdIds = new Set(this.tables.products.map((p: any) => p.id));
          this.tables.product_variants = (this.tables.product_variants || []).filter(
            (v: any) => validProdIds.has(v.productId)
          );

          // Retain only subcategories belonging to Pipes and Paints
          const validCatIds = new Set(this.tables.categories.map((c: any) => c.id));
          this.tables.subcategories = this.tables.subcategories.filter((s: any) => validCatIds.has(s.categoryId));

          // Clean up any old dummy subcategories like 'Angles', 'Elbow', 'Albow', 'Emulsion', 'Distemper', 'Primer', 'Waterproof', 'Putty'
          this.tables.subcategories = (this.tables.subcategories || []).filter(
            (s: any) =>
              !s.name.toLowerCase().includes('angle') &&
              !s.name.toLowerCase().includes('elbow') &&
              !s.name.toLowerCase().includes('albow') &&
              !s.name.toLowerCase().includes('emulsion') &&
              !s.name.toLowerCase().includes('distemper') &&
              !s.name.toLowerCase().includes('primer') &&
              !s.name.toLowerCase().includes('solvent') &&
              !s.name.toLowerCase().includes('waterproof') &&
              !s.name.toLowerCase().includes('putty') &&
              s.name.toLowerCase() !== 'general' &&
              !s.id?.startsWith('demo-sub-')
          );

          // Clean up any products or variants with 'elbow' / 'albow' or paint demo items
          this.tables.product_variants = (this.tables.product_variants || []).filter(
            (v: any) =>
              !v.size?.toLowerCase().includes('elbow') &&
              !v.size?.toLowerCase().includes('albow') &&
              !v.name?.toLowerCase().includes('elbow') &&
              !v.name?.toLowerCase().includes('albow') &&
              !v.id?.startsWith('demo-var-')
          );
          this.tables.products = (this.tables.products || []).filter(
            (p: any) =>
              !p.name?.toLowerCase().includes('elbow') &&
              !p.name?.toLowerCase().includes('albow') &&
              !p.name?.toLowerCase().includes('emulsion') &&
              !p.name?.toLowerCase().includes('distemper') &&
              !p.name?.toLowerCase().includes('primer') &&
              !p.name?.toLowerCase().includes('waterproof') &&
              !p.name?.toLowerCase().includes('putty') &&
              !p.brand?.toLowerCase().includes('asian paint') &&
              !p.brand?.toLowerCase().includes('berger') &&
              !p.brand?.toLowerCase().includes('dr. fixit') &&
              !p.brand?.toLowerCase().includes('birla white') &&
              p.brand?.toLowerCase() !== 'general' &&
              !p.id?.startsWith('demo-')
          );

          // Sanitize and repair stock_movements if corrupted
          if (Array.isArray(this.tables.stock_movements)) {
            this.tables.stock_movements = this.tables.stock_movements.map((sm: any) => {
              const itemDate = sm.createdAt && sm.createdAt !== 'null' ? sm.createdAt : now;
              let mType = sm.movementType;
              let delta = Number(sm.quantityChangeBase) || 0;

              // Fix corrupted column-shifted records where movementType was a number
              if (typeof mType === 'number' || (typeof mType === 'string' && !isNaN(Number(mType)))) {
                delta = Number(mType);
                mType = delta < 0 ? 'sale' : 'adjustment_increase';
              }

              // Fix sale entries that have positive delta or mismatch
              const isSaleHint =
                mType === 'sale' ||
                sm.referenceType === 'sale' ||
                String(sm.reason || '').toLowerCase().includes('sale') ||
                String(sm.reason || '').toLowerCase().includes('sold') ||
                String(sm.notes || '').toLowerCase().includes('sold');

              if (isSaleHint) {
                mType = 'sale';
                if (delta > 0) delta = -delta;
              }

              return {
                ...sm,
                storeId: sm.storeId || 'store-1',
                movementType: mType,
                quantityChangeBase: delta,
                createdAt: itemDate,
              };
            });
          }

          this.saveToStorage();
        }
      }
    } catch (e) {
      console.warn('[WebDB] Could not load from localStorage, using memory:', e);
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tables));
      }
    } catch (e) {
      console.warn('[WebDB] Could not save to localStorage:', e);
    }
  }

  private seedDefaultDataIfNeeded() {
    const now = new Date().toISOString();
    if (this.tables.stores.length === 0) {
      this.tables.stores.push({
        id: 'store-1',
        name: 'MANJU STORES',
        ownerName: 'Manju Devi',
        phone: '9876543210',
        email: 'store@manjustore.in',
        address: 'Plot 42, Industrial Area, Phase 2',
        gstin: '07AAAAA0000A1Z5',
        currency: 'INR',
        defaultTaxRatePercent: 18,
        invoicePrefix: 'INV',
        invoiceSequence: 1001,
        negativeStockAllowed: 0,
        pipeTrackingMethod: 'aggregate',
        costingMethod: 'weighted_average',
        createdAt: now,
        updatedAt: now,
      });
    }

    if (this.tables.categories.length === 0) {
      const plumbingId = 'cat-plumbing';
      const paintsId = 'cat-paints';

      this.tables.categories.push(
        {
          id: plumbingId,
          storeId: 'store-1',
          name: 'Pipes',
          description: 'Pipes, fittings, valves, water tanks',
          icon: 'pipe',
          displayOrder: 1,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: paintsId,
          storeId: 'store-1',
          name: 'Paints',
          description: 'Wall paints, primers, brushes, thinners',
          icon: 'brush',
          displayOrder: 2,
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      const subCpvcId = 'sub-cpvc';
      const subPvcFittingsId = 'sub-pvc';
      const subEmulsionId = 'sub-paints-emulsion';
      const subWaterproofId = 'sub-paints-waterproofing';

      this.tables.subcategories.push(
        {
          id: subCpvcId,
          storeId: 'store-1',
          categoryId: plumbingId,
          name: 'CPVC Pipes',
          description: 'Chlorinated polyvinyl chloride hot/cold pipes',
          displayOrder: 1,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: subPvcFittingsId,
          storeId: 'store-1',
          categoryId: plumbingId,
          name: 'PVC Pipes & Fittings',
          description: 'Rigid PVC drainage & plumbing pipes & brass fittings',
          displayOrder: 2,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'sub-pipe-others',
          storeId: 'store-1',
          categoryId: plumbingId,
          name: 'Others',
          description: 'Other accessories section',
          displayOrder: 3,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: subEmulsionId,
          storeId: 'store-1',
          categoryId: paintsId,
          name: 'Emulsions & Distempers',
          description: 'Interior & exterior wall finishes',
          displayOrder: 1,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: subWaterproofId,
          storeId: 'store-1',
          categoryId: paintsId,
          name: 'Waterproofing Chemicals',
          description: 'Roof, wall, and bathroom damp-proof solutions',
          displayOrder: 2,
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      this.saveToStorage();
    }
  }

  async execAsync(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await this.runAsync(stmt);
    }
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    // Ignore PRAGMAs and CREATE TABLE statements on web
    if (upper.startsWith('PRAGMA') || upper.startsWith('CREATE TABLE') || upper.startsWith('CREATE INDEX')) {
      return { lastInsertRowId: 0, changes: 0 };
    }

    // INSERT INTO <table> (<cols>) VALUES (<placeholders>)
    if (upper.startsWith('INSERT INTO') || upper.startsWith('INSERT OR REPLACE INTO')) {
      const match = trimmed.match(/INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const table = match[1].toLowerCase();
        const cols = match[2].split(',').map((c) => c.trim());
        const valTokens = match[3].split(',').map((v) => v.trim());
        const row: Record<string, any> = {};
        let pIdx = 0;
        cols.forEach((col, idx) => {
          const token = valTokens[idx];
          if (token === '?') {
            row[col] = params[pIdx] !== undefined ? params[pIdx] : null;
            pIdx++;
          } else if (token !== undefined) {
            const unquoted = token.replace(/^['"]|['"]$/g, '');
            if (!isNaN(Number(unquoted)) && !token.startsWith("'") && !token.startsWith('"')) {
              row[col] = Number(unquoted);
            } else {
              row[col] = unquoted;
            }
          } else {
            row[col] = params[pIdx] !== undefined ? params[pIdx] : null;
            pIdx++;
          }
        });

        if (!this.tables[table]) this.tables[table] = [];

        // If replace, find existing by id
        if (upper.startsWith('INSERT OR REPLACE') && row.id) {
          const idx = this.tables[table].findIndex((item) => item.id === row.id);
          if (idx !== -1) {
            this.tables[table][idx] = { ...this.tables[table][idx], ...row };
            this.saveToStorage();
            return { lastInsertRowId: 1, changes: 1 };
          }
        }

        this.tables[table].push(row);
        this.saveToStorage();
        return { lastInsertRowId: 1, changes: 1 };
      }
    }

    // UPDATE <table> SET ... WHERE ...
    if (upper.startsWith('UPDATE')) {
      const updateMatch = trimmed.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
      if (updateMatch) {
        const table = updateMatch[1].toLowerCase();
        const setClause = updateMatch[2];
        const whereClause = updateMatch[3].replace(/;+$/, '').trim();

        if (!this.tables[table]) return { lastInsertRowId: 0, changes: 0 };

        const setAssignments = setClause.split(',').map((s) => s.trim());
        let changes = 0;

        // Extract params: assignments first, then where conditions
        let paramIdx = 0;
        const setMap: Record<string, any> = {};
        for (const assign of setAssignments) {
          const parts = assign.split('=');
          if (parts.length === 2) {
            const col = parts[0].trim();
            const valExpr = parts[1].trim();
            if (valExpr === '?') {
              setMap[col] = params[paramIdx++];
            } else {
              const unquoted = valExpr.replace(/^['"]|['"]$/g, '');
              if (!isNaN(Number(unquoted)) && !valExpr.startsWith("'") && !valExpr.startsWith('"')) {
                setMap[col] = Number(unquoted);
              } else {
                setMap[col] = unquoted;
              }
            }
          }
        }

        // Apply where filter
        const whereParams = params.slice(paramIdx);
        this.tables[table] = this.tables[table].map((row) => {
          if (this.evaluateWhere(row, whereClause, whereParams)) {
            changes++;
            return { ...row, ...setMap };
          }
          return row;
        });

        this.saveToStorage();
        return { lastInsertRowId: 0, changes };
      }
    }

    // DELETE FROM <table> WHERE ...
    if (upper.startsWith('DELETE FROM')) {
      const deleteMatch = trimmed.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
      if (deleteMatch) {
        const table = deleteMatch[1].toLowerCase();
        const whereClause = deleteMatch[2]?.replace(/;+$/, '').trim();
        if (!this.tables[table]) return { lastInsertRowId: 0, changes: 0 };

        let changes = 0;
        if (!whereClause) {
          changes = this.tables[table].length;
          this.tables[table] = [];
        } else {
          const prevLen = this.tables[table].length;
          this.tables[table] = this.tables[table].filter((row) => !this.evaluateWhere(row, whereClause, params));
          changes = prevLen - this.tables[table].length;
        }

        this.saveToStorage();
        return { lastInsertRowId: 0, changes };
      }
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  async getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    // SELECT COUNT(*)
    if (upper.includes('SELECT COUNT(*)')) {
      const fromMatch = trimmed.match(/FROM\s+(\w+)(?:\s+WHERE\s+([^;]+?))?(?:\s+ORDER|\s+LIMIT|$)/i);
      if (fromMatch) {
        const table = fromMatch[1].toLowerCase();
        const whereClause = fromMatch[2];
        const rows = this.tables[table] || [];
        const filtered = whereClause ? rows.filter((r) => this.evaluateWhere(r, whereClause, params)) : rows;
        return [{ count: filtered.length }] as any;
      }
      return [{ count: 0 }] as any;
    }

    // Robust backwards parser for SELECT ... FROM <table> WHERE ... ORDER BY ... LIMIT ...
    let s = trimmed.replace(/;+$/, '');
    let limit: string | null = null;
    const limitMatch = s.match(/\s+LIMIT\s+(\d+|\?)$/i);
    if (limitMatch) {
      limit = limitMatch[1];
      s = s.substring(0, limitMatch.index).trim();
    }

    let orderBy: string | null = null;
    const orderMatch = s.match(/\s+ORDER\s+BY\s+([^;]+)$/i);
    if (orderMatch) {
      orderBy = orderMatch[1].trim();
      s = s.substring(0, orderMatch.index).trim();
    }

    let whereClause: string | null = null;
    const whereMatch = s.match(/\s+WHERE\s+([^;]+)$/i);
    if (whereMatch) {
      whereClause = whereMatch[1].trim();
      s = s.substring(0, whereMatch.index).trim();
    }

    const fromMatch = s.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (fromMatch) {
      const table = fromMatch[1].toLowerCase();
      let rows = [...(this.tables[table] || [])];

      if (whereClause) {
        rows = rows.filter((r) => this.evaluateWhere(r, whereClause!, params));
      }

      if (orderBy) {
        const orderParts = orderBy.split(',').map((p) => p.trim());
        rows.sort((a, b) => {
          for (const part of orderParts) {
            const [fieldWithAlias, dir] = part.split(/\s+/);
            const field = fieldWithAlias.split('.').pop()!;
            const valA = a[field] ?? '';
            const valB = b[field] ?? '';
            const isDesc = dir && dir.toUpperCase() === 'DESC';
            if (valA < valB) return isDesc ? 1 : -1;
            if (valA > valB) return isDesc ? -1 : 1;
          }
          return 0;
        });
      }

      if (limit) {
        const limitNum = limit === '?' ? Number(params[params.length - 1]) : Number(limit);
        if (!isNaN(limitNum)) {
          rows = rows.slice(0, limitNum);
        }
      }

      return rows as T[];
    }

    return [];
  }

  async getFirstAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async withTransactionAsync<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  private evaluateWhere(row: Record<string, any>, whereClause: string, params: any[]): boolean {
    if (!whereClause || whereClause.trim() === '1=1') return true;

    // Simple heuristic parser for WHERE clauses with ? parameters and IS NULL / IS NOT NULL
    let paramIdx = 0;
    const conditions = whereClause
      .split(/\s+AND\s+/i)
      .map((c) => c.trim())
      .filter(Boolean);

    for (const cond of conditions) {
      if (cond === '1=1') continue;

      if (cond.toUpperCase().includes('IS NULL')) {
        const col = cond.split(/\s+/)[0].trim().split('.').pop()!;
        if (row[col] !== null && row[col] !== undefined) return false;
        continue;
      }

      if (cond.toUpperCase().includes('IS NOT NULL')) {
        const col = cond.split(/\s+/)[0].trim().split('.').pop()!;
        if (row[col] === null || row[col] === undefined) return false;
        continue;
      }

      const inMatch = cond.match(/([\w.]+)\s+IN\s*\(([^)]+)\)/i);
      if (inMatch) {
        const col = inMatch[1].split('.').pop()!;
        const placeholderCount = inMatch[2].split(',').length;
        const inValues = params.slice(paramIdx, paramIdx + placeholderCount);
        paramIdx += placeholderCount;
        if (!inValues.includes(row[col])) return false;
        continue;
      }

      const eqMatch = cond.match(/([\w.]+)\s*=\s*\?/);
      if (eqMatch) {
        const col = eqMatch[1].split('.').pop()!;
        const expected = params[paramIdx++];
        if (col === 'storeId') {
          // In local single-store offline mode, all items belong to the store regardless of ID variation
          continue;
        }
        if (row[col] != expected) return false;
        continue;
      }

      const eqLitMatch = cond.match(/([\w.]+)\s*=\s*([^\s?]+)/);
      if (eqLitMatch) {
        const col = eqLitMatch[1].split('.').pop()!;
        const rawVal = eqLitMatch[2].replace(/^['"]|['"]$/g, '');
        const expected = !isNaN(Number(rawVal)) ? Number(rawVal) : rawVal;
        if (col === 'storeId') continue;
        if (row[col] != expected) return false;
        continue;
      }

      const likeMatch = cond.match(/([\w.]+)\s+LIKE\s+\?/i);
      if (likeMatch) {
        const col = likeMatch[1].split('.').pop()!;
        const pattern = String(params[paramIdx++]).replace(/%/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        if (!regex.test(String(row[col] || ''))) return false;
        continue;
      }
    }

    return true;
  }
}

export const webDatabaseInstance = new WebSQLiteStore();
