import { db } from '../db/db';
import { Category } from '../types';
import { generateUUID } from '../utils/uuid';

export const DEFAULT_CATEGORIES: string[] = [
  'Food',
  'Travel',
  'Rent',
  'Bills',
  'Shopping',
  'Medical',
  'Family',
  'Coffee/Snacks',
  'Entertainment',
  'EMI/Loan',
  'Subscription',
  'Other',
];

const MAX_CATEGORY_NAME_LENGTH = 50;

let categorySeedingPromise: Promise<void> | null = null;

function validateCategoryName(name: string): string {
  if (typeof name !== 'string') {
    throw new Error('Category name must be a valid text string.');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Category name cannot be empty.');
  }
  if (trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new Error(`Category name cannot exceed ${MAX_CATEGORY_NAME_LENGTH} characters.`);
  }
  return trimmed;
}

export const categoryRepository = {
  /**
   * Idempotently seeds default categories if none exist in the database.
   */
  async ensureDefaults(): Promise<void> {
    if (categorySeedingPromise) {
      return categorySeedingPromise;
    }

    categorySeedingPromise = (async () => {
      try {
        const count = await db.categories.count();
        if (count === 0) {
          const now = new Date().toISOString();
          const initialCategories: Category[] = DEFAULT_CATEGORIES.map((catName) => ({
            id: generateUUID(),
            name: catName,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          }));
          await db.categories.bulkAdd(initialCategories);
        }
      } catch (err) {
        categorySeedingPromise = null;
        throw err;
      }
    })();

    return categorySeedingPromise;
  },

  /**
   * Retrieves all categories (both active and inactive).
   */
  async getCategories(): Promise<Category[]> {
    return db.categories.toArray();
  },

  /**
   * Retrieves only active categories.
   */
  async getActiveCategories(): Promise<Category[]> {
    const all = await db.categories.toArray();
    return all.filter((cat) => cat.isActive);
  },

  /**
   * Adds a new category.
   * Throws if name is empty, exceeds max length, or already exists case-insensitively.
   */
  async addCategory(name: string): Promise<Category> {
    await this.ensureDefaults();
    const trimmed = validateCategoryName(name);

    const all = await db.categories.toArray();
    const duplicate = all.find(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Category "${trimmed}" already exists.`);
    }

    const now = new Date().toISOString();
    const newCategory: Category = {
      id: generateUUID(),
      name: trimmed,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.categories.add(newCategory);
    return newCategory;
  },

  /**
   * Renames an existing category.
   * Throws if not found or if the new name clashes case-insensitively with another category.
   */
  async updateCategory(id: string, name: string): Promise<Category> {
    await this.ensureDefaults();
    const trimmed = validateCategoryName(name);

    const existing = await db.categories.get(id);
    if (!existing) {
      throw new Error(`Category with ID ${id} not found.`);
    }

    const all = await db.categories.toArray();
    const duplicate = all.find(
      (c) => c.id !== id && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A category named "${trimmed}" already exists.`);
    }

    const now = new Date().toISOString();
    const updated: Category = {
      ...existing,
      name: trimmed,
      updatedAt: now,
    };

    await db.categories.put(updated);
    return updated;
  },

  /**
   * Deactivates a category (soft delete to preserve historical integrity).
   */
  async deactivateCategory(id: string): Promise<void> {
    await this.ensureDefaults();
    const existing = await db.categories.get(id);
    if (!existing) {
      throw new Error(`Category with ID ${id} not found.`);
    }

    await db.categories.update(id, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Reactivates a previously deactivated category.
   */
  async reactivateCategory(id: string): Promise<void> {
    await this.ensureDefaults();
    const existing = await db.categories.get(id);
    if (!existing) {
      throw new Error(`Category with ID ${id} not found.`);
    }

    await db.categories.update(id, {
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
  },
};
