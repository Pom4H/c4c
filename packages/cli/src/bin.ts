#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { integrate, check, update, outputDirectory } from './project.js';

const HELP = `c4c 0.2 — ordinary functions, reviewable integrations

c4c integrate <public-https-spec|local.json> --name <name> [--out <directory>]
c4c check <directory> [--against <spec>] [--json]
c4c update <directory> --expect <candidateHash> [--against <spec>]

integrate: snapshot + independent Fetch SDK + Zod validation (no c4c runtime).
check: read-only drift check. Exit 0 unchanged, 2 needs review, 1 unavailable/error.
update: regenerate only the reviewed hash. Never edits handwritten adapters.

OpenAPI 3.0/3.1 bundled JSON only. No WSDL, YAML, implicit webhooks or API calls.
Use local files for private specifications. Keep generated files in version control.
`;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    name: { type: 'string' }, out: { type: 'string' }, against: { type: 'string' },
    expect: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  const [command, argument, extra] = positionals;
  if (values.help || !command) console.log(HELP);
  else {
    if (!argument || extra || !['integrate', 'check', 'update'].includes(command)) throw new Error('Invalid arguments; use c4c --help');
    if (command === 'integrate') {
      if (!values.name || values.against || values.expect) throw new Error('integrate needs --name; --against/--expect are not accepted');
      const lock = await integrate(argument, values.out ?? outputDirectory(values.name));
      console.log(JSON.stringify(lock, null, 2));
    } else if (command === 'check') {
      if (values.name || values.out || values.expect) throw new Error('Unexpected check option');
      const report = await check(argument, values.against);
      console.log(values.json ? JSON.stringify(report, null, 2) :
        [report.status.toUpperCase(), `Candidate: ${report.candidateHash}`, ...report.changes.map(c => `${c.kind} ${c.path}`),
          ...(report.truncated ? ['Further changes omitted; inspect the snapshots'] : []),
          ...(report.generatorChanged ? ['Generator version changed; regenerate and review'] : [])].join('\n'));
      process.exitCode = report.reviewRequired || report.generatorChanged ? 2 : 0;
    } else {
      if (!values.expect || values.name || values.out) throw new Error('update needs --expect, without --name/--out');
      console.log(JSON.stringify(await update(argument, values.expect, values.against), null, 2));
    }
  }
} catch (error) {
  // Never dump a request, headers, source response or env. Details belong in local diagnostics.
  console.error(error instanceof Error ? error.message : 'c4c failed');
  process.exitCode = 1;
}
