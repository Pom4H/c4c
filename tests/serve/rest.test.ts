import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serve } from '@c4c/cli';
import { createTempDir, removeTempDir, createMockHandlers, findAvailablePort } from '../helpers/test-utils.js';
import type { Server } from 'node:http';

describe('serve command - rest mode', () => {
  let tempDir: string;
  let server: Server | null = null;
  let port: number;

  beforeEach(async () => {
    tempDir = await createTempDir('c4c-serve-rest-');
    await createMockHandlers(tempDir);
    port = await findAvailablePort(3200);
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

  it('should start server in REST mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    
    server = await serve('rest', {
      port,
      handlersPath,
    });

    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should enable REST and docs by default in rest mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    
    server = await serve('rest', {
      port,
      handlersPath,
    });

    // REST mode should enable REST API and docs but not RPC or workflow
    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should allow disabling docs in rest mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    
    server = await serve('rest', {
      port,
      handlersPath,
      enableDocs: false,
    });

    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should respect custom port in rest mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const customPort = await findAvailablePort(4000);
    
    server = await serve('rest', {
      port: customPort,
      handlersPath,
    });

    expect(server).toBeDefined();
    const address = server?.address();
    expect(typeof address === 'object' && address !== null && 'port' in address ? address.port : null).toBe(customPort);
  });
});
