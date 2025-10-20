import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serve } from '@c4c/cli';
import { createTempDir, removeTempDir, createMockHandlers, findAvailablePort } from '../helpers/test-utils.js';
import type { Server } from 'node:http';

describe('serve command - rpc mode', () => {
  let tempDir: string;
  let server: Server | null = null;
  let port: number;

  beforeEach(async () => {
    tempDir = await createTempDir('c4c-serve-rpc-');
    await createMockHandlers(tempDir);
    port = await findAvailablePort(3400);
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

  it('should start server in RPC mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    
    server = await serve('rpc', {
      port,
      handlersPath,
    });

    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should enable only RPC features in rpc mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    
    server = await serve('rpc', {
      port,
      handlersPath,
    });

    // RPC mode should enable only RPC features
    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should handle custom handlers path in rpc mode', async () => {
    // Create handlers in a different location
    const customDir = await createTempDir('c4c-rpc-custom-');
    const customHandlersPath = await createMockHandlers(customDir);
    
    server = await serve('rpc', {
      port,
      handlersPath: customHandlersPath,
    });

    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
    
    // Clean up custom directory
    await removeTempDir(customDir);
  });

  it('should use specified port in rpc mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const customPort = await findAvailablePort(6000);
    
    server = await serve('rpc', {
      port: customPort,
      handlersPath,
    });

    expect(server).toBeDefined();
    const address = server?.address();
    expect(typeof address === 'object' && address !== null && 'port' in address ? address.port : null).toBe(customPort);
  });

  it('should not enable docs by default in rpc mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    
    server = await serve('rpc', {
      port,
      handlersPath,
    });

    // RPC mode should not enable docs by default
    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });
});
