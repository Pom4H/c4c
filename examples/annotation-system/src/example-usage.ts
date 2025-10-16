/**
 * Пример использования системы аннотаций
 * 
 * Демонстрирует пользовательский путь разработчика:
 * 1. Создание процедур с декораторами
 * 2. Регистрация в реестре
 * 3. Фильтрация по категориям и видимости
 * 4. Выполнение процедур
 */

import { createAnnotatedRegistry, registerAnnotatedProcedure, executeAnnotatedProcedure } from "./registry.js";
import { createAnnotatedProcedure } from "./decorators.js";
import * as userService from "./examples/user-service.js";

/**
 * Пользовательский путь разработчика
 */
async function demonstrateAnnotationSystem() {
  console.log("🚀 Демонстрация системы аннотаций tsdev\n");

  // 1. Создаем реестр аннотированных процедур
  const registry = createAnnotatedRegistry();

  // 2. Регистрируем процедуры из сервиса пользователей
  console.log("📝 Регистрация процедур с аннотациями:");

  const procedures = [
    userService.createUser,
    userService.getUser,
    userService.sendWelcomeEmail,
    userService.trackUserEvent,
    userService.validateEmail,
    userService.hashPassword,
    userService.calculateUserScore,
    userService.createUserLegacy,
  ];

  for (const procedure of procedures) {
    registerAnnotatedProcedure(registry, procedure);
  }

  // 3. Демонстрируем метаданные реестра
  console.log("\n📊 Метаданные реестра:");
  const metadata = getRegistryMetadata(registry);
  console.log(JSON.stringify(metadata, null, 2));

  // 4. Демонстрируем фильтрацию по категориям
  console.log("\n🔍 Фильтрация по категориям:");

  const categories = ["api", "workflow", "analytics", "validation", "computation"];
  for (const category of categories) {
    const procedures = getProceduresByCategory(registry, category as any);
    console.log(`\n📁 ${category.toUpperCase()} (${procedures.length} процедур):`);
    procedures.forEach(proc => {
      console.log(`  - ${proc.contract.name} (${proc.metadata.visibility}) - ${proc.metadata.description}`);
    });
  }

  // 5. Демонстрируем фильтрацию по видимости
  console.log("\n👁️ Фильтрация по видимости:");

  const visibilities = ["public", "workflow", "internal", "private"];
  for (const visibility of visibilities) {
    const procedures = getProceduresByVisibility(registry, visibility as any);
    console.log(`\n🔒 ${visibility.toUpperCase()} (${procedures.length} процедур):`);
    procedures.forEach(proc => {
      console.log(`  - ${proc.contract.name} (${proc.metadata.category}) - ${proc.metadata.description}`);
    });
  }

  // 6. Демонстрируем поиск по тегам
  console.log("\n🏷️ Поиск по тегам:");

  const tags = ["users", "email", "analytics", "deprecated"];
  for (const tag of tags) {
    const procedures = getProceduresByTag(registry, tag);
    console.log(`\n#${tag} (${procedures.length} процедур):`);
    procedures.forEach(proc => {
      console.log(`  - ${proc.contract.name} (${proc.metadata.category}) - ${proc.metadata.description}`);
    });
  }

  // 7. Демонстрируем поиск по критериям
  console.log("\n🔍 Поиск по критериям:");

  const searchCriteria = [
    { category: "api" as const, visibility: "public" as const },
    { tags: ["deprecated"] },
    { deprecated: true },
    { search: "user" },
  ];

  for (const criteria of searchCriteria) {
    const results = searchProcedures(registry, criteria);
    console.log(`\n🔍 Критерии: ${JSON.stringify(criteria)}`);
    console.log(`   Найдено: ${results.length} процедур`);
    results.forEach(proc => {
      console.log(`   - ${proc.contract.name} (${proc.metadata.category}, ${proc.metadata.visibility})`);
    });
  }

  // 8. Демонстрируем выполнение процедур
  console.log("\n⚡ Выполнение процедур:");

  try {
    // Выполняем публичную процедуру
    console.log("\n📡 Выполнение публичной процедуры (createUser):");
    const createResult = await executeAnnotatedProcedure(registry, "createUser", {
      name: "Алексей Петров",
      email: "alexey@example.com",
      password: "securepassword123",
    });

    console.log("✅ Результат:", JSON.stringify(createResult, null, 2));

    // Выполняем процедуру для воркфлоу
    console.log("\n🔄 Выполнение процедуры для воркфлоу (sendWelcomeEmail):");
    const emailResult = await executeAnnotatedProcedure(registry, "sendWelcomeEmail", {
      userId: "user_123",
      email: "alexey@example.com",
      name: "Алексей Петров",
    });

    console.log("✅ Результат:", JSON.stringify(emailResult, null, 2));

    // Выполняем аналитическую процедуру
    console.log("\n📊 Выполнение аналитической процедуры (trackUserEvent):");
    const trackResult = await executeAnnotatedProcedure(registry, "trackUserEvent", {
      userId: "user_123",
      event: "user.signup",
      properties: { source: "web", campaign: "winter2024" },
    });

    console.log("✅ Результат:", JSON.stringify(trackResult, null, 2));

    // Выполняем приватную процедуру
    console.log("\n🔒 Выполнение приватной процедуры (validateEmail):");
    const validationResult = await executeAnnotatedProcedure(registry, "validateEmail", {
      email: "test@example.com",
    });

    console.log("✅ Результат:", JSON.stringify(validationResult, null, 2));

    // Выполняем устаревшую процедуру
    console.log("\n⚠️ Выполнение устаревшей процедуры (createUserLegacy):");
    const legacyResult = await executeAnnotatedProcedure(registry, "createUserLegacy", {
      name: "Тест Тестов",
      email: "test@example.com",
      password: "password123",
    });

    console.log("✅ Результат:", JSON.stringify(legacyResult, null, 2));

  } catch (error) {
    console.error("❌ Ошибка выполнения процедуры:", error);
  }

  // 9. Демонстрируем валидацию зависимостей
  console.log("\n🔍 Валидация зависимостей:");
  const validationErrors = validateDependencies(registry);
  if (validationErrors.length === 0) {
    console.log("✅ Все зависимости валидны");
  } else {
    console.log("❌ Ошибки валидации:", validationErrors);
  }

  // 10. Демонстрируем получение специализированных реестров
  console.log("\n📋 Специализированные реестры:");

  console.log("\n📡 Публичные процедуры (для API эндпоинтов):");
  const publicProcedures = getPublicProcedures(registry);
  for (const [name, procedure] of publicProcedures) {
    console.log(`  - ${name} (${procedure.metadata.category}) - ${procedure.metadata.description}`);
  }

  console.log("\n🔄 Процедуры для воркфлоу:");
  const workflowProcedures = getWorkflowProcedures(registry);
  for (const [name, procedure] of workflowProcedures) {
    console.log(`  - ${name} (${procedure.metadata.category}) - ${procedure.metadata.description}`);
  }

  console.log("\n🔒 Внутренние процедуры:");
  const internalProcedures = getInternalProcedures(registry);
  for (const [name, procedure] of internalProcedures) {
    console.log(`  - ${name} (${procedure.metadata.category}) - ${procedure.metadata.description}`);
  }

  console.log("\n🔐 Приватные процедуры:");
  const privateProcedures = getPrivateProcedures(registry);
  for (const [name, procedure] of privateProcedures) {
    console.log(`  - ${name} (${procedure.metadata.category}) - ${procedure.metadata.description}`);
  }

  console.log("\n🎉 Демонстрация системы аннотаций завершена!");
}

// Запускаем демонстрацию
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAnnotationSystem().catch(console.error);
}

export { demonstrateAnnotationSystem };