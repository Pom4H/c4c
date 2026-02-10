/**
 * Test Workflow - demonstrates Workflow DevKit patterns with modules
 *
 * Before (old DSL):
 *   workflow("test-workflow").step(createUserStep).step(createProductStep).commit()
 *
 * After (Workflow DevKit):
 *   Just an async function that calls steps!
 */

import { step, FatalError } from "@c4c/workflow";
import { userDatabase } from "../users/database.js";
import { productDatabase } from "../products/database.js";
import { validateEmail, sanitizeName, validateUserRole } from "../users/validators.js";

// Steps wrap database operations with retry semantics

const createUser = step("users.create", async (input: {
	name: string;
	email: string;
	role?: string;
}) => {
	const { name, email, role = "user" } = input;

	if (!validateEmail(email)) {
		throw new FatalError("Invalid email format");
	}
	if (!validateUserRole(role)) {
		throw new FatalError("Invalid role");
	}

	const existing = await userDatabase.findByEmail(email);
	if (existing) {
		throw new FatalError("User with this email already exists");
	}

	const sanitizedName = sanitizeName(name);
	return await userDatabase.create({ name: sanitizedName, email, role });
});

const createProduct = step("products.create", async (input: {
	name: string;
	description: string;
	price: number;
	stock: number;
	category: string;
}) => {
	return await productDatabase.create(input);
});

const getAnalytics = step("analytics.stats", async () => {
	const users = await userDatabase.list();
	const products = await productDatabase.list();

	const usersByRole: Record<string, number> = {};
	for (const user of users) {
		usersByRole[user.role] = (usersByRole[user.role] || 0) + 1;
	}

	const productsByCategory: Record<string, number> = {};
	let totalValue = 0;
	for (const product of products) {
		productsByCategory[product.category] = (productsByCategory[product.category] || 0) + 1;
		totalValue += product.price * product.stock;
	}

	return {
		users: { total: users.length, byRole: usersByRole },
		products: { total: products.length, totalValue, byCategory: productsByCategory },
		timestamp: new Date().toISOString(),
	};
});

/**
 * Test workflow that creates a user, creates a product, then gets analytics.
 * Uses plain async/await instead of the old builder pattern.
 */
export async function testWorkflow() {
	"use workflow";

	console.log("Test workflow started");

	// Step 1: Create a user
	const user = await createUser({
		name: "Test User",
		email: `test-${Date.now()}@example.com`,
		role: "user",
	});
	console.log("User created:", user.id);

	// Step 2: Create a product
	const product = await createProduct({
		name: "Test Product",
		description: "A test product",
		price: 29.99,
		stock: 100,
		category: "test",
	});
	console.log("Product created:", product.id);

	// Step 3: Get analytics
	const analytics = await getAnalytics();
	console.log("Analytics:", analytics.users.total, "users,", analytics.products.total, "products");

	console.log("Test workflow completed");

	return { user, product, analytics };
}

/**
 * Parallel creation workflow - create user and product simultaneously
 */
export async function parallelCreationWorkflow() {
	"use workflow";

	console.log("Parallel creation workflow started");

	// Create user and product in parallel
	const [user, product] = await Promise.all([
		createUser({
			name: "Parallel User",
			email: `parallel-${Date.now()}@example.com`,
			role: "user",
		}),
		createProduct({
			name: "Parallel Product",
			description: "Created in parallel",
			price: 49.99,
			stock: 50,
			category: "parallel-test",
		}),
	]);

	// Then get analytics
	const analytics = await getAnalytics();

	console.log("Parallel creation workflow completed");
	return { user, product, analytics };
}
