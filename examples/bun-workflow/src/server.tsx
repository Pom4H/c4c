/**
 * Bun + Hono + JSX + tsdev Framework Example
 */

import { Hono } from "hono";
import { createRegistryFromProcedures } from "../../../dist/core/registry-helpers.js";
import { createWorkflowRoutes } from "../../../dist/adapters/hono-workflow.js";
import { demoProcedures } from "../../../dist/examples/index.js";
import { workflows } from "./workflows";

// Setup Registry using framework helper
const registry = createRegistryFromProcedures(demoProcedures);

// Create Hono app
const app = new Hono();

// Add workflow routes using framework adapter
createWorkflowRoutes(app, registry, workflows, { basePath: "/api/workflows" });

// Home page with JSX
app.get("/", (c) => {
  return c.html(
    <html>
      <head>
        <title>Bun + tsdev Workflow</title>
        <meta charSet="utf-8" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            max-width: 600px;
            width: 100%;
          }
          h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 32px;
          }
          .subtitle {
            color: #666;
            margin-bottom: 30px;
          }
          .workflow {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            cursor: pointer;
            transition: all 0.3s;
            border: 2px solid transparent;
          }
          .workflow:hover {
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
          }
          .workflow h3 {
            color: #333;
            margin-bottom: 8px;
          }
          .workflow p {
            color: #666;
            font-size: 14px;
          }
          #result {
            margin-top: 30px;
            padding: 20px;
            background: #e7f5ff;
            border-radius: 12px;
            border-left: 4px solid #667eea;
            display: none;
          }
          #result.show { display: block; }
          #result h3 {
            color: #667eea;
            margin-bottom: 10px;
          }
          #progress {
            margin-top: 10px;
            font-family: monospace;
            font-size: 13px;
            color: #495057;
          }
          .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .badge {
            display: inline-block;
            padding: 4px 12px;
            background: #667eea;
            color: white;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <h1>🚀 Bun + tsdev Framework</h1>
          <p className="subtitle">
            JSX rendering with Hono SSE workflow execution
          </p>
          
          <div 
            className="workflow"
            onclick="executeWorkflow('math-calculation')"
          >
            <h3>
              📊 Math Calculation
              <span className="badge">SSE</span>
            </h3>
            <p>Demonstrates: 10 + 5 = 15, then 15 × 2 = 30</p>
          </div>

          <div 
            className="workflow"
            onclick="executeWorkflow('greeting')"
          >
            <h3>
              👋 Greeting Workflow
              <span className="badge">SSE</span>
            </h3>
            <p>Simple greeting message generation</p>
          </div>

          <div id="result">
            <h3>Execution Result</h3>
            <div id="progress"></div>
          </div>
        </div>

        <script>{`
          async function executeWorkflow(workflowId) {
            const result = document.getElementById('result');
            const progress = document.getElementById('progress');
            
            result.classList.add('show');
            progress.innerHTML = '<div class="loading"></div> Connecting...';

            try {
              const response = await fetch(\`/api/workflows/\${workflowId}/execute\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: {} })
              });

              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\\n\\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (!line.trim()) continue;

                  const eventMatch = line.match(/^event: (.+)$/m);
                  const dataMatch = line.match(/^data: (.+)$/m);

                  if (eventMatch && dataMatch) {
                    const eventType = eventMatch[1];
                    const data = JSON.parse(dataMatch[1]);

                    switch (eventType) {
                      case 'workflow-start':
                        progress.innerHTML = \`<div class="loading"></div> ⚡ Started: \${data.workflowName}\`;
                        break;
                      case 'workflow-progress':
                        progress.innerHTML += \`<br>📍 Node executed: \${data.nodeId}\`;
                        break;
                      case 'workflow-complete':
                        progress.innerHTML += \`<br><br>✅ <strong>Completed in \${data.result.executionTime}ms</strong>\`;
                        progress.innerHTML += \`<br><br>📤 Output: <code>\${JSON.stringify(data.result.outputs, null, 2)}</code>\`;
                        break;
                      case 'workflow-error':
                        progress.innerHTML = \`❌ Error: \${data.error}\`;
                        break;
                    }
                  }
                }
              }
            } catch (error) {
              progress.innerHTML = \`❌ Error: \${error.message}\`;
            }
          }
        `}</script>
      </body>
    </html>
  );
});

// API routes are now handled by framework adapter above!

// Start server
const port = process.env.PORT || 3001;
console.log(`🚀 Bun server running at http://localhost:${port}`);
console.log(`📦 Using tsdev framework with Hono SSE`);

export default {
  port,
  fetch: app.fetch,
};
