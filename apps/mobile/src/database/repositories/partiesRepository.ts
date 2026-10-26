import { v4 as uuidv4 } from '../../utils/uuid.js';
import { Supplier, Customer, Expense } from '@hardware-store/shared';
import { getDatabase } from '../db.js';
import { SyncQueueRepository } from './syncQueueRepository.js';

export class PartiesRepository {
  // Suppliers
  static async getSuppliers(storeId: string): Promise<Supplier[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM suppliers WHERE storeId = ? AND deletedAt IS NULL ORDER BY name ASC;`,
      [storeId]
    );
    return rows.map((r) => ({ ...r, active: Boolean(r.active) }));
  }

  static async createSupplier(
    data: Partial<Supplier>,
    storeId: string,
    deviceId: string
  ): Promise<Supplier> {
    const db = await getDatabase();
    const id = data.id || uuidv4();
    const now = new Date().toISOString();

    const supplier: Supplier = {
      id,
      storeId,
      name: data.name!,
      businessName: data.businessName,
      phone: data.phone!,
      alternatePhone: data.alternatePhone,
      email: data.email,
      address: data.address,
      gstin: data.gstin,
      notes: data.notes,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO suppliers (id, storeId, name, businessName, phone, alternatePhone, email, address, gstin, notes, active, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
      [
        id,
        storeId,
        supplier.name,
        supplier.businessName ?? null,
        supplier.phone,
        supplier.alternatePhone ?? null,
        supplier.email ?? null,
        supplier.address ?? null,
        supplier.gstin ?? null,
        supplier.notes ?? null,
        now,
        now,
      ]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'supplier',
      id,
      'create',
      supplier as unknown as Record<string, unknown>
    );

    return supplier;
  }

  // Customers
  static async getCustomers(storeId: string): Promise<Customer[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM customers WHERE storeId = ? AND deletedAt IS NULL ORDER BY name ASC;`,
      [storeId]
    );
    return rows.map((r) => ({ ...r, active: Boolean(r.active) }));
  }

  static async createCustomer(
    data: Partial<Customer>,
    storeId: string,
    deviceId: string
  ): Promise<Customer> {
    const db = await getDatabase();
    const id = data.id || uuidv4();
    const now = new Date().toISOString();

    const customer: Customer = {
      id,
      storeId,
      name: data.name!,
      phone: data.phone,
      address: data.address,
      businessName: data.businessName,
      gstin: data.gstin,
      notes: data.notes,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO customers (id, storeId, name, phone, address, businessName, gstin, notes, active, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
      [
        id,
        storeId,
        customer.name,
        customer.phone ?? null,
        customer.address ?? null,
        customer.businessName ?? null,
        customer.gstin ?? null,
        customer.notes ?? null,
        now,
        now,
      ]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'customer',
      id,
      'create',
      customer as unknown as Record<string, unknown>
    );

    return customer;
  }
}

export class ExpensesRepository {
  static async getExpenses(storeId: string, limit = 50): Promise<Expense[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM expenses WHERE storeId = ? ORDER BY date DESC LIMIT ?;`,
      [storeId, limit]
    );
    return rows;
  }

  static async createExpense(
    data: Partial<Expense>,
    storeId: string,
    deviceId: string
  ): Promise<Expense> {
    const db = await getDatabase();
    const id = data.id || uuidv4();
    const now = new Date().toISOString();

    const expense: Expense = {
      id,
      storeId,
      category: data.category!,
      amountPaise: data.amountPaise!,
      date: data.date || now,
      paymentMethod: data.paymentMethod || 'cash',
      description: data.description!,
      reference: data.reference,
      createdAt: now,
    };

    await db.runAsync(
      `INSERT INTO expenses (id, storeId, category, amountPaise, date, paymentMethod, description, reference, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        storeId,
        expense.category,
        expense.amountPaise,
        expense.date,
        expense.paymentMethod,
        expense.description,
        expense.reference ?? null,
        now,
      ]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'expense',
      id,
      'create',
      expense as unknown as Record<string, unknown>
    );

    return expense;
  }
}
