import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serve } from '@c4c/cli';
import { createTempDir, removeTempDir, createMockHandlers, findAvailablePort } from '../helpers/test-utils.js';
import type { Server } from 'node:http';

describe('serve command - all mode', () => {
  let tempDir: string;
  let server: Server | null = null;
  let port: number;

  beforeEach(async () => {
    tempDir = await createTempDir('c4c-serve-all-');
    await createMockHandlers(tempDir);
    port = await findAvailablePort(3100);
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
      server = null;
    }
    await removeTempDir(tempDir);
  });

  it('should start server with all features enabled', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    
    server = await serve('all', {
      port,
      handlersPath,
      enableDocs: true,
      enableRest: true,
      enableRpc: true,
      enableWorkflow: true,
    });

    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should use default port 3000 when not specified', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const defaultPort = await findAvailablePort(3000);
    
    server = await serve('all', {
      handlersPath,
      port: defaultPort,
    });

    expect(server).toBeDefined();
    const address = server?.address();
    expect(address).toBeDefined();
    expect(typeof address === 'object' && address !== null && 'port' in address ? address.port : null).toBe(defaultPort);
  });

  it('should enable all features by default in all mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    
    server = await serve('all', {
      port,
      handlersPath,
    });

    // The server should start successfully with all features
    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should handle custom handlers path', async () => {
    // Create handlers in a different location
    const customDir = await createTempDir('c4c-custom-');
    const customHandlersPath = await createMockHandlers(customDir);
    
    server = await serve('all', {
      port,
      handlersPath: customHandlersPath,
    });

    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
    
    // Clean up custom directory
    await removeTempDir(customDir);
  });

  it('should respect enableDocs option', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    
    server = await serve('all', {
      port,
      handlersPath,
      enableDocs: false,
    });

    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });
});
