import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';

const BASE_URL_A = 'http://localhost:3001';
const BASE_URL_B = 'http://localhost:3002';
const CLI_BIN = join(__dirname, '../../../apps/cli/dist/bin.js');

let appA: ChildProcess | null = null;
let appB: ChildProcess | null = null;

async function waitForServer(url: string, timeout = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`${url}/openapi.json`);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

async function rpcCall(baseUrl: string, procedure: string, input: any = {}): Promise<any> {
  const response = await fetch(`${baseUrl}/rpc/${procedure}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  const data = await response.json();
  
  if (!response.ok || data.error) {
    const errorMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : data.error;
    throw new Error(errorMsg || `RPC call failed: ${procedure}`);
  }
  
  return data;
}

describe('Cross-Integration Tests', () => {
  beforeAll(async () => {
    // Start App A
    console.log('Starting App A...');
    appA = spawn('node', [CLI_BIN, 'serve', '--port', '3001', '--root', '.'], {
      cwd: join(__dirname, '../app-a'),
      env: {
        ...process.env,
        NOTIFICATION_SERVICE_URL: BASE_URL_B,
        NOTIFICATION_SERVICE_TOKEN: 'test-token',
      },
    });

    // Start App B
    console.log('Starting App B...');
    appB = spawn('node', [CLI_BIN, 'serve', '--port', '3002', '--root', '.'], {
      cwd: join(__dirname, '../app-b'),
      env: {
        ...process.env,
        TASK_MANAGER_URL: BASE_URL_A,
        TASK_MANAGER_TOKEN: 'test-token',
      },
    });

    // Wait for both servers to start
    console.log('Waiting for servers to start...');
    await Promise.all([
      waitForServer(BASE_URL_A),
      waitForServer(BASE_URL_B),
    ]);
    console.log('Both servers started successfully');

    // Perform integration
    console.log('Performing cross-integration...');
    
    // Integrate App B into App A
    const integrateA = spawn('node', [
      CLI_BIN,
      'integrate',
      `${BASE_URL_B}/openapi.json`,
      '--name',
      'notification-service'
    ], {
      cwd: join(__dirname, '../app-a'),
    });
    
    await new Promise<void>((resolve, reject) => {
      integrateA.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Integration A failed with code ${code}`));
      });
    });

    // Integrate App A into App B
    const integrateB = spawn('node', [
      CLI_BIN,
      'integrate',
      `${BASE_URL_A}/openapi.json`,
      '--name',
      'task-manager'
    ], {
      cwd: join(__dirname, '../app-b'),
    });
    
    await new Promise<void>((resolve, reject) => {
      integrateB.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Integration B failed with code ${code}`));
      });
    });

    // Restart servers to load integrated procedures
    console.log('Restarting servers to load integrated procedures...');
    appA?.kill();
    appB?.kill();
    await new Promise(resolve => setTimeout(resolve, 2000));

    appA = spawn('node', [CLI_BIN, 'serve', '--port', '3001', '--root', '.'], {
      cwd: join(__dirname, '../app-a'),
      env: {
        ...process.env,
        NOTIFICATION_SERVICE_URL: BASE_URL_B,
        NOTIFICATION_SERVICE_TOKEN: 'test-token',
      },
    });

    appB = spawn('node', [CLI_BIN, 'serve', '--port', '3002', '--root', '.'], {
      cwd: join(__dirname, '../app-b'),
      env: {
        ...process.env,
        TASK_MANAGER_URL: BASE_URL_A,
        TASK_MANAGER_TOKEN: 'test-token',
      },
    });

    await Promise.all([
      waitForServer(BASE_URL_A),
      waitForServer(BASE_URL_B),
    ]);
    console.log('Servers restarted successfully');
  }, 60000);

  afterAll(() => {
    console.log('Stopping servers...');
    appA?.kill();
    appB?.kill();
  });

  describe('Basic functionality', () => {
    it('should create a task in App A', async () => {
      const task = await rpcCall(BASE_URL_A, 'tasks.create', {
        title: 'Test Task',
        description: 'Test description',
        status: 'todo',
        priority: 'high',
      });

      expect(task).toBeDefined();
      expect(task.id).toBeTruthy();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('high');
    });

    it('should list tasks from App A', async () => {
      const result = await rpcCall(BASE_URL_A, 'tasks.list', {});

      expect(result).toBeDefined();
      expect(result.tasks).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should send notification from App B', async () => {
      const notification = await rpcCall(BASE_URL_B, 'notifications.send', {
        message: 'Test notification',
        channel: 'push',
        priority: 'normal',
      });

      expect(notification).toBeDefined();
      expect(notification.id).toBeTruthy();
      expect(notification.message).toBe('Test notification');
    });

    it('should list notifications from App B', async () => {
      const result = await rpcCall(BASE_URL_B, 'notifications.list', {});

      expect(result).toBeDefined();
      expect(result.notifications).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('Cross-app integration', () => {
    it('should call App A procedures from App B', async () => {
      // App B calls task-manager.tasks.list (App A procedure)
      const result = await rpcCall(BASE_URL_B, 'task-manager.tasks.list', {});

      expect(result).toBeDefined();
      expect(result.tasks).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should call App B procedures from App A', async () => {
      // App A calls notification-service.notifications.list (App B procedure)
      const result = await rpcCall(BASE_URL_A, 'notification-service.notifications.list', {});

      expect(result).toBeDefined();
      expect(result.notifications).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should create task via App A and retrieve it via App B', async () => {
      // Create task in App A
      const task = await rpcCall(BASE_URL_A, 'tasks.create', {
        title: 'Cross-integration Task',
        status: 'todo',
        priority: 'medium',
      });

      expect(task.id).toBeTruthy();

      // Retrieve same task from App B
      const retrievedTask = await rpcCall(BASE_URL_B, 'task-manager.tasks.get', {
        id: task.id,
      });

      expect(retrievedTask).toBeDefined();
      expect(retrievedTask.id).toBe(task.id);
      expect(retrievedTask.title).toBe('Cross-integration Task');
    });

    it('should send notification via App A and retrieve it from App B', async () => {
      // Send notification from App A (via integrated App B procedure)
      const notification = await rpcCall(BASE_URL_A, 'notification-service.notifications.send', {
        message: 'Notification from App A',
        channel: 'email',
        priority: 'high',
      });

      expect(notification.id).toBeTruthy();

      // List notifications in App B
      const result = await rpcCall(BASE_URL_B, 'notifications.list', {});

      expect(result.notifications).toBeDefined();
      expect(result.notifications.length).toBeGreaterThan(0);
      
      const sentNotification = result.notifications.find((n: any) => n.id === notification.id);
      expect(sentNotification).toBeDefined();
      expect(sentNotification.message).toBe('Notification from App A');
    });

    it('should update task from App A and see changes from App B', async () => {
      // Create task
      const task = await rpcCall(BASE_URL_A, 'tasks.create', {
        title: 'Task to Update',
        status: 'todo',
      });

      // Update task from App A
      const updated = await rpcCall(BASE_URL_A, 'tasks.update', {
        id: task.id,
        status: 'in_progress',
        description: 'Updated description',
      });

      expect(updated.status).toBe('in_progress');

      // Retrieve from App B and verify changes
      const retrieved = await rpcCall(BASE_URL_B, 'task-manager.tasks.get', {
        id: task.id,
      });

      expect(retrieved.status).toBe('in_progress');
      expect(retrieved.description).toBe('Updated description');
    });
  });
});
