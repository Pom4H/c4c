/**
 * Test Workflow - demonstrates Workflow DevKit patterns with modules
 *
 * Uses "use workflow" / "use step" directives from the Workflow DevKit.
 * Step functions have full Node.js runtime access and are automatically retried.
 */

import { FatalError } from "@c4c/workflow";
import { userDatabase } from "../users/database.js";
import { productDatabase } from "../products/database.js";
import { validateEmail, sanitizeName, validateUserRole } from "../users/validators.js";

// Step functions - "use step" gives automatic retry semantics

async function createUser(input: { name: string; email: string; role?: string }) {
	"use step";
	const { name, email, role = "user" } = input;

	if (!validateEmail(email)) throw new FatalError("Invalid email format");
	if (!validateUserRole(role)) throw new FatalError("Invalid role");

	const existing = await userDatabase.findByEmail(email);
	if (existing) throw new FatalError("User with this email already exists");

	return await userDatabase.create({ name: sanitizeName(name), email, role });
}

async function createProduct(input: {
	name: string;
	description: string;
	price: number;
	stock: number;
	category: string;
}) {
	"use step";
	return await productDatabase.create(input);
}

async function getAnalytics() {
	"use step";
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
}

/**
 * Test workflow: create user, create product, get analytics.
 */
export async function testWorkflow() {
	"use workflow";

	console.log("Test workflow started");

	const user = await createUser({
		name: "Test User",
		email: `test-${Date.now()}@example.com`,
		role: "user",
	});
	console.log("User created:", user.id);

	const product = await createProduct({
		name: "Test Product",
		description: "A test product",
		price: 29.99,
		stock: 100,
		category: "test",
	});
	console.log("Product created:", product.id);

	const analytics = await getAnalytics();
	console.log("Analytics:", analytics.users.total, "users,", analytics.products.total, "products");

	return { user, product, analytics };
}

/**
 * Parallel creation workflow - create user and product simultaneously
 */
export async function parallelCreationWorkflow() {
	"use workflow";

	const [user, product] = await Promise.all([
		createUser({
			name: "Parallel User",
			email: `parallel-${Date.now()}@example.com`,
		}),
		createProduct({
			name: "Parallel Product",
			description: "Created in parallel",
			price: 49.99,
			stock: 50,
			category: "parallel-test",
		}),
	]);

	const analytics = await getAnalytics();
	return { user, product, analytics };
}
