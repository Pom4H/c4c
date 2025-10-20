import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateClient } from '@c4c/cli';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createTempDir, removeTempDir, createMockHandlers } from '../helpers/test-utils.js';

describe('generate client command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('c4c-generate-client-');
    await createMockHandlers(tempDir);
  });

  afterEach(async () => {
    await removeTempDir(tempDir);
  });

  it('should generate client file', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const outFile = join(tempDir, 'c4c-client.ts');

    const outputPath = await generateClient({
      handlersPath,
      outFile,
    });

    expect(outputPath).toBe(outFile);
    
    // Verify file was created
    const fileExists = await fs.access(outFile).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('should generate valid TypeScript client code', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const outFile = join(tempDir, 'client.ts');

    await generateClient({
      handlersPath,
      outFile,
    });

    const content = await fs.readFile(outFile, 'utf8');
    
    // Client should contain TypeScript code
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
  });

  it('should use custom base URL when provided', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const outFile = join(tempDir, 'client-custom.ts');
    const baseUrl = 'https://api.example.com';

    await generateClient({
      handlersPath,
      outFile,
      baseUrl,
    });

    const content = await fs.readFile(outFile, 'utf8');
    expect(content).toContain(baseUrl);
  });

  it('should create output directory if it does not exist', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const outFile = join(tempDir, 'nested', 'deep', 'client.ts');

    await generateClient({
      handlersPath,
      outFile,
    });

    const fileExists = await fs.access(outFile).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('should handle different output file names', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const customFileName = 'my-custom-client.ts';
    const outFile = join(tempDir, customFileName);

    const outputPath = await generateClient({
      handlersPath,
      outFile,
    });

    expect(outputPath).toBe(outFile);
    expect(outputPath).toContain(customFileName);
  });

  it('should handle custom handlers path', async () => {
    const customBase = `${tempDir}/custom`;
    await createMockHandlers(customBase);
    const handlersPath = `${customBase}/src/handlers`;
    const outFile = join(tempDir, 'client.ts');

    await generateClient({
      handlersPath,
      outFile,
    });

    const fileExists = await fs.access(outFile).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('should overwrite existing client file', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const outFile = join(tempDir, 'client.ts');

    // Generate once
    await generateClient({
      handlersPath,
      outFile,
    });

    const firstContent = await fs.readFile(outFile, 'utf8');

    // Generate again
    await generateClient({
      handlersPath,
      outFile,
      baseUrl: 'https://different.com',
    });

    const secondContent = await fs.readFile(outFile, 'utf8');
    
    // Content should be different (has new baseUrl)
    expect(secondContent).not.toBe(firstContent);
  });

  it('should generate client without base URL', async () => {
    const handlersPath = `${tempDir}/src/handlers`;
    const outFile = join(tempDir, 'client-no-base.ts');

    await generateClient({
      handlersPath,
      outFile,
      // No baseUrl provided
    });

    const content = await fs.readFile(outFile, 'utf8');
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
  });
});
