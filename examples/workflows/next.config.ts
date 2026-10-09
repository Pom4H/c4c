import { fileURLToPath } from 'node:url';
import { withWorkflow } from 'workflow/next';

// The native SDK compiler must see the literal use workflow/use step functions.
// c4c does not add another scheduler, interpreter, queue or replay log.
export default withWorkflow({
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  transpilePackages: ['@c4c/core'],
  serverExternalPackages: ['@workflow/world-postgres'],
});
