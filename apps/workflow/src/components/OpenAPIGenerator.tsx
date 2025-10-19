"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, Upload, Download, Code, Webhook, Key } from "lucide-react";

interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

interface GenerationStats {
  totalOperations: number;
  webhookOperations: number;
  oauthCallbackOperations: number;
  apiOperations: number;
  hasOAuth: boolean;
}

interface GeneratedFiles {
  contracts: string;
  handlers: string;
  types?: string;
  zodSchemas?: string;
  webhooks?: string;
  oauthCallbacks?: string;
  index: string;
  packageJson: string;
}

interface LoadedModule {
  id: string;
  name: string;
  version: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  gitBranch?: string;
  gitCommit?: string;
  procedureCount: number;
  procedures: string[];
}

interface OpenAPIGeneratorProps {
  apiBaseUrl?: string;
}

export default function OpenAPIGenerator({ apiBaseUrl = "http://localhost:3000" }: OpenAPIGeneratorProps) {
  const [spec, setSpec] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    stats?: GenerationStats;
    error?: string;
  } | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFiles | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>("contracts");
  const [loadedModules, setLoadedModules] = useState<LoadedModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [moduleDetails, setModuleDetails] = useState<any>(null);
  const [generationOptions, setGenerationOptions] = useState({
    baseUrl: "https://api.example.com",
    timeout: 30000,
    retries: 3,
    generateTypes: true,
    generateWebhooks: true,
    generateOAuthCallbacks: true,
    loadDynamically: true,
  });

  const validateSpec = useCallback(async () => {
    if (!spec.trim()) {
      setValidationResult({ valid: false, error: "Please enter an OpenAPI spec" });
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch(`${apiBaseUrl}/openapi/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ spec: JSON.parse(spec) }),
      });

      const result = await response.json();
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        valid: false,
        error: error instanceof Error ? error.message : "Validation failed",
      });
    } finally {
      setIsValidating(false);
    }
  }, [spec, apiBaseUrl]);

  const generateCode = useCallback(async () => {
    if (!spec.trim() || !validationResult?.valid) {
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${apiBaseUrl}/openapi/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spec: JSON.parse(spec),
          options: generationOptions,
          loadDynamically: generationOptions.loadDynamically,
        }),
      });

      const result = await response.json();
      if (result.success) {
        if (generationOptions.loadDynamically && result.module) {
          // Module was loaded dynamically
          await loadModules(); // Refresh modules list
          setSelectedModule(result.module.id);
          await loadModuleDetails(result.module.id);
        } else {
          // Return files for download
          setGeneratedFiles(result.files);
        }
      } else {
        throw new Error(result.error || "Generation failed");
      }
    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [spec, validationResult, generationOptions, apiBaseUrl]);

  const loadModules = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/openapi/modules`);
      const result = await response.json();
      if (result.modules) {
        setLoadedModules(result.modules);
      }
    } catch (error) {
      console.error("Failed to load modules:", error);
    }
  }, [apiBaseUrl]);

  const loadModuleDetails = useCallback(async (moduleId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/openapi/modules/${moduleId}`);
      const result = await response.json();
      if (result.id) {
        setModuleDetails(result);
      }
    } catch (error) {
      console.error("Failed to load module details:", error);
    }
  }, [apiBaseUrl]);

  const reloadModule = useCallback(async (moduleId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/openapi/modules/${moduleId}/reload`, {
        method: "POST",
      });
      const result = await response.json();
      if (result.success) {
        await loadModules();
        await loadModuleDetails(moduleId);
      }
    } catch (error) {
      console.error("Failed to reload module:", error);
    }
  }, [apiBaseUrl, loadModules, loadModuleDetails]);

  const unloadModule = useCallback(async (moduleId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/openapi/modules/${moduleId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        await loadModules();
        if (selectedModule === moduleId) {
          setSelectedModule(null);
          setModuleDetails(null);
        }
      }
    } catch (error) {
      console.error("Failed to unload module:", error);
    }
  }, [apiBaseUrl, loadModules, selectedModule]);

  const downloadFile = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadAll = useCallback(() => {
    if (!generatedFiles) return;

    const files = [
      { name: "contracts.ts", content: generatedFiles.contracts },
      { name: "handlers.ts", content: generatedFiles.handlers },
      { name: "index.ts", content: generatedFiles.index },
      { name: "package.json", content: generatedFiles.packageJson },
    ];

    if (generatedFiles.types) {
      files.push({ name: "types.ts", content: generatedFiles.types });
    }
    if (generatedFiles.zodSchemas) {
      files.push({ name: "schemas.ts", content: generatedFiles.zodSchemas });
    }
    if (generatedFiles.webhooks) {
      files.push({ name: "webhooks.ts", content: generatedFiles.webhooks });
    }
    if (generatedFiles.oauthCallbacks) {
      files.push({ name: "oauth-callbacks.ts", content: generatedFiles.oauthCallbacks });
    }

    files.forEach(file => downloadFile(file.name, file.content));
  }, [generatedFiles, downloadFile]);

  const loadTemplate = useCallback(async (templateName: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/openapi/templates`);
      const data = await response.json();
      const template = data.templates[templateName];
      if (template) {
        setSpec(JSON.stringify(template.spec, null, 2));
      }
    } catch (error) {
      console.error("Failed to load template:", error);
    }
  }, [apiBaseUrl]);

  // Load modules on component mount
  useEffect(() => {
    loadModules();
  }, [loadModules]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            OpenAPI to tsdev Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Upload an OpenAPI/Swagger specification to automatically generate tsdev contracts, handlers, and webhook endpoints.
          </p>
        </CardContent>
      </Card>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>OpenAPI Specification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplate("basic")}
            >
              Load Basic Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplate("webhook")}
            >
              Load Webhook Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplate("oauth")}
            >
              Load OAuth Template
            </Button>
          </div>

          <div>
            <Label htmlFor="openapi-spec">OpenAPI Spec (JSON)</Label>
            <Textarea
              id="openapi-spec"
              placeholder="Paste your OpenAPI specification here..."
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="loadDynamically"
                checked={generationOptions.loadDynamically}
                onChange={(e) =>
                  setGenerationOptions(prev => ({ ...prev, loadDynamically: e.target.checked }))
                }
                className="rounded"
              />
              <Label htmlFor="loadDynamically" className="text-sm">
                Load dynamically on server (recommended)
              </Label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={validateSpec}
                disabled={isValidating || !spec.trim()}
                className="flex-1"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Validate Spec
                  </>
                )}
              </Button>
              <Button
                onClick={generateCode}
                disabled={!validationResult?.valid || isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {generationOptions.loadDynamically ? "Loading..." : "Generating..."}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {generationOptions.loadDynamically ? "Load & Generate" : "Generate Code"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Result */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.valid ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Validation Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {validationResult.valid ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Valid OpenAPI Specification</AlertTitle>
                  <AlertDescription>
                    The specification is valid and ready for code generation.
                  </AlertDescription>
                </Alert>

                {validationResult.stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{validationResult.stats.totalOperations}</div>
                      <div className="text-sm text-muted-foreground">Total Operations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{validationResult.stats.apiOperations}</div>
                      <div className="text-sm text-muted-foreground">API Operations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{validationResult.stats.webhookOperations}</div>
                      <div className="text-sm text-muted-foreground">Webhooks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{validationResult.stats.oauthCallbackOperations}</div>
                      <div className="text-sm text-muted-foreground">OAuth Callbacks</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Invalid Specification</AlertTitle>
                <AlertDescription>
                  {validationResult.error || "The OpenAPI specification is invalid."}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loaded Modules */}
      {loadedModules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Loaded Modules ({loadedModules.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadedModules.map((module) => (
                <div
                  key={module.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedModule === module.id ? "border-primary bg-muted" : "hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    setSelectedModule(module.id);
                    loadModuleDetails(module.id);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{module.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {module.procedureCount} procedures • {module.source} • {module.version}
                      </p>
                      {module.gitBranch && (
                        <Badge variant="outline" className="mt-1">
                          {module.gitBranch}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          reloadModule(module.id);
                        }}
                      >
                        Reload
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          unloadModule(module.id);
                        }}
                      >
                        Unload
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Module Details */}
      {moduleDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Module Details: {moduleDetails.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">ID</Label>
                  <p className="text-sm text-muted-foreground">{moduleDetails.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Source</Label>
                  <p className="text-sm text-muted-foreground">{moduleDetails.source}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Version</Label>
                  <p className="text-sm text-muted-foreground">{moduleDetails.version}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Procedures</Label>
                  <p className="text-sm text-muted-foreground">{moduleDetails.procedures?.length || 0}</p>
                </div>
              </div>

              {moduleDetails.gitBranch && (
                <div>
                  <Label className="text-sm font-medium">Git Branch</Label>
                  <p className="text-sm text-muted-foreground">{moduleDetails.gitBranch}</p>
                </div>
              )}

              {moduleDetails.procedures && moduleDetails.procedures.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Available Procedures</Label>
                  <div className="mt-2 space-y-2">
                    {moduleDetails.procedures.map((proc: any) => (
                      <div key={proc.name} className="p-2 bg-muted rounded">
                        <div className="font-medium">{proc.name}</div>
                        <div className="text-sm text-muted-foreground">{proc.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Code */}
      {generatedFiles && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Generated Code
              </span>
              <Button onClick={downloadAll} size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedFile} onValueChange={setSelectedFile}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="contracts">Contracts</TabsTrigger>
                <TabsTrigger value="handlers">Handlers</TabsTrigger>
                <TabsTrigger value="index">Index</TabsTrigger>
                <TabsTrigger value="package">Package</TabsTrigger>
              </TabsList>

              <TabsContent value="contracts" className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>contracts.ts</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile("contracts.ts", generatedFiles.contracts)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
                    {generatedFiles.contracts}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="handlers" className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>handlers.ts</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile("handlers.ts", generatedFiles.handlers)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
                    {generatedFiles.handlers}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="index" className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>index.ts</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile("index.ts", generatedFiles.index)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
                    {generatedFiles.index}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="package" className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>package.json</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile("package.json", generatedFiles.packageJson)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
                    {generatedFiles.packageJson}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}