"use client";

/**
 * Span Gantt Chart Component
 * Advanced timeline visualization for OpenTelemetry spans
 */

import { useMemo, useState } from "react";
import type { TraceSpan } from "@/lib/workflow/types";

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

  const getSpanColor = (span: TraceSpan) => {
    if (span.status.code === "ERROR") {
      return "bg-red-500 hover:bg-red-600";
    }
    // Color by span kind or attributes
    const nodeType = span.attributes["node.type"];
    if (nodeType === "procedure") return "bg-green-500 hover:bg-green-600";
    if (nodeType === "condition") return "bg-yellow-500 hover:bg-yellow-600";
    if (nodeType === "parallel") return "bg-purple-500 hover:bg-purple-600";
    return "bg-blue-500 hover:bg-blue-600";
  };

  const selectedSpanData = useMemo(
    () => spans.find((s) => s.spanId === selectedSpan),
    [spans, selectedSpan]
  );

  if (spans.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No trace data available. Execute a workflow to see the Gantt chart.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Span Gantt Chart</h3>
        <div className="text-sm text-gray-600">
          Total Duration: {timelineMetrics.totalDuration}ms | Spans:{" "}
          {spans.length}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span>Procedure</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded" />
          <span>Condition</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-500 rounded" />
          <span>Parallel</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded" />
          <span>Other</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span>Error</span>
        </div>
      </div>

      {/* Gantt Chart Container */}
      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
        {/* Time axis header */}
        <div className="border-b border-gray-300 bg-gray-50">
          <div className="flex">
            {/* Span name column header */}
            <div className="w-64 flex-shrink-0 p-3 font-semibold text-sm border-r border-gray-300">
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
                  <div className="border-l border-gray-300 h-full" />
                  <span className="absolute top-2 -translate-x-1/2 text-xs text-gray-600 whitespace-nowrap">
                    {marker.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Span rows */}
        <div className="max-h-[500px] overflow-y-auto">
          {flatSpans.map((row, idx) => {
            const { span, level } = row;
            const { leftPercent, widthPercent } = getSpanPosition(span);
            const isHovered = hoveredSpan === span.spanId;
            const isSelected = selectedSpan === span.spanId;
            const isError = span.status.code === "ERROR";

            return (
              <div
                key={span.spanId}
                className={`flex border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                  isSelected ? "bg-blue-100" : ""
                } ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
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
                  className="w-64 flex-shrink-0 p-3 border-r border-gray-300 flex items-center"
                  style={{ paddingLeft: `${12 + level * 20}px` }}
                >
                  {level > 0 && (
                    <span className="text-gray-400 mr-2">└─</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          isError ? "bg-red-500" : "bg-green-500"
                        }`}
                      />
                      {span.name}
                    </div>
                    <div className="text-xs text-gray-500">
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
                      className="absolute top-0 bottom-0 border-l border-gray-200"
                      style={{ left: `${marker.position}%` }}
                    />
                  ))}

                  {/* Span bar */}
                  <div className="relative h-8 flex items-center">
                    <div
                      className={`absolute h-6 rounded shadow-sm transition-all ${getSpanColor(
                        span
                      )} ${
                        isHovered || isSelected
                          ? "ring-2 ring-blue-400 z-10 scale-105"
                          : ""
                      }`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        minWidth: "4px",
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
      </div>

      {/* Selected span details panel */}
      {selectedSpanData && (
        <div className="mt-4 p-4 bg-white border border-gray-300 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <h4 className="text-lg font-bold">{selectedSpanData.name}</h4>
            <button
              onClick={() => setSelectedSpan(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600">Duration</div>
              <div className="font-semibold">{selectedSpanData.duration}ms</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <div
                className={`font-semibold ${
                  selectedSpanData.status.code === "OK"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {selectedSpanData.status.code}
                {selectedSpanData.status.message &&
                  ` - ${selectedSpanData.status.message}`}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Span ID</div>
              <div className="font-mono text-xs">{selectedSpanData.spanId}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Trace ID</div>
              <div className="font-mono text-xs">
                {selectedSpanData.traceId}
              </div>
            </div>
            {selectedSpanData.parentSpanId && (
              <div>
                <div className="text-sm text-gray-600">Parent Span</div>
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
              <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                {Object.entries(selectedSpanData.attributes).map(
                  ([key, value]) => (
                    <div key={key} className="mb-1">
                      <span className="text-blue-600">{key}:</span>{" "}
                      <span className="text-gray-800">
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
                  <div key={idx} className="bg-gray-50 p-3 rounded">
                    <div className="font-semibold text-sm">{event.name}</div>
                    <div className="text-xs text-gray-600">
                      Timestamp: {event.timestamp}
                    </div>
                    {event.attributes && (
                      <pre className="mt-2 text-xs bg-white p-2 rounded overflow-x-auto">
                        {JSON.stringify(event.attributes, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Statistics Panel */}
      <div className="mt-4 grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">
            {spans.length}
          </div>
          <div className="text-sm text-blue-600">Total Spans</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-700">
            {spans.filter((s) => s.status.code === "OK").length}
          </div>
          <div className="text-sm text-green-600">Successful</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-700">
            {spans.filter((s) => s.status.code === "ERROR").length}
          </div>
          <div className="text-sm text-red-600">Errors</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-700">
            {Math.round(
              spans.reduce((sum, s) => sum + s.duration, 0) / spans.length
            )}
            ms
          </div>
          <div className="text-sm text-purple-600">Avg Duration</div>
        </div>
      </div>
    </div>
  );
}
