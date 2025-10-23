#!/usr/bin/env node
/**
 * Test client script with new API
 * Demonstrates using client.method() instead of client.procedures.method()
 */

import { createClient } from "../generated/client.js";

async function main() {
  console.log("🚀 Testing c4c Client (New API)\n");
  console.log("📡 Connecting to http://localhost:3456\n");

  // Create client instance
  const client = createClient({
    baseUrl: "http://localhost:3456",
  });

  try {
    // Test 1: Create users (new simplified API)
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📝 Test 1: Creating users...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const user1 = await client.usersCreate({
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "admin",
    });
    console.log("✅ Created user:", user1);

    const user2 = await client.usersCreate({
      name: "Bob Smith",
      email: "bob@example.com",
      role: "user",
    });
    console.log("✅ Created user:", user2);

    // Test 2: List users
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 Test 2: Listing users...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const usersList = await client.usersList({});
    console.log(`✅ Found ${usersList.count} users:`);
    for (const user of usersList.users) {
      console.log(`   - ${user.name} (${user.email}) - ${user.role}`);
    }

    // Test 3: Get specific user
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 Test 3: Getting specific user...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const fetchedUser = await client.usersGet({ id: user1.id });
    console.log("✅ Fetched user:", fetchedUser);

    // Test 4: Update user
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✏️  Test 4: Updating user...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const updatedUser = await client.usersUpdate({
      id: user2.id,
      name: "Bob Smith Jr.",
      role: "admin",
    });
    console.log("✅ Updated user:", updatedUser);

    // Test 5: Create and list products
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🛒 Test 5: Creating products...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const product1 = await client.productsCreate({
      name: "Laptop",
      description: "High performance laptop",
      price: 1299.99,
      stock: 50,
      category: "electronics",
    });
    console.log("✅ Created product:", product1);

    const productsList = await client.productsList({});
    console.log(`✅ Found ${productsList.count} products:`);
    for (const product of productsList.products) {
      console.log(`   - ${product.name}: $${product.price} (Stock: ${product.stock})`);
    }

    // Test 6: Update product stock
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 Test 6: Updating product stock...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const stockUpdate = await client.productsUpdateStock({
      id: product1.id,
      quantity: -5, // Sell 5 units
    });
    console.log("✅ Stock updated:");
    console.log(`   Previous: ${stockUpdate.previousStock}`);
    console.log(`   Current: ${stockUpdate.stock}`);

    // Test 7: Get analytics
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Test 7: Getting system analytics...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const stats = await client.analyticsStats({});
    console.log("✅ System statistics:");
    console.log(`   Total users: ${stats.users.total}`);
    console.log(`   Users by role:`, stats.users.byRole);
    console.log(`   Total products: ${stats.products.total}`);
    console.log(`   Total inventory value: $${stats.products.totalValue.toFixed(2)}`);
    console.log(`   Products by category:`, stats.products.byCategory);

    // Test 8: Health check
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🏥 Test 8: Health check...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const health = await client.analyticsHealth({});
    console.log("✅ Health check result:");
    console.log(`   Status: ${health.status}`);
    console.log(`   Uptime: ${health.uptime.toFixed(2)}s`);
    console.log(`   Services:`, health.services);

    // Test 9: Delete user
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🗑️  Test 9: Deleting user...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const deleteResult = await client.usersDelete({ id: user1.id });
    console.log("✅ User deleted:", deleteResult);

    // Final stats
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 All tests completed successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const finalStats = await client.analyticsStats({});
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
