/**
 * Analytics procedures
 * Demonstrates cross-module operations
 */

import { z } from "zod";
import type { Procedure } from "@c4c/core";
import { userDatabase } from "../users/database.js";
import { productDatabase } from "../products/database.js";

// Get System Stats
export const getSystemStats: Procedure = {
  contract: {
    name: "analytics.stats",
    description: "Get system-wide statistics",
    input: z.object({}),
    output: z.object({
      users: z.object({
        total: z.number(),
        byRole: z.record(z.string(), z.number()),
      }),
      products: z.object({
        total: z.number(),
        totalValue: z.number(),
        byCategory: z.record(z.string(), z.number()),
      }),
      timestamp: z.string(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "analytics",
      tags: ["analytics", "stats"],
    },
  },
  handler: async () => {
    // Get user stats
    const users = await userDatabase.list();
    const usersByRole: Record<string, number> = {};
    for (const user of users) {
      usersByRole[user.role] = (usersByRole[user.role] || 0) + 1;
    }

    // Get product stats
    const products = await productDatabase.list();
    const productsByCategory: Record<string, number> = {};
    let totalValue = 0;

    for (const product of products) {
      productsByCategory[product.category] = (productsByCategory[product.category] || 0) + 1;
      totalValue += product.price * product.stock;
    }

    return {
      users: {
        total: users.length,
        byRole: usersByRole,
      },
      products: {
        total: products.length,
        totalValue,
        byCategory: productsByCategory,
      },
      timestamp: new Date().toISOString(),
    };
  },
};

// Health Check
export const healthCheck: Procedure = {
  contract: {
    name: "analytics.health",
    description: "System health check",
    input: z.object({}),
    output: z.object({
      status: z.string(),
      uptime: z.number(),
      timestamp: z.string(),
      services: z.object({
        users: z.string(),
        products: z.string(),
      }),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "analytics",
      tags: ["health", "monitoring"],
    },
  },
  handler: async () => {
    const startTime = Date.now();

    // Test user service
    let usersStatus = "ok";
    try {
      await userDatabase.count();
    } catch {
      usersStatus = "error";
    }

    // Test product service
    let productsStatus = "ok";
    try {
      await productDatabase.list();
    } catch {
      productsStatus = "error";
    }

    return {
      status: usersStatus === "ok" && productsStatus === "ok" ? "healthy" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        users: usersStatus,
        products: productsStatus,
      },
    };
  },
};
