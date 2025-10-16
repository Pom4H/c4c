/**
 * Пример использования модульной системы
 * 
 * Демонстрирует пользовательский путь разработчика:
 * 1. Создание модулей
 * 2. Регистрация процедур с разными уровнями видимости
 * 3. Использование композиции
 * 4. Выполнение процедур
 */

import { createModuleRegistry, createModule, registerModule, registerProcedure } from "./module-registry.js";
import { createComposition, createParallelComposition } from "./composition.js";
import * as userManagement from "./modules/user-management.js";
import * as analytics from "./modules/analytics.js";

/**
 * Пользовательский путь разработчика
 */
async function demonstrateModularSystem() {
  console.log("🚀 Демонстрация модульной системы tsdev\n");

  // 1. Создаем реестр модулей
  const registry = createModuleRegistry();

  // 2. Создаем модуль управления пользователями
  const userModule = createModule({
    name: "user-management",
    description: "Модуль управления пользователями",
    version: "1.0.0",
    namespace: "users",
    policies: ["withLogging", "withSpan"],
  });

  // 3. Регистрируем процедуры в модуле
  registerProcedure(userModule, userManagement.createUser, registry);
  registerProcedure(userModule, userManagement.getUser, registry);
  registerProcedure(userModule, userManagement.sendWelcomeEmail, registry);
  registerProcedure(userModule, userManagement.validateEmail, registry);
  registerProcedure(userModule, userManagement.hashPassword, registry);

  // 4. Создаем модуль аналитики
  const analyticsModule = createModule({
    name: "analytics",
    description: "Модуль аналитики и отслеживания",
    version: "1.0.0",
    namespace: "analytics",
    policies: ["withLogging", "withSpan", "withRetry"],
  });

  // 5. Регистрируем процедуры аналитики
  registerProcedure(analyticsModule, analytics.trackEvent, registry);
  registerProcedure(analyticsModule, analytics.processEvent, registry);
  registerProcedure(analyticsModule, analytics.storeEvent, registry);
  registerProcedure(analyticsModule, analytics.generateInsights, registry);

  // 6. Регистрируем модули в реестре
  registerModule(userModule, registry);
  registerModule(analyticsModule, registry);

  console.log("\n📊 Метаданные реестра:");
  console.log(JSON.stringify(getRegistryMetadata(registry), null, 2));

  // 7. Демонстрируем различные уровни доступа
  console.log("\n🔍 Демонстрация уровней доступа:");

  // Публичные процедуры (доступны как эндпоинты)
  console.log("\n📡 Публичные процедуры (эндпоинты):");
  const publicProcedures = registry.publicProcedures;
  for (const [name, procedure] of publicProcedures) {
    console.log(`  - ${name} (${procedure.visibility}) - ${procedure.contract.description}`);
  }

  // Процедуры для воркфлоу
  console.log("\n🔄 Процедуры для воркфлоу:");
  const workflowProcedures = registry.workflowProcedures;
  for (const [name, procedure] of workflowProcedures) {
    console.log(`  - ${name} (${procedure.visibility}) - ${procedure.contract.description}`);
  }

  // 8. Создаем композицию процедур
  console.log("\n🧩 Создание композиции процедур:");

  const userOnboardingComposition = createComposition({
    name: "userOnboarding",
    description: "Полный процесс регистрации пользователя",
    procedures: [
      "users.createUser",
      "analytics.trackEvent",
    ],
    inputMapping: {
      "users.createUser": "input",
      "analytics.trackEvent": "users.createUser",
    },
    outputMapping: {
      "user": "users.createUser",
      "event": "analytics.trackEvent",
    },
    errorHandling: "retry",
    retryConfig: {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2,
    },
  }, registry);

  // 9. Выполняем композицию
  console.log("\n⚡ Выполнение композиции:");

  try {
    const result = await userOnboardingComposition.execute({
      name: "Алексей Иванов",
      email: "alexey@example.com",
      password: "securepassword123",
    }, {
      requestId: "req_123",
      timestamp: new Date(),
      metadata: {},
      module: "composition",
      moduleVersion: "1.0.0",
      dependencies: new Map(),
    });

    console.log("✅ Результат композиции:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Ошибка выполнения композиции:", error);
  }

  // 10. Создаем параллельную композицию
  console.log("\n🔄 Создание параллельной композиции:");

  const parallelComposition = createParallelComposition({
    name: "parallelAnalytics",
    description: "Параллельная обработка аналитических данных",
    procedures: [
      "analytics.processEvent",
      "analytics.generateInsights",
    ],
  }, registry);

  try {
    const parallelResult = await parallelComposition.execute({
      eventId: "event_123",
      userId: "user_456",
      event: "user.signup",
      properties: { source: "web" },
    }, {
      requestId: "req_456",
      timestamp: new Date(),
      metadata: {},
      module: "composition",
      moduleVersion: "1.0.0",
      dependencies: new Map(),
    });

    console.log("✅ Результат параллельной композиции:", JSON.stringify(parallelResult, null, 2));
  } catch (error) {
    console.error("❌ Ошибка выполнения параллельной композиции:", error);
  }

  // 11. Демонстрируем выполнение отдельных процедур
  console.log("\n🎯 Выполнение отдельных процедур:");

  try {
    // Выполняем публичную процедуру
    const userResult = await executeModuleProcedure(registry, "users.getUser", {
      id: "user_123",
    });

    console.log("✅ Результат получения пользователя:", JSON.stringify(userResult, null, 2));
  } catch (error) {
    console.error("❌ Ошибка получения пользователя:", error);
  }

  // 12. Валидация зависимостей
  console.log("\n🔍 Валидация зависимостей:");
  const validationErrors = validateModuleDependencies(registry);
  if (validationErrors.length === 0) {
    console.log("✅ Все зависимости валидны");
  } else {
    console.log("❌ Ошибки валидации:", validationErrors);
  }

  console.log("\n🎉 Демонстрация завершена!");
}

// Запускаем демонстрацию
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateModularSystem().catch(console.error);
}

export { demonstrateModularSystem };