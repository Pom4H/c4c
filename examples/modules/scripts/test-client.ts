#!/usr/bin/env node
/**
 * Test client script
 * Demonstrates using the generated client to interact with the API
 */

import { createc4cClient } from "../generated/client.js";

async function main() {
  console.log("🚀 Testing c4c Client\n");
  console.log("📡 Connecting to http://localhost:3000\n");

  // Create client instance
  const client = createc4cClient({
    baseUrl: "http://localhost:3000",
  });

  try {
    // Test 1: Create users
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📝 Test 1: Creating users...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const user1 = await client.procedures["users.create"]({
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "admin",
    });
    console.log("✅ Created user:", user1);

    const user2 = await client.procedures["users.create"]({
      name: "Bob Smith",
      email: "bob@example.com",
      role: "user",
    });
    console.log("✅ Created user:", user2);

    const user3 = await client.procedures["users.create"]({
      name: "Charlie Brown",
      email: "charlie@example.com",
      role: "moderator",
    });
    console.log("✅ Created user:", user3);

    // Test 2: List users
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 Test 2: Listing users...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const usersList = await client.procedures["users.list"]({});
    console.log(`✅ Found ${usersList.count} users:`);
    for (const user of usersList.users) {
      console.log(`   - ${user.name} (${user.email}) - ${user.role}`);
    }

    // Test 3: Get specific user
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 Test 3: Getting specific user...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const fetchedUser = await client.procedures["users.get"]({ id: user1.id });
    console.log("✅ Fetched user:", fetchedUser);

    // Test 4: Update user
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✏️  Test 4: Updating user...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const updatedUser = await client.procedures["users.update"]({
      id: user2.id,
      name: "Bob Smith Jr.",
      role: "admin",
    });
    console.log("✅ Updated user:", updatedUser);

    // Test 5: List products
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🛒 Test 5: Listing products...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const productsList = await client.procedures["products.list"]({});
    console.log(`✅ Found ${productsList.count} products:`);
    for (const product of productsList.products) {
      console.log(`   - ${product.name}: $${product.price} (Stock: ${product.stock})`);
    }

    // Test 6: Filter products by category
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 Test 6: Filtering products by category...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const electronicsProducts = await client.procedures["products.list"]({
      category: "electronics",
    });
    console.log(`✅ Found ${electronicsProducts.count} electronics products`);

    // Test 7: Create new product
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("➕ Test 7: Creating new product...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const newProduct = await client.procedures["products.create"]({
      name: "Monitor",
      description: "4K Ultra HD Monitor",
      price: 399.99,
      stock: 15,
      category: "electronics",
    });
    console.log("✅ Created product:", newProduct);

    // Test 8: Update product stock
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 Test 8: Updating product stock...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const stockUpdate = await client.procedures["products.updateStock"]({
      id: newProduct.id,
      quantity: -5, // Sell 5 units
    });
    console.log("✅ Stock updated:");
    console.log(`   Previous: ${stockUpdate.previousStock}`);
    console.log(`   Current: ${stockUpdate.stock}`);

    // Test 9: Get analytics
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Test 9: Getting system analytics...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const stats = await client.procedures["analytics.stats"]({});
    console.log("✅ System statistics:");
    console.log(`   Total users: ${stats.users.total}`);
    console.log(`   Users by role:`, stats.users.byRole);
    console.log(`   Total products: ${stats.products.total}`);
    console.log(`   Total inventory value: $${stats.products.totalValue.toFixed(2)}`);
    console.log(`   Products by category:`, stats.products.byCategory);

    // Test 10: Health check
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🏥 Test 10: Health check...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const health = await client.procedures["analytics.health"]({});
    console.log("✅ Health check result:");
    console.log(`   Status: ${health.status}`);
    console.log(`   Uptime: ${health.uptime.toFixed(2)}s`);
    console.log(`   Services:`, health.services);

    // Test 11: Delete user
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🗑️  Test 11: Deleting user...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const deleteResult = await client.procedures["users.delete"]({ id: user3.id });
    console.log("✅ User deleted:", deleteResult);

    // Final stats
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 All tests completed successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const finalStats = await client.procedures["analytics.stats"]({});
    console.log("📊 Final system state:");
    console.log(`   Total users: ${finalStats.users.total}`);
    console.log(`   Total products: ${finalStats.products.total}`);
    console.log(`   Total inventory value: $${finalStats.products.totalValue.toFixed(2)}\n`);

  } catch (error) {
    console.error("\n❌ Error during testing:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
