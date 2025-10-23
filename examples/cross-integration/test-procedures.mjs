#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing procedure loading...\n');

try {
  const tasksPath = join(__dirname, 'app-a/procedures/tasks.ts');
  console.log('Loading:', tasksPath);
  const tasksModule = await import(tasksPath);
  
  const procedures = Object.entries(tasksModule).filter(([_, val]) => 
    val && typeof val === 'object' && 'contract' in val && 'handler' in val
  );
  
  console.log(`✅ Found ${procedures.length} procedures in App A`);
  procedures.forEach(([name, proc]) => {
    console.log(`   - ${proc.contract.name || name}`);
  });
} catch (error) {
  console.error('❌ Error:', error.message);
}
