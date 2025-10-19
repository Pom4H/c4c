/**
 * @tsdev/generators - Code generators
 * 
 * Generate OpenAPI specs, SDKs, and more from contracts
 */

export {
  generateOpenAPISpec,
  generateOpenAPIJSON,
  generateOpenAPIYAML,
} from "./openapi.js";
export { generateRpcClientModule, type RpcClientGeneratorOptions } from "./client.js";

// OpenAPI to tsdev generators
export {
  OpenAPIGenerator,
  generateFromOpenAPI,
  type OpenAPIGeneratorOptions,
  type GeneratedFiles,
} from "./openapi-generator.js";
export {
  OpenAPIParser,
  parseOpenAPISpec,
  type OpenAPISpec,
  type ParsedOperation,
} from "./openapi-parser.js";
export {
  ContractGenerator,
  type GeneratedContract,
} from "./contract-generator.js";
export {
  HandlerGenerator,
  type GeneratedHandler,
  type HandlerGeneratorOptions,
} from "./handler-generator.js";
