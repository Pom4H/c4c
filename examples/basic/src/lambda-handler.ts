#!/usr/bin/env node
/**
 * AWS Lambda handler for tsdev API
 */

import { collectRegistry, executeProcedure, createExecutionContext } from '@tsdev/core';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { Registry } from '@tsdev/core';

// Cold start optimization: cache registry between invocations
let registry: Registry | null = null;

/**
 * Initialize registry (lazy loading)
 */
async function initRegistry(): Promise<Registry> {
  if (!registry) {
    console.log('🔍 Cold start: Collecting procedures...');
    const startTime = Date.now();
    
    registry = await collectRegistry('./handlers');
    
    const duration = Date.now() - startTime;
    console.log(`✅ Registry initialized in ${duration}ms with ${registry.size} procedures`);
  }
  return registry;
}

/**
 * Parse request body
 */
function parseBody(body: string | null): unknown {
  if (!body) return {};
  
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Create success response
 */
function successResponse(data: unknown, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(data),
  };
}

/**
 * Create error response
 */
function errorResponse(message: string, statusCode = 500): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Main Lambda handler
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  
  try {
    // Initialize registry
    const reg = await initRegistry();
    
    const path = event.path || event.rawPath || '/';
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
    
    console.log(`📥 ${method} ${path}`, {
      requestId: context.requestId,
      functionVersion: context.functionVersion,
    });
    
    // CORS preflight
    if (method === 'OPTIONS') {
      return successResponse({ message: 'OK' }, 200);
    }
    
    // Health check
    if (path === '/health' && method === 'GET') {
      return successResponse({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        procedures: reg.size,
        coldStart: Date.now() - startTime < 1000,
        version: process.env.npm_package_version || 'unknown',
      });
    }
    
    // Introspection: GET /procedures
    if (path === '/procedures' && method === 'GET') {
      const procedures = Array.from(reg.entries()).map(([name, proc]) => ({
        name,
        description: proc.contract.description,
        metadata: proc.contract.metadata,
      }));
      
      return successResponse({ procedures });
    }
    
    // RPC execution: POST /rpc/:procedureName
    if (path.startsWith('/rpc/') && method === 'POST') {
      const procedureName = path.slice(5);
      const procedure = reg.get(procedureName);
      
      if (!procedure) {
        return errorResponse(`Procedure '${procedureName}' not found`, 404);
      }
      
      // Parse input
      const input = parseBody(event.body);
      
      // Create execution context
      const execContext = createExecutionContext({
        transport: 'lambda',
        requestId: context.requestId,
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        awsRequestId: event.requestContext.requestId,
        sourceIp: event.requestContext.identity?.sourceIp,
        userAgent: event.requestContext.identity?.userAgent,
      });
      
      // Execute procedure
      const result = await executeProcedure(procedure, input, execContext);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Procedure executed in ${duration}ms`);
      
      return successResponse(result);
    }
    
    // Not found
    return errorResponse('Not found', 404);
    
  } catch (error) {
    console.error('❌ Lambda error:', error);
    
    // Zod validation errors
    if (error && typeof error === 'object' && 'issues' in error) {
      return errorResponse(
        'Validation error: ' + JSON.stringify(error),
        400
      );
    }
    
    // Generic errors
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}
