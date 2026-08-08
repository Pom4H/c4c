"use client";

/**
 * Span Gantt Chart Component
 * Advanced timeline visualization for OpenTelemetry spans
 */

import { useMemo, useState } from "react";
import type { TraceSpan } from "@/lib/useworkflow/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface SpanGanttChartProps {
  spans: TraceSpan[];
}

interface SpanRow {
  span: TraceSpan;
  level: number;
  children: SpanRow[];
}

export default function SpanGanttChart({ spans }: SpanGanttChartProps) {
  const [hoveredSpan, setHoveredSpan] = useState<string | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<string | null>(null);

  // Build span hierarchy
  const spanHierarchy = useMemo(() => {
    if (spans.length === 0) return [];
    

    const spanMap = new Map<string, TraceSpan>();
    spans.forEach((span) => spanMap.set(span.spanId, span));

    const buildTree = (span: TraceSpan, level: number): SpanRow => {
      const children = spans
        .filter((s) => s.parentSpanId === span.spanId)
        .sort((a, b) => a.startTime - b.startTime)
        .map((child) => buildTree(child, level + 1));

      return { span, level, children };
    };

    // Find root spans (no parent or parent not in this trace)
    const rootSpans = spans
      .filter((s) => !s.parentSpanId || !spanMap.has(s.parentSpanId))
      .sort((a, b) => a.startTime - b.startTime);

    return rootSpans.map((root) => buildTree(root, 0));
  }, [spans]);

  // Flatten hierarchy for rendering
  const flatSpans = useMemo(() => {
    if (spans.length === 0) return [];
    

    const result: SpanRow[] = [];
    const flatten = (row: SpanRow) => {
      result.push(row);
      row.children.forEach(flatten);
    };
    spanHierarchy.forEach(flatten);
    return result;
  }, [spanHierarchy, spans.length]);

  // Calculate timeline metrics
  const timelineMetrics = useMemo(() => {
    if (spans.length === 0) {
      return {
        minStartTime: 0,
        maxEndTime: 0,
        totalDuration: 0,
        timeMarkers: [],
      };
    }
    

    const minStartTime = Math.min(...spans.map((s) => s.startTime));
    const maxEndTime = Math.max(...spans.map((s) => s.endTime));
    const totalDuration = maxEndTime - minStartTime;

    // Generate time markers
    const markerCount = 10;
    const timeMarkers = Array.from({ length: markerCount + 1 }, (_, i) => {
      const time = minStartTime + (totalDuration * i) / markerCount;
      return {
        position: (i / markerCount) * 100,
        label: `${Math.round(time - minStartTime)}ms`,
        absoluteTime: time,
      };
    });

    return {
      minStartTime,
      maxEndTime,
      totalDuration,
      timeMarkers,
    };
  }, [spans]);

  const getSpanPosition = (span: TraceSpan) => {
    const { minStartTime, totalDuration } = timelineMetrics;
    const relativeStart = span.startTime - minStartTime;
    const leftPercent = (relativeStart / totalDuration) * 100;
    const widthPercent = Math.max((span.duration / totalDuration) * 100, 0.5);
    return { leftPercent, widthPercent };
  };

  const getSpanColor = (span: TraceSpan): string => {
    if (span.status.code === "ERROR") {
      return "#ef4444"; // Red for errors
    }
    // Color by span kind or attributes
    const nodeType = span.attributes["node.type"];
    if (nodeType === "procedure") return "#4ade80"; // Green
    if (nodeType === "condition") return "#fbbf24"; // Yellow
    if (nodeType === "parallel") return "#818cf8"; // Purple
    return "#60a5fa"; // Blue for other types
  };

  const selectedSpanData = useMemo(
    () => spans.find((s) => s.spanId === selectedSpan),
    [spans, selectedSpan]
  );

  if (spans.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No trace data available. Execute a workflow to see the Gantt chart.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Span Gantt Chart</h3>
        <div className="text-sm text-muted-foreground">
          Total Duration: {timelineMetrics.totalDuration}ms | Spans:{" "}
          {spans.length}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: "#4ade80" }} />
          <span>Procedure</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: "#fbbf24" }} />
          <span>Condition</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: "#818cf8" }} />
          <span>Parallel</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: "#60a5fa" }} />
          <span>Sequential</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: "#ef4444" }} />
          <span>Error</span>
        </div>
      </div>

      {/* Gantt Chart Container */}
      <Card className="overflow-hidden">
        {/* Time axis header */}
        <div className="border-b">
          <div className="flex">
            {/* Span name column header */}
            <div className="w-64 flex-shrink-0 p-3 font-semibold text-sm border-r">
              Span Name
            </div>
            {/* Timeline header */}
            <div className="flex-1 relative h-12">
              {timelineMetrics.timeMarkers.map((marker, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 flex flex-col justify-center"
                  style={{ left: `${marker.position}%` }}
                >
                  <div className="border-l border-border h-full" />
                  <span className="absolute top-2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
                    {marker.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Span rows */}
        <div className="max-h-[500px] overflow-y-auto overflow-x-hidden">
          {flatSpans.map((row, idx) => {
            const { span, level } = row;
            const { leftPercent, widthPercent } = getSpanPosition(span);
            const isHovered = hoveredSpan === span.spanId;
            const isSelected = selectedSpan === span.spanId;
            const isError = span.status.code === "ERROR";

            return (
              <div
                key={span.spanId}
                className={`flex border-b hover:bg-accent transition-colors ${
                  isSelected ? "bg-accent" : ""
                } ${idx % 2 === 0 ? "bg-muted/50" : ""}`}
                onMouseEnter={() => setHoveredSpan(span.spanId)}
                onMouseLeave={() => setHoveredSpan(null)}
                onClick={() =>
                  setSelectedSpan(
                    selectedSpan === span.spanId ? null : span.spanId
                  )
                }
              >
                {/* Span name column */}
                <div
                  className="w-64 flex-shrink-0 p-3 border-r flex items-center"
                  style={{ paddingLeft: `${12 + level * 20}px` }}
                >
                  {level > 0 && (
                    <span className="text-muted-foreground mr-2">└─</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      <Badge
                        variant={isError ? "destructive" : "default"}
                        className="h-2 w-2 p-0 rounded-full"
                      />
                      {span.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {span.duration}ms
                    </div>
                  </div>
                </div>

                {/* Timeline column */}
                <div className="flex-1 relative p-3 cursor-pointer">
                  {/* Grid lines */}
                  {timelineMetrics.timeMarkers.map((marker, idx) => (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0 border-l border-border/50"
                      style={{ left: `${marker.position}%` }}
                    />
                  ))}

                  {/* Span bar */}
                  <div className="relative h-8 flex items-center">
                    <div
                      className={`absolute h-6 rounded shadow-sm transition-all ${
                        isHovered || isSelected
                          ? "ring-2 ring-ring z-10 scale-105"
                          : ""
                      }`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        minWidth: "4px",
                        backgroundColor: getSpanColor(span),
                      }}
                      title={`${span.name}: ${span.duration}ms`}
                    >
                      {/* Duration label (only show if wide enough) */}
                      {widthPercent > 5 && (
                        <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-semibold">
                          {span.duration}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Selected span details panel */}
      {selectedSpanData && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg">{selectedSpanData.name}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSpan(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="font-semibold">{selectedSpanData.duration}ms</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <Badge
                  variant={
                    selectedSpanData.status.code === "OK"
                      ? "default"
                      : "destructive"
                  }
                >
                  {selectedSpanData.status.code}
                  {selectedSpanData.status.message &&
                    ` - ${selectedSpanData.status.message}`}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Span ID</div>
                <div className="font-mono text-xs">{selectedSpanData.spanId}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Trace ID</div>
                <div className="font-mono text-xs">
                  {selectedSpanData.traceId}
                </div>
              </div>
              {selectedSpanData.parentSpanId && (
                <div>
                  <div className="text-sm text-muted-foreground">Parent Span</div>
                  <div className="font-mono text-xs">
                    {selectedSpanData.parentSpanId}
                  </div>
                </div>
              )}
            </div>

            {/* Attributes */}
            {Object.keys(selectedSpanData.attributes).length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-semibold mb-2">Attributes</div>
                <div className="bg-muted p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                  {Object.entries(selectedSpanData.attributes).map(
                    ([key, value]) => (
                      <div key={key} className="mb-1">
                        <span className="text-primary">{key}:</span>{" "}
                        <span>
                          {JSON.stringify(value)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Events */}
            {selectedSpanData.events && selectedSpanData.events.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-semibold mb-2">Events</div>
                <div className="space-y-2">
                  {selectedSpanData.events.map((event, idx) => (
                    <Card key={idx}>
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm">{event.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="text-xs text-muted-foreground mb-2">
                          Timestamp: {event.timestamp}
                        </div>
                        {event.attributes && (
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(event.attributes, null, 2)}
                          </pre>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics Panel */}
      <div className="mt-4 grid grid-cols-4 gap-4">
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
            <CardTitle className="text-2xl">
              {spans.filter((s) => s.status.code === "OK").length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">Successful</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-2xl">
              {spans.filter((s) => s.status.code === "ERROR").length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-2xl">
              {Math.round(
                spans.reduce((sum, s) => sum + s.duration, 0) / spans.length
              )}
              ms
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">Avg Duration</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
