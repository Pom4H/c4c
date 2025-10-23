#!/usr/bin/env node
/**
 * Test script to verify procedures load correctly
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testLoadProcedures(appName, proceduresPath) {
  console.log(`\n📦 Testing ${appName}...`);
  
  try {
    const fullPath = join(__dirname, proceduresPath);
    console.log(`   Loading: ${fullPath}`);
    
    const module = await import(fullPath);
    
    const procedures = Object.entries(module).filter(([name, value]) => {
      return (
        typeof value === 'object' &&
        value !== null &&
        'contract' in value &&
        'handler' in value
      );
    });
    
    console.log(`   ✅ Found ${procedures.length} procedure(s):`);
    
    for (const [exportName, procedure] of procedures) {
      const name = procedure.contract.name || exportName;
      const isTrigger = procedure.contract.metadata?.type === 'trigger';
      const exposure = procedure.contract.metadata?.exposure || 'external';
      
      console.log(`      - ${name}${isTrigger ? ' (trigger)' : ''} [${exposure}]`);
    }
    
    return procedures.length;
  } catch (error) {
    console.error(`   ❌ Error loading procedures:`, error.message);
    return 0;
  }
}

async function main() {
  console.log('🧪 Testing Cross-Integration Apps\n');
  console.log('=' .repeat(50));
  
  const appACount = await testLoadProcedures(
    'App A (Task Manager)',
    './app-a/procedures/tasks.ts'
  );
  
  const appBCount = await testLoadProcedures(
    'App B (Notification Service)',
    './app-b/procedures/notifications.ts'
  );
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Summary:`);
  console.log(`   App A: ${appACount} procedures`);
  console.log(`   App B: ${appBCount} procedures`);
  console.log(`   Total: ${appACount + appBCount} procedures`);
  
  if (appACount > 0 && appBCount > 0) {
    console.log(`\n✅ All procedures loaded successfully!`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. cd app-a && c4c serve --port 3001`);
    console.log(`   2. cd app-b && c4c serve --port 3002`);
    console.log(`   3. ./scripts/integrate-apps.sh`);
  } else {
    console.log(`\n❌ Some procedures failed to load`);
    process.exit(1);
  }
}

main().catch(console.error);
