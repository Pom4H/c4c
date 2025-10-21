/**
 * Product procedures
 */

import { z } from "zod";
import type { Procedure } from "@c4c/core";
import { productDatabase } from "./database.js";

// List Products
export const listProducts: Procedure = {
  contract: {
    name: "products.list",
    description: "List all products with optional filters",
    input: z.object({
      category: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    }),
    output: z.object({
      products: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          price: z.number(),
          stock: z.number(),
          category: z.string(),
          createdAt: z.string(),
        })
      ),
      count: z.number(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "products",
      tags: ["products", "read"],
    },
  },
  handler: async ({ category, minPrice, maxPrice }) => {
    const products = await productDatabase.list({ category, minPrice, maxPrice });
    return {
      products,
      count: products.length,
    };
  },
};

// Get Product
export const getProduct: Procedure = {
  contract: {
    name: "products.get",
    description: "Get product by ID",
    input: z.object({
      id: z.string(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      price: z.number(),
      stock: z.number(),
      category: z.string(),
      createdAt: z.string(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "products",
      tags: ["products", "read"],
    },
  },
  handler: async ({ id }) => {
    const product = await productDatabase.findById(id);
    if (!product) {
      throw new Error(`Product not found: ${id}`);
    }
    return product;
  },
};

// Create Product
export const createProduct: Procedure = {
  contract: {
    name: "products.create",
    description: "Create a new product",
    input: z.object({
      name: z.string().min(1),
      description: z.string(),
      price: z.number().positive(),
      stock: z.number().int().min(0),
      category: z.string(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      price: z.number(),
      stock: z.number(),
      category: z.string(),
      createdAt: z.string(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "products",
      tags: ["products", "create"],
    },
  },
  handler: async (input) => {
    return await productDatabase.create(input);
  },
};

// Update Stock
export const updateProductStock: Procedure = {
  contract: {
    name: "products.updateStock",
    description: "Update product stock (add or remove quantity)",
    input: z.object({
      id: z.string(),
      quantity: z.number().int(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      stock: z.number(),
      previousStock: z.number(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "products",
      tags: ["products", "update", "inventory"],
    },
  },
  handler: async ({ id, quantity }) => {
    const product = await productDatabase.findById(id);
    if (!product) {
      throw new Error(`Product not found: ${id}`);
    }

    const previousStock = product.stock;
    const updated = await productDatabase.updateStock(id, quantity);

    if (!updated) {
      throw new Error("Failed to update stock");
    }

    return {
      id: updated.id,
      name: updated.name,
      stock: updated.stock,
      previousStock,
    };
  },
};
