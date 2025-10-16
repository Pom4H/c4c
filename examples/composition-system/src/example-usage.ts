/**
 * Пример использования системы композиции
 * 
 * Демонстрирует пользовательский путь разработчика:
 * 1. Создание базовых процедур
 * 2. Композиция в сложные процедуры
 * 3. Различные стратегии выполнения
 * 4. Контроль видимости
 */

import { createCompositionRegistry, registerComposition, executeComposition } from "./composition-registry.js";
import * as userService from "./examples/user-service.js";

/**
 * Пользовательский путь разработчика
 */
async function demonstrateCompositionSystem() {
  console.log("🚀 Демонстрация системы композиции tsdev\n");

  // 1. Создаем реестр композиций
  const registry = createCompositionRegistry();

  // 2. Регистрируем базовые процедуры
  console.log("📝 Регистрация базовых процедур:");

  const baseProcedures = userService.baseProcedures;
  for (const [name, procedure] of Object.entries(baseProcedures)) {
    registry.procedures.set(name, procedure);
    console.log(`  - ${name}: ${procedure.description}`);
  }

  // 3. Регистрируем композиции
  console.log("\n🧩 Регистрация композиций:");

  const compositions = [
    userService.createUser,
    userService.userRegistration,
    userService.sendMultiChannelNotification,
    userService.createUserProfileConditional,
    userService.createUserWithFallback,
    userService.comprehensiveUserRegistration,
    userService.validateEmailWithRetry,
    userService.processUserData,
  ];

  for (const composition of compositions) {
    registerComposition(registry, composition);
  }

  // 4. Демонстрируем метаданные реестра
  console.log("\n📊 Метаданные реестра:");
  const metadata = getRegistryMetadata(registry);
  console.log(JSON.stringify(metadata, null, 2));

  // 5. Демонстрируем различные типы композиций
  console.log("\n🔍 Типы композиций:");

  const compositionTypes = ["sequential", "parallel", "conditional", "retry", "fallback"];
  for (const type of compositionTypes) {
    const compositions = Array.from(registry.compositions.values())
      .filter(comp => comp.type === type);
    console.log(`\n📁 ${type.toUpperCase()} (${compositions.length} композиций):`);
    compositions.forEach(comp => {
      console.log(`  - ${comp.name} (${comp.visibility}) - ${comp.description}`);
    });
  }

  // 6. Демонстрируем фильтрацию по видимости
  console.log("\n👁️ Фильтрация по видимости:");

  const visibilities = ["public", "workflow", "internal", "private"];
  for (const visibility of visibilities) {
    const compositions = Array.from(registry.compositions.values())
      .filter(comp => comp.visibility === visibility);
    console.log(`\n🔒 ${visibility.toUpperCase()} (${compositions.length} композиций):`);
    compositions.forEach(comp => {
      console.log(`  - ${comp.name} (${comp.type}) - ${comp.description}`);
    });
  }

  // 7. Демонстрируем выполнение композиций
  console.log("\n⚡ Выполнение композиций:");

  try {
    // Выполняем последовательную композицию
    console.log("\n📝 Последовательная композиция (createUser):");
    const createResult = await executeComposition(registry, "createUser", {
      name: "Алексей Петров",
      email: "alexey@example.com",
      password: "securepassword123",
    });

    console.log("✅ Результат:", JSON.stringify(createResult, null, 2));

    // Выполняем воркфлоу композицию
    console.log("\n🔄 Воркфлоу композиция (userRegistration):");
    const registrationResult = await executeComposition(registry, "userRegistration", {
      name: "Мария Сидорова",
      email: "maria@example.com",
      password: "password456",
    });

    console.log("✅ Результат:", JSON.stringify(registrationResult, null, 2));

    // Выполняем параллельную композицию
    console.log("\n🔄 Параллельная композиция (sendMultiChannelNotification):");
    const notificationResult = await executeComposition(registry, "sendMultiChannelNotification", {
      userId: "user_123",
      email: "test@example.com",
      phone: "+1234567890",
      message: "Добро пожаловать!",
    });

    console.log("✅ Результат:", JSON.stringify(notificationResult, null, 2));

    // Выполняем условную композицию
    console.log("\n🔀 Условная композиция (createUserProfileConditional):");
    const conditionalResult = await executeComposition(registry, "createUserProfileConditional", {
      userId: "user_123",
      userType: "premium", // Условие выполнится
      preferences: { theme: "dark" },
    });

    console.log("✅ Результат:", JSON.stringify(conditionalResult, null, 2));

    // Выполняем композицию с fallback
    console.log("\n🔄 Композиция с fallback (createUserWithFallback):");
    const fallbackResult = await executeComposition(registry, "createUserWithFallback", {
      name: "Иван Иванов",
      email: "ivan@example.com",
      password: "password789",
    });

    console.log("✅ Результат:", JSON.stringify(fallbackResult, null, 2));

    // Выполняем комплексную композицию
    console.log("\n🎯 Комплексная композиция (comprehensiveUserRegistration):");
    const comprehensiveResult = await executeComposition(registry, "comprehensiveUserRegistration", {
      name: "Елена Козлова",
      email: "elena@example.com",
      password: "password999",
      phone: "+9876543210",
    });

    console.log("✅ Результат:", JSON.stringify(comprehensiveResult, null, 2));

    // Выполняем композицию с retry
    console.log("\n🔄 Композиция с retry (validateEmailWithRetry):");
    const retryResult = await executeComposition(registry, "validateEmailWithRetry", {
      email: "test@example.com",
    });

    console.log("✅ Результат:", JSON.stringify(retryResult, null, 2));

    // Выполняем приватную композицию
    console.log("\n🔒 Приватная композиция (processUserData):");
    const privateResult = await executeComposition(registry, "processUserData", {
      rawData: {
        name: "Тест Тестов",
        email: "test@example.com",
        password: "testpass",
      },
    });

    console.log("✅ Результат:", JSON.stringify(privateResult, null, 2));

  } catch (error) {
    console.error("❌ Ошибка выполнения композиции:", error);
  }

  // 8. Демонстрируем специализированные реестры
  console.log("\n📋 Специализированные реестры:");

  console.log("\n📡 Публичные композиции (для API эндпоинтов):");
  const publicCompositions = registry.publicProcedures;
  for (const [name, composition] of publicCompositions) {
    console.log(`  - ${name} (${composition.config?.composition?.type}) - ${composition.config?.description}`);
  }

  console.log("\n🔄 Композиции для воркфлоу:");
  const workflowCompositions = registry.workflowProcedures;
  for (const [name, composition] of workflowCompositions) {
    console.log(`  - ${name} (${composition.config?.composition?.type}) - ${composition.config?.description}`);
  }

  console.log("\n🔒 Внутренние композиции:");
  const internalCompositions = registry.internalProcedures;
  for (const [name, composition] of internalCompositions) {
    console.log(`  - ${name} (${composition.config?.composition?.type}) - ${composition.config?.description}`);
  }

  console.log("\n🔐 Приватные композиции:");
  const privateCompositions = registry.privateProcedures;
  for (const [name, composition] of privateCompositions) {
    console.log(`  - ${name} (${composition.config?.composition?.type}) - ${composition.config?.description}`);
  }

  // 9. Демонстрируем анализ зависимостей
  console.log("\n🔍 Анализ зависимостей:");

  for (const [name, composition] of registry.composedProcedures) {
    const config = composition.config.composition;
    console.log(`\n📦 ${name}:`);
    console.log(`  Тип: ${config.type}`);
    console.log(`  Видимость: ${config.visibility}`);
    console.log(`  Процедуры: ${config.procedures.join(", ")}`);
    if (config.dependencies) {
      console.log(`  Зависимости: ${config.dependencies.join(", ")}`);
    }
    if (config.errorHandling) {
      console.log(`  Обработка ошибок: ${config.errorHandling}`);
    }
  }

  console.log("\n🎉 Демонстрация системы композиции завершена!");
}

// Запускаем демонстрацию
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateCompositionSystem().catch(console.error);
}

export { demonstrateCompositionSystem };