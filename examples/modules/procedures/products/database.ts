/**
 * Simulated database module for products
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  createdAt: string;
}

const products = new Map<string, Product>();

// Seed some initial data
const initialProducts: Omit<Product, "id" | "createdAt">[] = [
  { name: "Laptop", description: "High-performance laptop", price: 999.99, stock: 10, category: "electronics" },
  { name: "Mouse", description: "Wireless mouse", price: 29.99, stock: 50, category: "electronics" },
  { name: "Keyboard", description: "Mechanical keyboard", price: 79.99, stock: 30, category: "electronics" },
];

for (const product of initialProducts) {
  const id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  products.set(id, {
    id,
    ...product,
    createdAt: new Date().toISOString(),
  });
}

export const productDatabase = {
  async create(data: Omit<Product, "id" | "createdAt">): Promise<Product> {
    const id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const product: Product = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
    };
    products.set(id, product);
    return product;
  },

  async findById(id: string): Promise<Product | null> {
    return products.get(id) ?? null;
  },

  async list(filter?: { category?: string; minPrice?: number; maxPrice?: number }): Promise<Product[]> {
    let result = Array.from(products.values());

    if (filter?.category) {
      result = result.filter((p) => p.category === filter.category);
    }

    if (filter?.minPrice !== undefined) {
      result = result.filter((p) => p.price >= filter.minPrice!);
    }

    if (filter?.maxPrice !== undefined) {
      result = result.filter((p) => p.price <= filter.maxPrice!);
    }

    return result;
  },

  async update(id: string, data: Partial<Omit<Product, "id" | "createdAt">>): Promise<Product | null> {
    const product = products.get(id);
    if (!product) return null;

    const updated = { ...product, ...data };
    products.set(id, updated);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    return products.delete(id);
  },

  async updateStock(id: string, quantity: number): Promise<Product | null> {
    const product = products.get(id);
    if (!product) return null;

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new Error("Insufficient stock");
    }

    const updated = { ...product, stock: newStock };
    products.set(id, updated);
    return updated;
  },
};
