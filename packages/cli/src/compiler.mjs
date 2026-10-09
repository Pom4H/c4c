// Keep upstream codegen isolated. No regex re-parsing, schema guessing or c4c runtime
// wrappers in the generated SDK. The exact upstream version is pinned in package.json.
export const GENERATOR = '@hey-api/openapi-ts@0.99.0';
export async function generate(input, output) {
  const { createClient } = await import('@hey-api/openapi-ts');
  await createClient({
    input, output, configFile: false,
    plugins: ['@hey-api/typescript', '@hey-api/client-fetch', 'zod',
      { name: '@hey-api/sdk', validator: true }],
  });
}
