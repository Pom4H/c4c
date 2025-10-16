/**
 * Пример использования системы пространств имен
 * 
 * Демонстрирует пользовательский путь разработчика:
 * 1. Создание пространств имен
 * 2. Регистрация процедур с различными уровнями видимости
 * 3. Поиск и фильтрация процедур
 * 4. Выполнение процедур
 */

import { 
  createNamespaceRegistry, 
  createNamespace, 
  registerNamespace, 
  registerProcedure,
  executeProcedure,
  searchProcedures,
  getRegistryMetadata
} from "./namespace-registry.js";
import * as userManagement from "./examples/user-management.js";

/**
 * Пользовательский путь разработчика
 */
async function demonstrateNamespaceSystem() {
  console.log("🚀 Демонстрация системы пространств имен tsdev\n");

  // 1. Создаем реестр пространств имен
  const registry = createNamespaceRegistry();

  // 2. Создаем пространство имен для управления пользователями
  console.log("📁 Создание пространств имен:");

  const userManagementNamespace = createNamespace({
    name: "user-management",
    description: "Управление пользователями",
    version: "1.0.0",
    visibility: "public",
    policies: ["withLogging", "withSpan", "withRetry"],
    metadata: {
      team: "backend",
      domain: "user-management",
      priority: "high",
    },
  });

  // 3. Создаем дочернее пространство имен для аналитики
  const analyticsNamespace = createNamespace({
    name: "user-management.analytics",
    description: "Аналитика пользователей",
    version: "1.0.0",
    parent: "user-management",
    visibility: "workflow",
    policies: ["withLogging", "withSpan"],
    metadata: {
      team: "analytics",
      domain: "user-management",
      priority: "medium",
    },
  });

  // 4. Создаем дочернее пространство имен для уведомлений
  const notificationsNamespace = createNamespace({
    name: "user-management.notifications",
    description: "Уведомления пользователей",
    version: "1.0.0",
    parent: "user-management",
    visibility: "workflow",
    policies: ["withLogging", "withSpan", "withRetry"],
    metadata: {
      team: "notifications",
      domain: "user-management",
      priority: "medium",
    },
  });

  // 5. Регистрируем пространства имен
  registerNamespace(userManagementNamespace, registry);
  registerNamespace(analyticsNamespace, registry);
  registerNamespace(notificationsNamespace, registry);

  // 6. Регистрируем процедуры в пространстве имен
  console.log("\n📝 Регистрация процедур в пространствах имен:");

  const procedures = [
    userManagement.createUser,
    userManagement.getUser,
    userManagement.updateUser,
    userManagement.deleteUser,
    userManagement.sendWelcomeEmail,
    userManagement.trackUserEvent,
    userManagement.validateEmail,
    userManagement.hashPassword,
    userManagement.generateUserId,
    userManagement.sanitizeUserData,
  ];

  for (const procedure of procedures) {
    registerProcedure(procedure.namespace, procedure, registry);
  }

  // 7. Демонстрируем метаданные реестра
  console.log("\n📊 Метаданные реестра:");
  const metadata = getRegistryMetadata(registry);
  console.log(JSON.stringify(metadata, null, 2));

  // 8. Демонстрируем иерархию пространств имен
  console.log("\n🌳 Иерархия пространств имен:");
  const hierarchy = registry.hierarchy;
  for (const [namespace, parents] of hierarchy) {
    const indent = "  ".repeat(parents.length);
    console.log(`${indent}📁 ${namespace}${parents.length > 0 ? ` (parent: ${parents[0]})` : ""}`);
  }

  // 9. Демонстрируем фильтрацию по пространствам имен
  console.log("\n🔍 Фильтрация по пространствам имен:");

  const namespaces = ["user-management", "user-management.analytics", "user-management.notifications"];
  for (const namespace of namespaces) {
    const procedures = registry.namespaces.get(namespace)?.procedures;
    if (procedures) {
      console.log(`\n📁 ${namespace} (${procedures.size} процедур):`);
      for (const [name, procedure] of procedures) {
        console.log(`  - ${name} (${procedure.visibility}) - ${procedure.contract.description}`);
      }
    }
  }

  // 10. Демонстрируем фильтрацию по категориям
  console.log("\n📂 Фильтрация по категориям:");

  const categories = ["api", "workflow", "validation", "computation", "utility", "transformation"];
  for (const category of categories) {
    const procedures = registry.byCategory.get(category as any);
    if (procedures && procedures.length > 0) {
      console.log(`\n📁 ${category.toUpperCase()} (${procedures.length} процедур):`);
      procedures.forEach(proc => {
        console.log(`  - ${proc.fullName} (${proc.visibility}) - ${proc.contract.description}`);
      });
    }
  }

  // 11. Демонстрируем поиск по критериям
  console.log("\n🔍 Поиск по критериям:");

  const searchConfigs = [
    { namespace: "user-management" },
    { category: "api" as const },
    { visibility: "public" as const },
    { tags: ["users"] },
    { search: "email" },
    { includePrivate: true },
  ];

  for (const config of searchConfigs) {
    const results = searchProcedures(registry, config);
    console.log(`\n🔍 Критерии: ${JSON.stringify(config)}`);
    console.log(`   Найдено: ${results.total} процедур`);
    console.log(`   Пространства: ${results.namespaces.join(", ")}`);
    console.log(`   Категории: ${results.categories.join(", ")}`);
    console.log(`   Теги: ${results.tags.join(", ")}`);
    results.procedures.forEach(proc => {
      console.log(`   - ${proc.fullName} (${proc.category}, ${proc.visibility})`);
    });
  }

  // 12. Демонстрируем выполнение процедур
  console.log("\n⚡ Выполнение процедур:");

  try {
    // Выполняем публичную процедуру
    console.log("\n📡 Выполнение публичной процедуры (user-management.createUser):");
    const createResult = await executeProcedure(registry, "user-management.createUser", {
      name: "Алексей Петров",
      email: "alexey@example.com",
      password: "securepassword123",
    });

    console.log("✅ Результат:", JSON.stringify(createResult, null, 2));

    // Выполняем процедуру для воркфлоу
    console.log("\n🔄 Выполнение процедуры для воркфлоу (user-management.sendWelcomeEmail):");
    const emailResult = await executeProcedure(registry, "user-management.sendWelcomeEmail", {
      userId: "user_123",
      email: "alexey@example.com",
      name: "Алексей Петров",
    });

    console.log("✅ Результат:", JSON.stringify(emailResult, null, 2));

    // Выполняем аналитическую процедуру
    console.log("\n📊 Выполнение аналитической процедуры (user-management.trackUserEvent):");
    const trackResult = await executeProcedure(registry, "user-management.trackUserEvent", {
      userId: "user_123",
      event: "user.signup",
      properties: { source: "web", campaign: "winter2024" },
    });

    console.log("✅ Результат:", JSON.stringify(trackResult, null, 2));

    // Выполняем внутреннюю процедуру
    console.log("\n🔒 Выполнение внутренней процедуры (user-management.validateEmail):");
    const validationResult = await executeProcedure(registry, "user-management.validateEmail", {
      email: "test@example.com",
    });

    console.log("✅ Результат:", JSON.stringify(validationResult, null, 2));

    // Выполняем приватную процедуру
    console.log("\n🔐 Выполнение приватной процедуры (user-management.generateUserId):");
    const generateResult = await executeProcedure(registry, "user-management.generateUserId", {});

    console.log("✅ Результат:", JSON.stringify(generateResult, null, 2));

  } catch (error) {
    console.error("❌ Ошибка выполнения процедуры:", error);
  }

  // 13. Демонстрируем специализированные реестры
  console.log("\n📋 Специализированные реестры:");

  console.log("\n📡 Публичные процедуры (для API эндпоинтов):");
  const publicProcedures = registry.publicProcedures;
  for (const [name, procedure] of publicProcedures) {
    console.log(`  - ${name} (${procedure.category}) - ${procedure.contract.description}`);
  }

  console.log("\n🔄 Процедуры для воркфлоу:");
  const workflowProcedures = registry.workflowProcedures;
  for (const [name, procedure] of workflowProcedures) {
    console.log(`  - ${name} (${procedure.category}) - ${procedure.contract.description}`);
  }

  console.log("\n🔒 Внутренние процедуры:");
  const internalProcedures = registry.internalProcedures;
  for (const [name, procedure] of internalProcedures) {
    console.log(`  - ${name} (${procedure.category}) - ${procedure.contract.description}`);
  }

  console.log("\n🔐 Приватные процедуры:");
  const privateProcedures = registry.privateProcedures;
  for (const [name, procedure] of privateProcedures) {
    console.log(`  - ${name} (${procedure.category}) - ${procedure.contract.description}`);
  }

  // 14. Демонстрируем анализ зависимостей
  console.log("\n🔍 Анализ зависимостей:");

  for (const [name, procedure] of registry.procedures) {
    if (procedure.dependencies && procedure.dependencies.length > 0) {
      console.log(`\n📦 ${name}:`);
      console.log(`  Пространство: ${procedure.namespace}`);
      console.log(`  Категория: ${procedure.category}`);
      console.log(`  Видимость: ${procedure.visibility}`);
      console.log(`  Зависимости: ${procedure.dependencies.join(", ")}`);
      console.log(`  Теги: ${procedure.tags.join(", ")}`);
    }
  }

  console.log("\n🎉 Демонстрация системы пространств имен завершена!");
}

// Запускаем демонстрацию
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateNamespaceSystem().catch(console.error);
}

export { demonstrateNamespaceSystem };