import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Creates a temporary directory for testing
 */
export async function createTempDir(prefix = 'c4c-test-'): Promise<string> {
  const tempPath = join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempPath, { recursive: true });
  return tempPath;
}

/**
 * Recursively removes a directory
 */
export async function removeTempDir(path: string): Promise<void> {
  try {
    await fs.rm(path, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * Creates a mock handlers directory with sample files
 */
export async function createMockHandlers(baseDir: string): Promise<string> {
  const handlersDir = join(baseDir, 'src', 'handlers');
  await fs.mkdir(handlersDir, { recursive: true });

  // Create a sample handler file
  const handlerContent = `
export async function testHandler(input: { message: string }) {
  return { result: \`Processed: \${input.message}\` };
}

export const metadata = {
  name: 'testHandler',
  description: 'A test handler',
};
`;

  await fs.writeFile(join(handlersDir, 'test.ts'), handlerContent, 'utf8');
  
  return handlersDir;
}

/**
 * Creates a mock workflows directory with sample files
 */
export async function createMockWorkflows(baseDir: string): Promise<string> {
  const workflowsDir = join(baseDir, 'workflows');
  await fs.mkdir(workflowsDir, { recursive: true });

  // Create a sample workflow file
  const workflowContent = `
export const workflow = {
  name: 'test-workflow',
  steps: [
    { action: 'testHandler', input: { message: 'test' } }
  ]
};
`;

  await fs.writeFile(join(workflowsDir, 'test.ts'), workflowContent, 'utf8');
  
  return workflowsDir;
}

/**
 * Waits for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Mock environment variables
 */
export function withEnv<T>(envVars: Record<string, string>, fn: () => T): T {
  const originalEnv = { ...process.env };
  
  try {
    Object.assign(process.env, envVars);
    return fn();
  } finally {
    process.env = originalEnv;
  }
}

/**
 * Checks if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = require('node:net').createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

/**
 * Finds an available port starting from the given port
 */
export async function findAvailablePort(startPort = 3000): Promise<number> {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
  }
  return port;
}
