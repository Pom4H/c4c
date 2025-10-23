/**
 * @c4c/generators - Code generators
 * 
 * Generate OpenAPI specs, SDKs, and more from contracts
 */

export {
  generateOpenAPISpec,
  generateOpenAPIJSON,
  generateOpenAPIYAML,
} from "./openapi.js";
export { generateRpcClientModule, type RpcClientGeneratorOptions } from "./client.js";
export {
  generateTriggers,
  generateProceduresFromTriggers,
  type TriggerGeneratorOptions,
} from "./triggers.js";
