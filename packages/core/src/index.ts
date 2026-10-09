/** Structural Standard Schema v1 interface. Zod, Valibot, etc. remain caller choices.
 * https://standardschema.dev/schema (MIT). No validator or runtime registry is bundled.
 */
export interface Schema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: { readonly input: Input; readonly output: Output };
    readonly validate: (value: unknown) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: readonly Issue[] }
      | PromiseLike<{ readonly value: Output; readonly issues?: undefined } | { readonly issues: readonly Issue[] }>;
  };
}
export interface Issue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[];
}
export type InputOf<S extends Schema> = NonNullable<S['~standard']['types']>['input'];
export type OutputOf<S extends Schema> = NonNullable<S['~standard']['types']>['output'];
export interface Contract<I extends Schema, O extends Schema> {
  readonly input: I;
  readonly output: O;
  readonly description?: string;
}
export class ContractError extends Error {
  readonly stage: 'input' | 'output';
  readonly issues: readonly Issue[];
  constructor(stage: 'input' | 'output', issues: readonly Issue[]) {
    super(`Contract validation failed: ${stage}`);
    this.name = 'ContractError';
    this.stage = stage;
    this.issues = issues;
  }
}
async function parse<S extends Schema>(schema: S, value: unknown, stage: 'input' | 'output'): Promise<OutputOf<S>> {
  const result = await schema['~standard'].validate(value);
  if (result.issues) throw new ContractError(stage, result.issues);
  return result.value as OutputOf<S>;
}
/** A real function, not an entry in engine.run(). Both boundaries validate at runtime.
 * Transforming schemas preserve input/output inference on BOTH sides of the handler.
 * Identity, authorization, retries and durable execution belong to the application.
 */
export function define<I extends Schema, O extends Schema>(
  contract: Contract<I, O>,
  handler: (input: OutputOf<I>) => InputOf<O> | PromiseLike<InputOf<O>>,
): ((input: InputOf<I>) => Promise<OutputOf<O>>) & { readonly contract: Contract<I, O> } {
  const descriptor = Object.freeze({ ...contract });
  const call = async (input: InputOf<I>): Promise<OutputOf<O>> =>
    parse(descriptor.output, await handler(await parse(descriptor.input, input, 'input')), 'output');
  return Object.defineProperty(call, 'contract', { value: descriptor, enumerable: true }) as
    typeof call & { readonly contract: Contract<I, O> };
}
