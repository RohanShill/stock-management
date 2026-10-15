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

const STORAGE_KEY = 'hw_store_local_db_v1';

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
          // Ensure electrical category and its subcategories are removed
          this.tables.categories = this.tables.categories.filter(
            (c: any) => c.name.toLowerCase() !== 'electrical' && c.id !== 'cat-electrical'
          );
          this.tables.subcategories = this.tables.subcategories.filter(
            (s: any) => s.categoryId !== 'cat-electrical' && s.id !== 'sub-wires'
          );
          this.tables.custom_field_definitions = this.tables.custom_field_definitions.filter(
            (f: any) => f.id !== 'cf-wire-gauge' && f.targetId !== 'cat-electrical' && f.targetId !== 'sub-wires'
          );
          if (this.tables.stores[0]) {
            this.tables.stores[0].name = 'Manju Store Management';
            this.tables.stores[0].email = 'store@manjustore.in';
          }
          // If previous storage had fewer demo products/categories, refresh demo data
          if (this.tables.products.length < 8 || this.tables.categories.length < 5) {
            this.tables.categories = [];
            this.tables.subcategories = [];
            this.tables.products = [];
            this.tables.product_variants = [];
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
        name: 'Manju Store Management',
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
      const toolsId = 'cat-tools';
      const sanitaryId = 'cat-sanitary';
      const buildingId = 'cat-building';

      this.tables.categories.push(
        {
          id: plumbingId,
          storeId: 'store-1',
          name: 'Plumbing',
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
          name: 'Paints & Primers',
          description: 'Wall paints, primers, brushes, thinners',
          icon: 'brush',
          displayOrder: 2,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: toolsId,
          storeId: 'store-1',
          name: 'Tools & Fasteners',
          description: 'Power tools, hand tools, screws, bolts',
          icon: 'hammer',
          displayOrder: 3,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: sanitaryId,
          storeId: 'store-1',
          name: 'Sanitaryware & Bath',
          description: 'Taps, faucets, showers, valves, bathroom fittings',
          icon: 'shower',
          displayOrder: 4,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: buildingId,
          storeId: 'store-1',
          name: 'Building & Adhesives',
          description: 'Wood glue, sealants, cement additives, hardware fittings',
          icon: 'home',
          displayOrder: 5,
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      const subCpvcId = 'sub-cpvc';
      const subPvcFittingsId = 'sub-pvc';
      const subEmulsionId = 'sub-paints-emulsion';
      const subWaterproofId = 'sub-paints-waterproofing';
      const subHandToolsId = 'sub-tools-hand';
      const subFastenersId = 'sub-tools-fasteners';
      const subTapsId = 'sub-sanitary-taps';
      const subAdhesivesId = 'sub-building-adhesives';

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
        },
        {
          id: subHandToolsId,
          storeId: 'store-1',
          categoryId: toolsId,
          name: 'Hand & Power Tools',
          description: 'Drills, pliers, spanners, hammers',
          displayOrder: 1,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: subFastenersId,
          storeId: 'store-1',
          categoryId: toolsId,
          name: 'Screws, Bolts & Anchors',
          description: 'Drywall screws, hex bolts, wall plugs',
          displayOrder: 2,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: subTapsId,
          storeId: 'store-1',
          categoryId: sanitaryId,
          name: 'Brass & PTMT Faucets',
          description: 'Bib cocks, pillar taps, shower heads',
          displayOrder: 1,
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: subAdhesivesId,
          storeId: 'store-1',
          categoryId: buildingId,
          name: 'Adhesives & Sealants',
          description: 'Wood resin, M-Seal, silicone sealants',
          displayOrder: 1,
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      // Seed sample custom field definition
      this.tables.custom_field_definitions.push({
        id: 'cf-pressure',
        storeId: 'store-1',
        targetLevel: 'subcategory',
        targetId: subCpvcId,
        name: 'pressure_rating',
        label: 'Pressure Rating (SDR)',
        fieldType: 'dropdown',
        options: JSON.stringify(['SDR 11', 'SDR 13.5', 'SCH 40', 'SCH 80']),
        unit: 'PSI',
        required: 1,
        displayOrder: 1,
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      // --- 1. PLUMBING PRODUCTS ---
      const prodPipeId = 'prod-cpvc-astral';
      this.tables.products.push({
        id: prodPipeId,
        storeId: 'store-1',
        categoryId: plumbingId,
        subcategoryId: subCpvcId,
        name: 'Astral CPVC Pro Pipe',
        brand: 'Astral',
        material: 'CPVC',
        description: 'SDR 11 Hot and Cold Water plumbing pipe 3m standard length',
        modelNumber: 'AST-CPVC-01',
        measurementType: 'length',
        baseUnit: 'm',
        allowedUnits: JSON.stringify(['m', 'mm', 'ft']),
        packMultiplier: 1,
        pipeDiameterMm: 25,
        standardLengthMm: 3000,
        pipeTrackingMethod: 'aggregate',
        customValues: JSON.stringify({ pressure_rating: 'SDR 11' }),
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-cpvc-20mm',
          storeId: 'store-1',
          productId: prodPipeId,
          name: 'Astral CPVC Pro Pipe 20mm (3/4")',
          sku: 'AST-CPVC-20',
          size: '20 mm',
          purchasePricePaise: 24000, // ₹240
          sellingPricePaise: 31000, // ₹310
          taxRatePercent: 18,
          minStockLevel: 15,
          openingStock: 60, // 60 metres
          currentStock: 60,
          rackLocation: 'Rack P-01',
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'var-cpvc-25mm',
          storeId: 'store-1',
          productId: prodPipeId,
          name: 'Astral CPVC Pro Pipe 25mm (1")',
          sku: 'AST-CPVC-25',
          size: '25 mm',
          purchasePricePaise: 36000, // ₹360
          sellingPricePaise: 45000, // ₹450
          taxRatePercent: 18,
          minStockLevel: 10,
          openingStock: 45, // 45 metres
          currentStock: 45,
          rackLocation: 'Rack P-02',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      const prodElbowId = 'prod-pvc-elbow';
      this.tables.products.push({
        id: prodElbowId,
        storeId: 'store-1',
        categoryId: plumbingId,
        subcategoryId: subPvcFittingsId,
        name: 'Supreme Brass Elbow 90°',
        brand: 'Supreme',
        material: 'PVC / Brass',
        description: 'Heavy brass threaded 90 degree elbow for pipe joints',
        modelNumber: 'SUP-ELB-90',
        measurementType: 'count',
        baseUnit: 'piece',
        allowedUnits: JSON.stringify(['piece']),
        packMultiplier: 1,
        pipeTrackingMethod: 'aggregate',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-elbow-25mm',
          storeId: 'store-1',
          productId: prodElbowId,
          name: 'Supreme Brass Elbow 25mm × 1/2"',
          sku: 'SUP-ELB-25B',
          size: '25 mm × 1/2"',
          purchasePricePaise: 5500, // ₹55
          sellingPricePaise: 7500, // ₹75
          taxRatePercent: 18,
          minStockLevel: 20,
          openingStock: 0,
          currentStock: 0,
          rackLocation: 'Bin B-12',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      // --- 2. PAINTS & PRIMERS PRODUCTS ---
      const prodApexId = 'prod-paint-apex';
      this.tables.products.push({
        id: prodApexId,
        storeId: 'store-1',
        categoryId: paintsId,
        subcategoryId: subEmulsionId,
        name: 'Asian Paints Apex Ultima',
        brand: 'Asian Paints',
        material: 'Acrylic Emulsion',
        description: 'Advanced anti-algal exterior emulsion with colour stay technology',
        modelNumber: 'AP-APEX-ULT',
        measurementType: 'volume',
        baseUnit: 'litre',
        allowedUnits: JSON.stringify(['litre', 'ml']),
        packMultiplier: 1,
        pipeTrackingMethod: 'aggregate',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-apex-4l',
          storeId: 'store-1',
          productId: prodApexId,
          name: 'Asian Paints Apex Ultima (4 Litre)',
          sku: 'AP-APEX-4L',
          size: '4 Litre White',
          purchasePricePaise: 115000, // ₹1,150
          sellingPricePaise: 145000, // ₹1,450
          taxRatePercent: 18,
          minStockLevel: 5,
          openingStock: 16,
          currentStock: 16,
          rackLocation: 'Paint Bay A-2',
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'var-apex-10l',
          storeId: 'store-1',
          productId: prodApexId,
          name: 'Asian Paints Apex Ultima (10 Litre)',
          sku: 'AP-APEX-10L',
          size: '10 Litre White',
          purchasePricePaise: 260000, // ₹2,600
          sellingPricePaise: 320000, // ₹3,200
          taxRatePercent: 18,
          minStockLevel: 3,
          openingStock: 8,
          currentStock: 8,
          rackLocation: 'Paint Bay A-3',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      const prodDrFixitId = 'prod-dr-fixit';
      this.tables.products.push({
        id: prodDrFixitId,
        storeId: 'store-1',
        categoryId: paintsId,
        subcategoryId: subWaterproofId,
        name: 'Dr. Fixit 101 LW+ Waterproofing',
        brand: 'Dr. Fixit',
        material: 'Liquid Polymer',
        description: 'Integral liquid waterproofing compound for plaster and concrete',
        modelNumber: 'DF-101-LW',
        measurementType: 'volume',
        baseUnit: 'litre',
        allowedUnits: JSON.stringify(['litre']),
        packMultiplier: 1,
        pipeTrackingMethod: 'aggregate',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-drfixit-1l',
          storeId: 'store-1',
          productId: prodDrFixitId,
          name: 'Dr. Fixit 101 LW+ (1 Litre Bottle)',
          sku: 'DF-101-1L',
          size: '1 Litre',
          purchasePricePaise: 14000, // ₹140
          sellingPricePaise: 18500, // ₹185
          taxRatePercent: 18,
          minStockLevel: 10,
          openingStock: 35,
          currentStock: 35,
          rackLocation: 'Shelf W-1',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      // --- 3. TOOLS & FASTENERS PRODUCTS ---
      const prodDrillId = 'prod-tool-bosch-drill';
      this.tables.products.push({
        id: prodDrillId,
        storeId: 'store-1',
        categoryId: toolsId,
        subcategoryId: subHandToolsId,
        name: 'Bosch GSB 500W Impact Drill',
        brand: 'Bosch',
        material: 'High Impact Polycarbonate',
        description: '500 Watt professional electric impact drill with reverse function',
        modelNumber: 'GSB-500-RE',
        measurementType: 'count',
        baseUnit: 'piece',
        allowedUnits: JSON.stringify(['piece']),
        packMultiplier: 1,
        pipeTrackingMethod: 'aggregate',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-bosch-500w',
          storeId: 'store-1',
          productId: prodDrillId,
          name: 'Bosch GSB 500W Kit with Key',
          sku: 'BSH-GSB-500',
          size: '10mm Chuck Kit',
          purchasePricePaise: 285000, // ₹2,850
          sellingPricePaise: 349900, // ₹3,499
          taxRatePercent: 18,
          minStockLevel: 3,
          openingStock: 1,
          currentStock: 1,
          rackLocation: 'Tools Showcase T-1',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      const prodPlierId = 'prod-tool-taparia-plier';
      this.tables.products.push({
        id: prodPlierId,
        storeId: 'store-1',
        categoryId: toolsId,
        subcategoryId: subHandToolsId,
        name: 'Taparia 8" Combination Plier',
        brand: 'Taparia',
        material: 'Drop Forged Carbon Steel',
        description: 'Heavy duty insulated combination plier with wire cutter',
        modelNumber: 'TAP-1621-8',
        measurementType: 'count',
        baseUnit: 'piece',
        allowedUnits: JSON.stringify(['piece']),
        packMultiplier: 1,
        pipeTrackingMethod: 'aggregate',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-taparia-8inch',
          storeId: 'store-1',
          productId: prodPlierId,
          name: 'Taparia 8" Insulated Plier',
          sku: 'TAP-PLIER-8',
          size: '8 Inch (200mm)',
          purchasePricePaise: 19500, // ₹195
          sellingPricePaise: 26000, // ₹260
          taxRatePercent: 18,
          minStockLevel: 5,
          openingStock: 25,
          currentStock: 25,
          rackLocation: 'Tools Wall H-4',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      const prodScrewsId = 'prod-hilti-screws';
      this.tables.products.push({
        id: prodScrewsId,
        storeId: 'store-1',
        categoryId: toolsId,
        subcategoryId: subFastenersId,
        name: 'Hilti Drywall Screws',
        brand: 'Hilti',
        material: 'Black Phosphated Steel',
        description: 'Bugle head coarse thread self-tapping screws',
        modelNumber: 'HLT-DWS-BOX',
        measurementType: 'pack',
        baseUnit: 'pack',
        allowedUnits: JSON.stringify(['pack']),
        packMultiplier: 1,
        pipeTrackingMethod: 'aggregate',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-hilti-15inch',
          storeId: 'store-1',
          productId: prodScrewsId,
          name: 'Hilti 1.5" Screws (Box of 1000)',
          sku: 'HLT-SCRW-15B',
          size: '1.5 Inch (1000 pcs)',
          purchasePricePaise: 29000, // ₹290
          sellingPricePaise: 38000, // ₹380
          taxRatePercent: 18,
          minStockLevel: 5,
          openingStock: 2,
          currentStock: 2,
          rackLocation: 'Fastener Bin F-03',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      // --- 4. SANITARYWARE & BATH PRODUCTS ---
      const prodJaquarId = 'prod-jaquar-tap';
      this.tables.products.push({
        id: prodJaquarId,
        storeId: 'store-1',
        categoryId: sanitaryId,
        subcategoryId: subTapsId,
        name: 'Jaquar Continental Brass Bib Cock',
        brand: 'Jaquar',
        material: 'Solid Brass Chrome Plated',
        description: 'Premium quarter turn water bib cock tap with wall flange',
        modelNumber: 'CON-CHR-047',
        measurementType: 'count',
        baseUnit: 'piece',
        allowedUnits: JSON.stringify(['piece']),
        packMultiplier: 1,
        pipeTrackingMethod: 'aggregate',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-jaquar-longbody',
          storeId: 'store-1',
          productId: prodJaquarId,
          name: 'Jaquar Continental Long Body Bib Cock',
          sku: 'JAQ-CON-LB',
          size: '1/2" Long Body',
          purchasePricePaise: 51000, // ₹510
          sellingPricePaise: 65000, // ₹650
          taxRatePercent: 18,
          minStockLevel: 5,
          openingStock: 18,
          currentStock: 18,
          rackLocation: 'Sanitary Display S-2',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      // --- 5. BUILDING & ADHESIVES PRODUCTS ---
      const prodFevicolId = 'prod-fevicol-sh';
      this.tables.products.push({
        id: prodFevicolId,
        storeId: 'store-1',
        categoryId: buildingId,
        subcategoryId: subAdhesivesId,
        name: 'Fevicol SH Wood Adhesive',
        brand: 'Pidilite',
        material: 'Synthetic Resin',
        description: 'Supreme bonding strength water resistant wood glue',
        modelNumber: 'PID-FEV-SH',
        measurementType: 'weight',
        baseUnit: 'kg',
        allowedUnits: JSON.stringify(['kg', 'g']),
        packMultiplier: 1,
        pipeTrackingMethod: 'aggregate',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-fevicol-1kg',
          storeId: 'store-1',
          productId: prodFevicolId,
          name: 'Fevicol SH (1 Kg Tub)',
          sku: 'PID-FEV-1KG',
          size: '1 Kg Tub',
          purchasePricePaise: 18500, // ₹185
          sellingPricePaise: 24000, // ₹240
          taxRatePercent: 18,
          minStockLevel: 10,
          openingStock: 40,
          currentStock: 40,
          rackLocation: 'Adhesive Bay G-1',
          active: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'var-fevicol-5kg',
          storeId: 'store-1',
          productId: prodFevicolId,
          name: 'Fevicol SH (5 Kg Bucket)',
          sku: 'PID-FEV-5KG',
          size: '5 Kg Bucket',
          purchasePricePaise: 82000, // ₹820
          sellingPricePaise: 105000, // ₹1,050
          taxRatePercent: 18,
          minStockLevel: 4,
          openingStock: 12,
          currentStock: 12,
          rackLocation: 'Adhesive Bay G-2',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      const prodMsealId = 'prod-mseal-pack';
      this.tables.products.push({
        id: prodMsealId,
        storeId: 'store-1',
        categoryId: buildingId,
        subcategoryId: subAdhesivesId,
        name: 'Pidilite M-Seal Epoxy Putty',
        brand: 'Pidilite',
        material: 'Epoxy Compound',
        description: 'Multi-purpose sealant for plumbing leaks, joining, and sealing',
        modelNumber: 'PID-MSEAL-100',
        measurementType: 'pack',
        baseUnit: 'pack',
        allowedUnits: JSON.stringify(['pack']),
        packMultiplier: 1,
        pipeTrackingMethod: 'aggregate',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.product_variants.push(
        {
          id: 'var-mseal-100g',
          storeId: 'store-1',
          productId: prodMsealId,
          name: 'Pidilite M-Seal 100g Pack',
          sku: 'PID-MSEAL-100',
          size: '100g (Pack of 10)',
          purchasePricePaise: 9000, // ₹90
          sellingPricePaise: 12000, // ₹120
          taxRatePercent: 18,
          minStockLevel: 10,
          openingStock: 50,
          currentStock: 50,
          rackLocation: 'Counter Rack C-01',
          active: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      // Seed sample supplier and customer
      this.tables.suppliers.push({
        id: 'sup-1',
        storeId: 'store-1',
        name: 'Vikas Distributors',
        businessName: 'Vikas Pipes & Sanitation Wholesale',
        phone: '9811223344',
        address: 'Khari Baoli, Wholesale Market, Delhi',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      this.tables.customers.push({
        id: 'cust-1',
        storeId: 'store-1',
        name: 'Mohan Plumbing Works',
        phone: '9899887766',
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

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
        const row: Record<string, any> = {};
        cols.forEach((col, idx) => {
          row[col] = params[idx] !== undefined ? params[idx] : null;
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
        const whereClause = updateMatch[3];

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
            setMap[col] = params[paramIdx++];
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
        const whereClause = deleteMatch[2];
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

    // Standard SELECT * FROM <table> WHERE ...
    const selectMatch = trimmed.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([^;]+?))?(?:\s+ORDER\s+BY\s+([^;]+?))?(?:\s+LIMIT\s+(\d+|\?))?/i);
    if (selectMatch) {
      const table = selectMatch[2].toLowerCase();
      const whereClause = selectMatch[3];
      const orderBy = selectMatch[4];
      const limit = selectMatch[5];

      let rows = [...(this.tables[table] || [])];

      if (whereClause) {
        rows = rows.filter((r) => this.evaluateWhere(r, whereClause, params));
      }

      if (orderBy) {
        const orderParts = orderBy.split(',').map((p) => p.trim());
        rows.sort((a, b) => {
          for (const part of orderParts) {
            const [field, dir] = part.split(/\s+/);
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
        const col = cond.split(/\s+/)[0].trim();
        if (row[col] !== null && row[col] !== undefined) return false;
        continue;
      }

      if (cond.toUpperCase().includes('IS NOT NULL')) {
        const col = cond.split(/\s+/)[0].trim();
        if (row[col] === null || row[col] === undefined) return false;
        continue;
      }

      const inMatch = cond.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
      if (inMatch) {
        const col = inMatch[1];
        const placeholderCount = inMatch[2].split(',').length;
        const inValues = params.slice(paramIdx, paramIdx + placeholderCount);
        paramIdx += placeholderCount;
        if (!inValues.includes(row[col])) return false;
        continue;
      }

      const eqMatch = cond.match(/(\w+)\s*=\s*\?/);
      if (eqMatch) {
        const col = eqMatch[1];
        const expected = params[paramIdx++];
        if (col === 'storeId' && (expected === 'default-store' || expected === 'store-1')) {
          if (row[col] !== 'default-store' && row[col] !== 'store-1') return false;
          continue;
        }
        if (row[col] != expected) return false;
        continue;
      }

      const likeMatch = cond.match(/(\w+)\s+LIKE\s+\?/i);
      if (likeMatch) {
        const col = likeMatch[1];
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
