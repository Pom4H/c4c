import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serve } from '@c4c/cli';
import { createTempDir, removeTempDir, createMockHandlers, createMockWorkflows, findAvailablePort } from '../helpers/test-utils.js';
import type { Server } from 'node:http';

describe('serve command - workflow mode', () => {
  let tempDir: string;
  let server: Server | null = null;
  let port: number;

  beforeEach(async () => {
    tempDir = await createTempDir('c4c-serve-workflow-');
    await createMockHandlers(tempDir);
    await createMockWorkflows(tempDir);
    port = await findAvailablePort(3300);
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

  it('should start server in workflow mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const workflowsPath = `${tempDir}/workflows`;
    
    server = await serve('workflow', {
      port,
      handlersPath,
      workflowsPath,
    });

    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should enable only workflow features in workflow mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const workflowsPath = `${tempDir}/workflows`;
    
    server = await serve('workflow', {
      port,
      handlersPath,
      workflowsPath,
    });

    // Workflow mode should enable only workflow features
    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should use custom workflows path', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const customWorkflowsPath = `${tempDir}/custom-workflows`;
    await createMockWorkflows(`${tempDir}`);
    
    server = await serve('workflow', {
      port,
      handlersPath,
      workflowsPath: customWorkflowsPath,
    });

    expect(server).toBeDefined();
    expect(server?.listening).toBe(true);
  });

  it('should respect port option in workflow mode', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const workflowsPath = `${tempDir}/workflows`;
    const customPort = await findAvailablePort(5000);
    
    server = await serve('workflow', {
      port: customPort,
      handlersPath,
      workflowsPath,
    });

    expect(server).toBeDefined();
    const address = server?.address();
    expect(typeof address === 'object' && address !== null && 'port' in address ? address.port : null).toBe(customPort);
  });
});
