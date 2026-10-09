import { define, type Schema } from '../packages/core/src/index.js';
const numericText: Schema<string, number> = { '~standard': { version: 1, vendor: 'types', validate: () => ({ value: 1 }) } };
const callable = define({ input: numericText, output: numericText }, (n: number) => String(n));
const good: Promise<number> = callable('42');
void good;
// @ts-expect-error input follows the BEFORE-transform type
callable(42);
// @ts-expect-error output is the AFTER-transform type
const wrong: Promise<string> = callable('42');
void wrong;
// @ts-expect-error handler receives validated number, not raw string
const wrongHandler = define({ input: numericText, output: numericText }, (s: string) => s);
void wrongHandler;
// @ts-expect-error output schema accepts string, not its transformed number
const wrongOutput = define({ input: numericText, output: numericText }, () => 42);
void wrongOutput;
