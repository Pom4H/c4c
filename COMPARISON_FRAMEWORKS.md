# tsdev vs NestJS vs Spring Boot: Архитектурное сравнение

> **TL;DR:** tsdev — это не просто framework, а **platform + framework**. Он решает другой класс задач: не "как писать backend код", а "как создавать AI-driven, workflow-based системы с zero-ops deployment".

---

## Философские различия

### NestJS/Spring Boot: **Application Frameworks**
```
Фокус: Как структурировать код приложения
Scope: Development-time (coding patterns)
Deploy: Вы сами деплоите (Docker, K8s, cloud)
```

### tsdev: **Platform + Application Framework**
```
Фокус: Как создавать и эксплуатировать workflow-based системы
Scope: Development + Deployment + Operations (full lifecycle)
Deploy: Platform берёт на себя (git push → production)
```

**Аналогия:**
- **NestJS/Spring Boot** = Express/Koa, но с лучшей структурой
- **tsdev** = Vercel/Railway, но для backend + встроенный workflow engine

---

## Детальное сравнение

### 1. Архитектурный подход

#### Spring Boot (Java)
```java
// Annotation-based, class-oriented, OOP-heavy

@RestController
@RequestMapping("/users")
public class UserController {
    
    @Autowired
    private UserService userService;
    
    @PostMapping
    @Validated
    public ResponseEntity<UserDTO> createUser(
        @Valid @RequestBody CreateUserRequest request
    ) {
        User user = userService.createUser(request);
        return ResponseEntity.ok(UserDTO.from(user));
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUser(
        @PathVariable UUID id
    ) {
        User user = userService.findById(id)
            .orElseThrow(() -> new UserNotFoundException(id));
        return ResponseEntity.ok(UserDTO.from(user));
    }
}

@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
    
    @Transactional
    public User createUser(CreateUserRequest request) {
        // Business logic
    }
}
```

**Характеристики:**
- ✅ Mature ecosystem (20+ лет)
- ✅ Enterprise-ready (Spring Security, Spring Data, etc.)
- ✅ Dependency injection (IoC)
- ❌ Verbose (много boilerplate)
- ❌ JVM overhead (memory, startup time)
- ❌ Annotation magic (неявное поведение)
- ❌ Слабая type safety (runtime validation)

#### NestJS (TypeScript)
```typescript
// Decorator-based, Angular-inspired, class-oriented

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
  
  @Post()
  @UsePipes(new ValidationPipe())
  async createUser(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserDto> {
    return this.userService.create(createUserDto);
  }
  
  @Get(':id')
  async getUser(@Param('id') id: string): Promise<UserDto> {
    return this.userService.findOne(id);
  }
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}
  
  async create(dto: CreateUserDto): Promise<User> {
    // Business logic
  }
}

// Validation (class-validator)
class CreateUserDto {
  @IsString()
  @MinLength(1)
  name: string;
  
  @IsEmail()
  email: string;
}
```

**Характеристики:**
- ✅ TypeScript-native
- ✅ Angular-like architecture (familiar)
- ✅ Good ecosystem (Passport, TypeORM, etc.)
- ✅ Decorators для metadata
- ❌ Decorator magic (неявное поведие)
- ❌ Class-based (не functional)
- ❌ Слабая type inference (decorators break types)
- ❌ Runtime validation отдельно от types

#### tsdev (TypeScript)
```typescript
// Contract-first, functional, procedure-based

// 1. Define contract (Zod schema)
export const createUserContract: Contract = {
  name: 'users.create',
  description: 'Create a new user',
  input: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  output: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
  }),
  metadata: {
    tags: ['users', 'write'],
  },
};

// 2. Implement handler (pure function)
export const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input) => {
    // input is fully typed (inferred from Zod)
    const user = await db.insert(users).values(input).returning();
    return user;
  },
};

// That's it! No controllers, no services, no modules.
// Auto-discovered, auto-registered, auto-documented.
```

**Характеристики:**
- ✅ **Zero boilerplate** (1 файл = 1 API endpoint)
- ✅ **Contracts-first** (Zod = runtime validation + type inference)
- ✅ **Functional** (pure functions, composable)
- ✅ **Auto-discovery** (no manual registration)
- ✅ **Type inference** (no type duplication)
- ✅ **Transport-agnostic** (same handler → REST/RPC/GraphQL/CLI)
- ✅ **Built-in workflows** (compose procedures into complex flows)
- ✅ **Platform integration** (deploy, scale, monitor out of the box)

---

## 2. Code Comparison: Creating a User

### Spring Boot (~150 lines)

```java
// CreateUserRequest.java
@Data
@Validated
public class CreateUserRequest {
    @NotBlank
    @Size(min = 1, max = 100)
    private String name;
    
    @Email
    @NotBlank
    private String email;
}

// UserDTO.java
@Data
public class UserDTO {
    private UUID id;
    private String name;
    private String email;
    private LocalDateTime createdAt;
    
    public static UserDTO from(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setCreatedAt(user.getCreatedAt());
        return dto;
    }
}

// User.java (entity)
@Entity
@Table(name = "users")
@Data
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false, unique = true)
    private String email;
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
}

// UserRepository.java
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
}

// UserService.java
@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
    
    @Transactional
    public User createUser(CreateUserRequest request) {
        // Check if exists
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new UserAlreadyExistsException(request.getEmail());
        }
        
        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setCreatedAt(LocalDateTime.now());
        
        return userRepository.save(user);
    }
}

// UserController.java
@RestController
@RequestMapping("/api/users")
public class UserController {
    @Autowired
    private UserService userService;
    
    @PostMapping
    public ResponseEntity<UserDTO> createUser(
        @Valid @RequestBody CreateUserRequest request
    ) {
        User user = userService.createUser(request);
        return ResponseEntity.ok(UserDTO.from(user));
    }
}

// UserAlreadyExistsException.java
public class UserAlreadyExistsException extends RuntimeException {
    public UserAlreadyExistsException(String email) {
        super("User with email " + email + " already exists");
    }
}

// GlobalExceptionHandler.java
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(UserAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleUserAlreadyExists(
        UserAlreadyExistsException ex
    ) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse(ex.getMessage()));
    }
}
```

**Total: ~150 lines, 8 files**

### NestJS (~100 lines)

```typescript
// create-user.dto.ts
export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
  
  @IsEmail()
  email: string;
}

// user.dto.ts
export class UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// user.entity.ts
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column()
  name: string;
  
  @Column({ unique: true })
  email: string;
  
  @CreateDateColumn()
  createdAt: Date;
}

// user.service.ts
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}
  
  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email }
    });
    
    if (existing) {
      throw new ConflictException('User already exists');
    }
    
    const user = this.userRepository.create(dto);
    return this.userRepository.save(user);
  }
}

// user.controller.ts
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
  
  @Post()
  @UsePipes(new ValidationPipe())
  async create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.userService.create(dto);
  }
}

// user.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

**Total: ~100 lines, 6 files**

### tsdev (~30 lines)

```typescript
// contracts/users.ts
export const createUserContract: Contract = {
  name: 'users.create',
  description: 'Create a new user',
  input: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
  }),
  output: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string().datetime(),
  }),
  metadata: {
    tags: ['users', 'write'],
  },
};

// handlers/users/create.ts
import { db } from '../../lib/db.js';

export const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input) => {
    // Check if exists
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [input.email]
    );
    
    if (existing) {
      throw new Error('User already exists');
    }
    
    // Insert user
    const [user] = await db.query(
      `INSERT INTO users (name, email, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, name, email, created_at`,
      [input.name, input.email]
    );
    
    return user;
  },
};

// That's it! Drop file → auto-registered → available at:
// - POST /rpc/users.create
// - POST /users (REST convention)
// - In OpenAPI docs
// - In generated TypeScript client
```

**Total: ~30 lines, 2 files (contract + handler)**

---

## 3. Type Safety Comparison

### Spring Boot
```java
// ❌ No compile-time validation
// Runtime validation via annotations

@PostMapping
public UserDTO createUser(@Valid @RequestBody CreateUserRequest request) {
    // request is validated at runtime
    // Compile-time: no guarantee about structure
}
```

### NestJS
```typescript
// ⚠️ Weak type inference with decorators

class CreateUserDto {
  @IsString()
  name: string;  // Type disconnected from validation
  
  @IsEmail()
  email: string;  // Can get out of sync
}

// Controller
async create(@Body() dto: CreateUserDto) {
  // dto type is CreateUserDto, but validation happens at runtime
  // No compile-time guarantee that validation matches types
}
```

### tsdev
```typescript
// ✅ Strong type inference from Zod

const contract = {
  input: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  output: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
};

// Handler
handler: async (input) => {
  // input type is automatically inferred as:
  // { name: string, email: string }
  
  // TypeScript KNOWS this at compile-time
  input.name  // ✅ string
  input.email // ✅ string
  
  // Must return:
  // { id: string, name: string }
  
  // Runtime validation happens automatically
  // Types and validation NEVER get out of sync
}
```

**Winner: tsdev** — single source of truth (Zod schema = types + validation)

---

## 4. Workflow Support

### Spring Boot
```java
// ❌ No built-in workflow engine
// Need external: Apache Camel, Spring Integration, Camunda, Temporal

// Example with Spring Integration (verbose):
@Configuration
public class WorkflowConfig {
    @Bean
    public IntegrationFlow userOnboardingFlow() {
        return IntegrationFlows
            .from("userCreatedChannel")
            .handle("userService", "createUser")
            .handle("emailService", "sendWelcomeEmail")
            .handle("analyticsService", "trackSignup")
            .get();
    }
}

// OR use Temporal (separate service, complex setup)
```

### NestJS
```typescript
// ❌ No built-in workflow engine
// Need external: BullMQ, Temporal, n8n

// Example with BullMQ (manual orchestration):
@Injectable()
export class UserOnboardingService {
  constructor(
    @InjectQueue('user-onboarding') private queue: Queue,
  ) {}
  
  async onboard(data: any) {
    // Manually orchestrate steps
    await this.queue.add('create-user', data);
    await this.queue.add('send-email', data);
    await this.queue.add('track-signup', data);
    
    // No visibility, no retry logic, no conditional flows
  }
}
```

### tsdev
```typescript
// ✅ Built-in workflow engine with full support

const createAccount = step({
  id: 'create-account',
  input: z.object({ name: z.string(), email: z.string() }),
  output: z.object({ id: z.string() }),
  execute: ({ engine, inputData }) => 
    engine.run('users.create', inputData),
});

const sendWelcomeEmail = step({
  id: 'send-welcome',
  input: createAccount.output,  // Type-safe data flow
  output: z.object({ sent: z.boolean() }),
  execute: ({ engine, variables }) => 
    engine.run('emails.send', { to: variables.email }),
});

const trackSignup = step({
  id: 'track-signup',
  input: sendWelcomeEmail.output,
  output: z.object({ tracked: z.boolean() }),
  execute: ({ engine, variables }) => 
    engine.run('analytics.track', {
      event: 'user.signup',
      userId: variables.id,
    }),
});

export const userOnboarding = workflow('user-onboarding')
  .step(createAccount)
  .step(sendWelcomeEmail)
  .step(trackSignup)
  .commit();

// Features built-in:
// - OpenTelemetry tracing (automatic)
// - Visualization UI
// - Retry policies
// - Error handling
// - Conditional logic
// - Parallel execution
// - Pause/resume
// - Versioning (Git)
```

**Winner: tsdev** — workflow engine is first-class citizen

---

## 5. Observability

### Spring Boot
```java
// ⚠️ Manual setup required

// Add dependencies:
// - spring-boot-actuator
// - micrometer
// - zipkin/jaeger client
// - logback configuration

// Configure:
@Configuration
public class ObservabilityConfig {
    @Bean
    public MeterRegistry meterRegistry() { ... }
    
    @Bean
    public Tracer tracer() { ... }
}

// Instrument manually:
@Service
public class UserService {
    private final Counter userCreatedCounter;
    private final Tracer tracer;
    
    public User createUser(CreateUserRequest request) {
        Span span = tracer.nextSpan().name("createUser").start();
        try {
            // Business logic
            userCreatedCounter.increment();
            return user;
        } finally {
            span.finish();
        }
    }
}
```

### NestJS
```typescript
// ⚠️ Manual setup required

// Add interceptors:
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`After... ${Date.now() - now}ms`)),
    );
  }
}

// Add OpenTelemetry:
import { trace } from '@opentelemetry/api';

@Injectable()
export class UserService {
  async create(dto: CreateUserDto) {
    const span = trace.getTracer('app').startSpan('createUser');
    try {
      // Business logic
    } finally {
      span.end();
    }
  }
}

// Setup tracing provider manually
```

### tsdev
```typescript
// ✅ Built-in, zero setup

// Just write handler:
export const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input) => {
    // Business logic only
    return user;
  },
};

// Observability automatic:
// - Request logs: ✅
// - OpenTelemetry spans: ✅
// - Metrics (rate, latency, errors): ✅
// - Distributed tracing: ✅
// - Error tracking: ✅

// Access via CLI:
// tsdev logs --follow
// tsdev metrics
// tsdev traces
```

**Winner: tsdev** — observability is zero-config

---

## 6. Deployment & Operations

### Spring Boot
```bash
# Manual deployment:

# 1. Build JAR
./mvnw clean package

# 2. Create Dockerfile
FROM openjdk:17-jdk-slim
COPY target/app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

# 3. Build image
docker build -t myapp .

# 4. Push to registry
docker push myregistry/myapp

# 5. Deploy to Kubernetes
kubectl apply -f deployment.yaml

# 6. Setup monitoring (Prometheus, Grafana)
# 7. Setup logging (ELK stack)
# 8. Setup CI/CD (Jenkins, GitLab CI)
# 9. Setup secrets management (Vault)
# 10. Setup database (RDS, CloudSQL)
# 11. Setup Redis
# 12. Setup S3
# 13. Setup load balancer
# 14. Setup SSL certificates
# 15. Setup auto-scaling
# ... and so on

# Total: weeks of DevOps work
```

### NestJS
```bash
# Similar to Spring Boot:

# 1. Build
npm run build

# 2. Dockerfile
FROM node:20-alpine
COPY dist/ .
CMD ["node", "main.js"]

# 3-15: Same as Spring Boot (manual K8s setup)

# Alternative: Deploy to Heroku/Railway/Render
# But still need to manage:
# - Database separately
# - Redis separately
# - S3 separately
# - Monitoring setup
# - Log aggregation
```

### tsdev
```bash
# Zero-ops deployment:

# 1. Push to Git
git push origin main

# That's it!

# Platform automatically:
# ✅ Builds Docker image
# ✅ Runs tests
# ✅ Deploys to production
# ✅ Sets up SSL
# ✅ Configures load balancer
# ✅ Enables auto-scaling
# ✅ Provisions database (if configured)
# ✅ Provisions Redis
# ✅ Provisions S3
# ✅ Sets up monitoring
# ✅ Sets up log aggregation
# ✅ Sets up distributed tracing
# ✅ Configures alerts
# ✅ Creates preview environments for PRs

# Total: 5 seconds
```

**Winner: tsdev** — it's a platform, not just a framework

---

## 7. AI Integration

### Spring Boot
```java
// ❌ No built-in AI support
// Manual integration with LLM APIs

@Service
public class AIService {
    private final OpenAI openai;
    
    public String generateResponse(String prompt) {
        // Manual API calls
        // No workflow support
        // No tracing
        // No caching
    }
}
```

### NestJS
```typescript
// ❌ No built-in AI support
// Manual integration

@Injectable()
export class AIService {
  async generateResponse(prompt: string) {
    // Manual OpenAI/Anthropic calls
    // No workflow orchestration
    // No automatic retry
  }
}
```

### tsdev
```typescript
// ✅ AI-first architecture

// 1. AI can discover all procedures
const { procedures } = await fetch('http://api/procedures')
  .then(r => r.json());

// 2. AI composes workflows
const workflow = composeWorkflow(procedures, task);

// 3. AI validates workflow
await fetch('http://api/workflow/validate', {
  method: 'POST',
  body: JSON.stringify(workflow)
});

// 4. AI executes workflow
const result = await fetch('http://api/workflow/execute', {
  method: 'POST',
  body: JSON.stringify({ workflow, input })
});

// 5. AI analyzes traces and optimizes
const traces = await fetch(`http://api/workflow/${id}/traces`)
  .then(r => r.json());

// AI suggestions:
// - "This step is slow, add caching"
// - "These steps are independent, parallelize them"
// - "This step fails 15%, add retry policy"

// 6. AI commits optimized workflow to Git
await git.commit('workflows/optimized-flow.ts', workflow);

// Platform features for AI:
// ✅ Machine-readable contracts (JSON Schema)
// ✅ Introspection API
// ✅ Workflow validation
// ✅ Execution with full tracing
// ✅ Performance analytics
// ✅ Automatic optimization suggestions
```

**Winner: tsdev** — designed for AI agents from ground up

---

## 8. Real-World Example

### Задача: User Onboarding Flow
**Requirements:**
1. Create user account
2. Send welcome email
3. Track signup event
4. If premium user → send to sales team
5. Generate PDF welcome guide
6. Schedule follow-up email (3 days later)

### Spring Boot Implementation

**Files needed:**
```
UserController.java
UserService.java
EmailService.java
AnalyticsService.java
SalesService.java
PDFService.java
SchedulerService.java
UserRepository.java
User.java (entity)
CreateUserRequest.java
UserDTO.java
EmailMessage.java
SalesLead.java
... (20+ files)
```

**Code example:**
```java
@Service
public class UserOnboardingService {
    @Autowired private UserService userService;
    @Autowired private EmailService emailService;
    @Autowired private AnalyticsService analyticsService;
    @Autowired private SalesService salesService;
    @Autowired private PDFService pdfService;
    @Autowired private SchedulerService schedulerService;
    
    @Transactional
    public void onboardUser(CreateUserRequest request) {
        // 1. Create user
        User user = userService.createUser(request);
        
        // 2. Send email
        try {
            emailService.sendWelcomeEmail(user);
        } catch (Exception e) {
            log.error("Failed to send email", e);
            // Manual error handling
        }
        
        // 3. Track analytics
        analyticsService.trackEvent("user.signup", user.getId());
        
        // 4. Check premium
        if (user.isPremium()) {
            salesService.createLead(user);
        }
        
        // 5. Generate PDF
        byte[] pdf = pdfService.generateWelcomeGuide(user);
        // Store somewhere...
        
        // 6. Schedule follow-up
        schedulerService.scheduleEmail(
            user.getId(),
            "follow-up",
            Duration.ofDays(3)
        );
        
        // Problems:
        // - No visibility into execution
        // - No retry logic
        // - No tracing
        // - Hard to test
        // - Hard to modify flow
        // - No versioning of flow logic
    }
}
```

**Total: ~500 lines across 20+ files**

### NestJS Implementation

**Files needed:**
```
user.controller.ts
user.service.ts
user-onboarding.service.ts
email.service.ts
analytics.service.ts
sales.service.ts
pdf.service.ts
scheduler.service.ts
user.entity.ts
create-user.dto.ts
user.dto.ts
user.module.ts
email.module.ts
... (15+ files)
```

**Code example:**
```typescript
@Injectable()
export class UserOnboardingService {
  constructor(
    private userService: UserService,
    private emailService: EmailService,
    private analyticsService: AnalyticsService,
    private salesService: SalesService,
    private pdfService: PDFService,
    @InjectQueue('scheduler') private schedulerQueue: Queue,
  ) {}
  
  async onboard(dto: CreateUserDto) {
    // 1. Create user
    const user = await this.userService.create(dto);
    
    // 2. Send email (with retry via BullMQ)
    await this.emailService.sendWelcome(user);
    
    // 3. Track
    await this.analyticsService.track('user.signup', user.id);
    
    // 4. Premium check
    if (user.isPremium) {
      await this.salesService.createLead(user);
    }
    
    // 5. Generate PDF
    const pdf = await this.pdfService.generateGuide(user);
    
    // 6. Schedule follow-up
    await this.schedulerQueue.add('follow-up-email', {
      userId: user.id,
    }, {
      delay: 3 * 24 * 60 * 60 * 1000,
    });
    
    // Problems:
    // - Still no flow visibility
    // - Partial tracing at best
    // - Hard to visualize
    // - Flow logic scattered across services
  }
}
```

**Total: ~350 lines across 15+ files**

### tsdev Implementation

**Files needed:**
```
contracts/users.ts          (contract)
handlers/users/create.ts    (handler)
workflows/user-onboarding.ts (workflow)
```

**Code example:**
```typescript
// workflows/user-onboarding.ts

import { workflow, step, condition, parallel } from '@tsdev/workflow';
import { z } from 'zod';

// Step definitions (type-safe)
const createAccount = step({
  id: 'create-account',
  input: z.object({ name: z.string(), email: z.string() }),
  output: z.object({ id: z.string(), isPremium: z.boolean() }),
  execute: ({ engine, inputData }) => 
    engine.run('users.create', inputData),
});

const checkPremium = condition({
  id: 'check-premium',
  input: createAccount.output,
  predicate: (ctx) => ctx.get('isPremium') === true,
  whenTrue: 'notify-sales',
  whenFalse: 'continue',
});

const notifySales = step({
  id: 'notify-sales',
  input: z.object({}),
  output: z.object({ notified: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('sales.createLead', { userId: variables.id }),
});

// Parallel tasks (independent)
const parallelTasks = parallel({
  id: 'parallel-onboarding',
  branches: [
    // Send welcome email
    step({
      id: 'send-welcome',
      input: z.object({}),
      output: z.object({ sent: z.boolean() }),
      retry: { maxAttempts: 3, backoff: 'exponential' },
      execute: ({ engine, variables }) =>
        engine.run('emails.sendWelcome', {
          to: variables.email,
          name: variables.name,
        }),
    }),
    
    // Track analytics
    step({
      id: 'track-signup',
      input: z.object({}),
      output: z.object({ tracked: z.boolean() }),
      execute: ({ engine, variables }) =>
        engine.run('analytics.track', {
          event: 'user.signup',
          userId: variables.id,
        }),
    }),
    
    // Generate PDF
    step({
      id: 'generate-pdf',
      input: z.object({}),
      output: z.object({ url: z.string() }),
      execute: ({ engine, variables }) =>
        engine.run('pdf.generateWelcomeGuide', {
          userId: variables.id,
        }),
    }),
  ],
  waitForAll: false,  // Fire and forget
});

const scheduleFollowUp = step({
  id: 'schedule-follow-up',
  input: z.object({}),
  output: z.object({ scheduled: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('scheduler.scheduleEmail', {
      userId: variables.id,
      template: 'follow-up',
      delayDays: 3,
    }),
});

// Compose workflow
export const userOnboardingWorkflow = workflow('user-onboarding')
  .name('User Onboarding')
  .description('Complete user registration with conditional premium handling')
  .version('1.0.0')
  .step(createAccount)
  .step(checkPremium)
  .step(notifySales)         // Conditional
  .step(parallelTasks)        // Parallel execution
  .step(scheduleFollowUp)
  .commit();

// Benefits:
// ✅ Full visibility (UI visualization)
// ✅ Full tracing (OpenTelemetry)
// ✅ Built-in retry logic
// ✅ Error handling
// ✅ Easy to modify (just edit workflow)
// ✅ Versioned in Git
// ✅ Can be optimized by AI
// ✅ Performance metrics automatic
// ✅ Easy to test (mock procedures)
```

**Total: ~100 lines, 3 files**

---

## 9. When to use each?

### Use Spring Boot when:
- ✅ Enterprise Java environment (existing Java teams)
- ✅ Legacy system integration (Java ecosystem)
- ✅ Need for Spring ecosystem (Spring Security, Spring Data, Spring Cloud)
- ✅ Mature, battle-tested framework needed
- ✅ Hiring: large pool of Java developers
- ❌ Fast iteration needed
- ❌ Modern DX priority
- ❌ AI-driven workflows

**Best for:** Large enterprises, banks, insurance companies with existing Java infrastructure.

### Use NestJS when:
- ✅ TypeScript-first team
- ✅ Need Angular-like architecture (familiar to Angular devs)
- ✅ Monolithic architecture
- ✅ Class-based OOP preferred
- ✅ Established project structure needed
- ❌ Need workflow engine
- ❌ Zero-boilerplate priority
- ❌ Platform deployment (still need DevOps)

**Best for:** TypeScript teams building traditional REST APIs, familiar with Angular patterns.

### Use tsdev when:
- ✅ **Workflow-heavy applications** (automation, AI agents, orchestration)
- ✅ **Zero-ops deployment** needed (git push → production)
- ✅ **Fast iteration** critical (startup, MVP)
- ✅ **Type safety** priority (compile-time + runtime)
- ✅ **AI integration** needed (AI agents composing workflows)
- ✅ **Observability** out of the box (logs, metrics, traces)
- ✅ **Functional programming** preferred
- ✅ **Platform services** needed (databases, cache, storage)
- ✅ **Small team** (no dedicated DevOps)

**Best for:** Startups, AI-driven applications, workflow automation, rapid prototyping, developer tools.

---

## 10. Feature Matrix

| Feature | Spring Boot | NestJS | **tsdev** |
|---------|-------------|--------|-----------|
| **Language** | Java | TypeScript | TypeScript |
| **Type Safety** | Runtime only | Weak (decorators) | **Strong (Zod)** |
| **Boilerplate** | High | Medium | **Minimal** |
| **Auto-discovery** | ❌ | ❌ | **✅** |
| **Workflow Engine** | ❌ (external) | ❌ (external) | **✅ (built-in)** |
| **Observability** | Manual setup | Manual setup | **Zero-config** |
| **Deployment** | Manual (K8s) | Manual (K8s) | **Git push** |
| **Database** | Manual setup | Manual setup | **One command** |
| **Redis** | Manual setup | Manual setup | **One command** |
| **S3 Storage** | Manual setup | Manual setup | **One command** |
| **Auto-scaling** | Manual setup | Manual setup | **Built-in** |
| **Preview deploys** | ❌ | ❌ | **✅** |
| **SSL certs** | Manual | Manual | **Automatic** |
| **Log aggregation** | Manual (ELK) | Manual | **Built-in** |
| **Distributed tracing** | Manual setup | Manual setup | **Automatic** |
| **AI integration** | ❌ | ❌ | **✅ (first-class)** |
| **Learning curve** | Steep | Medium | **Gentle** |
| **Ecosystem maturity** | Very mature | Mature | **New** |
| **Enterprise support** | ✅ | ✅ | **Coming** |
| **Time to production** | Weeks | Days | **Minutes** |

---

## 11. Architecture Philosophy

### Spring Boot / NestJS: **Framework Pattern**
```
You write: Application code (controllers, services, repositories)
You deploy: Docker → K8s → Cloud
You monitor: Setup Prometheus, Grafana, ELK
You scale: Configure HPA, tune resources
You manage: Databases, Redis, S3, secrets, CI/CD

Focus: How to structure your application code
```

### tsdev: **Platform Pattern**
```
You write: Business logic (procedures + workflows)
Platform deploys: Automatic (git push)
Platform monitors: Built-in (logs, metrics, traces)
Platform scales: Automatic (based on traffic)
Platform manages: All infrastructure (DB, Redis, S3, etc.)

Focus: What your application does (business logic)
```

**Analogy:**
- **Spring Boot/NestJS** = Linux (powerful, but you manage everything)
- **tsdev** = Heroku/Vercel (opinionated, but zero-ops)

---

## 12. Code Comparison Summary

### Creating CRUD API (Users)

| Metric | Spring Boot | NestJS | **tsdev** |
|--------|-------------|--------|-----------|
| **Files** | 15-20 | 10-15 | **2-3** |
| **Lines of code** | ~500 | ~350 | **~50** |
| **Setup time** | 2-4 hours | 1-2 hours | **5 minutes** |
| **Type safety** | Runtime | Weak | **Strong** |
| **Auto API docs** | Manual (Swagger) | Manual | **Automatic** |
| **Deploy time** | Weeks (K8s) | Days (K8s) | **Minutes** |

### Building Workflow (Onboarding)

| Metric | Spring Boot | NestJS | **tsdev** |
|--------|-------------|--------|-----------|
| **Approach** | Manual orchestration | BullMQ queues | **Built-in engine** |
| **Visibility** | ❌ | ⚠️ | **✅ (UI)** |
| **Tracing** | Manual | Manual | **Automatic** |
| **Retry logic** | Manual | Manual | **Built-in** |
| **Versioning** | ❌ | ❌ | **Git** |
| **AI optimization** | ❌ | ❌ | **✅** |

---

## 13. Уникальные преимущества tsdev

### 1. **Contract-First Architecture**
```typescript
// Single source of truth
const contract = {
  input: z.object({ ... }),
  output: z.object({ ... }),
};

// Automatic:
// - Runtime validation
// - Type inference
// - API documentation
// - Client generation
// - Error messages
```

**Конкуренты:** Validation + Types раздельно → can get out of sync

### 2. **Zero-Config Auto-Discovery**
```typescript
// Drop file in /handlers
export const createUser: Procedure = { ... };

// Automatic:
// - Registered in registry
// - Available at /rpc/users.create
// - Available at /users (REST)
// - In OpenAPI spec
// - In workflow palette
```

**Конкуренты:** Manual registration (modules, decorators)

### 3. **First-Class Workflows**
```typescript
// Declarative workflow definition
workflow('flow')
  .step(stepA)
  .step(stepB)
  .parallel([stepC, stepD])
  .commit();

// Automatic:
// - Visualization
// - Tracing
// - Retry logic
// - Error handling
// - Versioning (Git)
```

**Конкуренты:** External tools (Temporal, Camunda) or manual orchestration

### 4. **AI-Native Platform**
```typescript
// AI discovers procedures
GET /procedures

// AI composes workflows
POST /workflow/validate

// AI optimizes based on traces
GET /workflow/:id/traces

// AI commits improvements
git commit workflows/optimized.ts
```

**Конкуренты:** No AI integration

### 5. **Zero-Ops Deployment**
```bash
git push origin main
# → Production ready in 2 minutes

# Automatic:
# - Build
# - Test
# - Deploy
# - SSL
# - Scaling
# - Monitoring
# - Databases
# - All infrastructure
```

**Конкуренты:** Manual DevOps (weeks of work)

### 6. **Built-in Observability**
```typescript
// Write handler:
handler: async (input) => { ... }

// Get automatic:
// - Request logs
// - Distributed traces
// - Metrics dashboards
// - Error tracking
// - Performance analytics
```

**Конкуренты:** Manual setup (Prometheus, Grafana, ELK, etc.)

### 7. **Platform Services**
```bash
tsdev db:create postgres      # Managed PostgreSQL
tsdev cache:create redis      # Managed Redis
tsdev storage:create s3       # Managed S3

# Automatic:
# - Provisioning
# - Backups
# - Scaling
# - Connection strings
# - High availability
```

**Конкуренты:** Manual setup of each service

### 8. **Developer Experience**
```bash
# From zero to production:
tsdev init my-api             # 10s
cd my-api && pnpm install     # 20s
tsdev dev                      # 5s → localhost:3000
# Write handlers...           # 2-5 min
tsdev deploy                   # 2 min → production URL

# Total: 5 minutes
```

**Конкуренты:** Days to weeks (setup K8s, CI/CD, monitoring, etc.)

---

## 14. Недостатки tsdev (честное сравнение)

### ❌ Что tsdev НЕ может (пока):

1. **Ecosystem maturity**
   - Spring Boot: 20+ лет, огромная экосистема
   - NestJS: 7+ лет, большое community
   - tsdev: Новый проект → меньше библиотек, plugins, tutorials

2. **Enterprise features**
   - Spring Security (mature auth/authz)
   - Spring Cloud (service mesh, config server)
   - Spring Batch (batch processing)
   - → tsdev только начинает

3. **Performance (Java JIT)**
   - Spring Boot на JVM может быть быстрее для CPU-intensive задач
   - tsdev на Node.js → не лучший выбор для heavy computations

4. **Team skills**
   - Большой пул Java/Spring Boot разработчиков
   - NestJS devs тоже много
   - tsdev → нужно обучение новому подходу

5. **Control**
   - Spring/NestJS → full control над deployment, infrastructure
   - tsdev → platform берёт на себя → меньше контроля

6. **Legacy integration**
   - Spring Boot отлично интегрируется с Java legacy systems
   - tsdev → хуже для интеграции со старыми Java системами

### ⚠️ Когда НЕ использовать tsdev:

- ❌ CPU-intensive tasks (ML inference, video encoding)
- ❌ Legacy Java integration required
- ❌ Need full infrastructure control
- ❌ Team locked into Java
- ❌ Enterprise compliance (SOC2, HIPAA) - пока не готово
- ❌ On-premise deployment only (tsdev = cloud platform)

---

## 15. Заключение

### Spring Boot
**Best for:** Enterprise Java environments, legacy integration, mature ecosystem needed  
**Philosophy:** Comprehensive framework for Java applications  
**Trade-off:** Power + control ↔ complexity + setup time

### NestJS
**Best for:** TypeScript teams, Angular developers, traditional REST APIs  
**Philosophy:** Structured, opinionated TypeScript framework  
**Trade-off:** Structure + familiarity ↔ boilerplate + manual ops

### tsdev
**Best for:** AI-driven apps, workflow automation, rapid development, zero-ops deployment  
**Philosophy:** Platform + framework for workflow-based systems  
**Trade-off:** Speed + automation ↔ less control + newer ecosystem

---

## 🎯 Ключевые выводы

**tsdev НЕ конкурирует напрямую с Spring Boot/NestJS.**

Это разные категории:
- **Spring Boot/NestJS** = Application Frameworks (как писать код)
- **tsdev** = Application Platform (как создавать и эксплуатировать системы)

**Правильная аналогия:**
```
Spring Boot : Java :: Express : Node.js
NestJS : Angular :: React : Frontend
tsdev : Vercel :: Heroku : Rails

tsdev = Vercel + NestJS + Temporal + Datadog (all-in-one)
```

**Уникальное преимущество tsdev:**
1. ✅ **Contract-first** (Zod = types + validation + docs)
2. ✅ **Zero-boilerplate** (1 file = 1 API endpoint)
3. ✅ **Workflow engine** (first-class, built-in)
4. ✅ **AI-native** (designed for AI agents)
5. ✅ **Zero-ops** (git push → production)
6. ✅ **Platform services** (DB, cache, storage из коробки)
7. ✅ **Built-in observability** (logs, metrics, traces automatic)

**Выбирай tsdev если:**
- Workflow-heavy приложение
- Нужна быстрая разработка (startup, MVP)
- Маленькая команда (нет DevOps)
- AI integration
- Zero-ops приоритет

**Выбирай Spring Boot/NestJS если:**
- Enterprise Java окружение
- Нужен полный контроль
- Legacy интеграция
- Mature ecosystem критичен
- Большая команда с DevOps
