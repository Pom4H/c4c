"use client";

/**
 * OpenTelemetry Trace Viewer Component
 */

import type { TraceSpan } from "@tsdev/workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface TraceViewerProps {
  spans: TraceSpan[];
}

export default function TraceViewer({ spans }: TraceViewerProps) {
  if (spans.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No trace data available. Execute a workflow to see traces.
      </div>
    );
  }

  // Sort spans by start time
  const sortedSpans = [...spans].sort((a, b) => a.startTime - b.startTime);

  // Find min start time for relative positioning
  const minStartTime = Math.min(...spans.map((s) => s.startTime));
  const maxEndTime = Math.max(...spans.map((s) => s.endTime));
  const totalDuration = maxEndTime - minStartTime;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-4">OpenTelemetry Trace Spans</h3>

      {/* Timeline visualization */}
      <div className="space-y-2">
        {sortedSpans.map((span) => {
          const relativeStart = span.startTime - minStartTime;
          const leftPercent = totalDuration > 0 ? (relativeStart / totalDuration) * 100 : 0;
          const widthPercent = totalDuration > 0 ? Math.max((span.duration / totalDuration) * 100, 0.5) : 100;

          const isError = span.status.code === "ERROR";
          const indent = (span.name.match(/\./g) || []).length * 20;

          return (
            <SpanItem
              key={span.spanId}
              span={span}
              leftPercent={leftPercent}
              widthPercent={widthPercent}
              isError={isError}
              indent={indent}
            />
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-2xl">{spans.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">Total Spans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-2xl">{totalDuration}ms</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">Total Duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-2xl">
              {spans.filter((s) => s.status.code === "OK").length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">Successful Spans</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface SpanItemProps {
  span: TraceSpan;
  leftPercent: number;
  widthPercent: number;
  isError: boolean;
  indent: number;
}

function SpanItem({ span, leftPercent, widthPercent, isError, indent }: SpanItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div
        className="mb-1 text-sm font-mono flex items-center"
        style={{ paddingLeft: `${indent}px` }}
      >
        <Badge variant={isError ? "destructive" : "default"} className="mr-2">
          {isError ? "ERROR" : "OK"}
        </Badge>
        <span className="font-semibold">{span.name}</span>
        <Badge variant="outline" className="ml-2">
          {span.duration}ms
        </Badge>
        {isError && (
          <span className="ml-2 text-destructive text-xs">
            ⚠ {span.status.message}
          </span>
        )}
      </div>

      <div className="relative bg-muted h-8 rounded">
        <div
          className={`absolute h-full rounded transition-all ${
            isError
              ? "bg-destructive hover:opacity-90"
              : "bg-primary hover:opacity-90"
          }`}
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
          }}
          title={`${span.name}: ${span.duration}ms`}
        />
      </div>

      {/* Span details */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          View span details
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Span ID:</span>
                  <p className="font-mono">{span.spanId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Trace ID:</span>
                  <p className="font-mono">{span.traceId}</p>
                </div>
                {span.parentSpanId && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Parent:</span>
                    <p className="font-mono">{span.parentSpanId}</p>
                  </div>
                )}
              </div>

              {Object.keys(span.attributes).length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Attributes</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(span.attributes, null, 2)}
                  </pre>
                </div>
              )}

              {span.events && span.events.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Events</h4>
                  <div className="space-y-2">
                    {span.events.map((event, idx) => (
                      <Card key={idx}>
                        <CardHeader className="p-3">
                          <CardTitle className="text-sm">{event.name}</CardTitle>
                        </CardHeader>
                        {event.attributes && (
                          <CardContent className="p-3 pt-0">
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(event.attributes, null, 2)}
                            </pre>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
