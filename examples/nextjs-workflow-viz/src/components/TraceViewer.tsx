"use client";

/**
 * OpenTelemetry Trace Viewer Component
 */

import type { TraceSpan } from "@/lib/workflow/types";

interface TraceViewerProps {
	spans: TraceSpan[];
}

export default function TraceViewer({ spans }: TraceViewerProps) {
	if (spans.length === 0) {
		return (
			<div className="text-center text-gray-500 py-8">
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
					const leftPercent = (relativeStart / totalDuration) * 100;
					const widthPercent = (span.duration / totalDuration) * 100;

					const isError = span.status.code === "ERROR";
					const indent = (span.name.match(/\./g) || []).length * 20;

					return (
						<div key={span.spanId} className="relative">
							<div
								className="mb-1 text-sm font-mono flex items-center"
								style={{ paddingLeft: `${indent}px` }}
							>
								<span
									className={`inline-block w-3 h-3 rounded-full mr-2 ${
										isError ? "bg-red-500" : "bg-green-500"
									}`}
								/>
								<span className="font-semibold">{span.name}</span>
								<span className="ml-2 text-gray-600">({span.duration}ms)</span>
								{isError && (
									<span className="ml-2 text-red-600 text-xs">⚠ {span.status.message}</span>
								)}
							</div>

							<div className="relative bg-gray-100 h-8 rounded">
								<div
									className={`absolute h-full rounded transition-all ${
										isError ? "bg-red-400 hover:bg-red-500" : "bg-blue-400 hover:bg-blue-500"
									}`}
									style={{
										left: `${leftPercent}%`,
										width: `${widthPercent}%`,
									}}
									title={`${span.name}: ${span.duration}ms`}
								/>
							</div>

							{/* Span details */}
							<details className="mt-1 text-xs text-gray-600">
								<summary className="cursor-pointer hover:text-gray-900">View span details</summary>
								<div className="mt-2 pl-4 space-y-1">
									<div>
										<strong>Span ID:</strong> {span.spanId}
									</div>
									<div>
										<strong>Trace ID:</strong> {span.traceId}
									</div>
									{span.parentSpanId && (
										<div>
											<strong>Parent:</strong> {span.parentSpanId}
										</div>
									)}
									<div>
										<strong>Attributes:</strong>
										<pre className="mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
											{JSON.stringify(span.attributes, null, 2)}
										</pre>
									</div>
									{span.events && span.events.length > 0 && (
										<div>
											<strong>Events:</strong>
											{span.events.map((event, idx) => (
												<div key={idx} className="ml-2 mt-1">
													<div className="font-semibold">{event.name}</div>
													{event.attributes && (
														<pre className="text-xs bg-gray-50 p-1 rounded overflow-x-auto">
															{JSON.stringify(event.attributes, null, 2)}
														</pre>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							</details>
						</div>
					);
				})}
			</div>

			{/* Summary stats */}
			<div className="mt-6 grid grid-cols-3 gap-4">
				<div className="bg-blue-50 p-4 rounded-lg">
					<div className="text-2xl font-bold text-blue-700">{spans.length}</div>
					<div className="text-sm text-blue-600">Total Spans</div>
				</div>
				<div className="bg-green-50 p-4 rounded-lg">
					<div className="text-2xl font-bold text-green-700">{totalDuration}ms</div>
					<div className="text-sm text-green-600">Total Duration</div>
				</div>
				<div className="bg-purple-50 p-4 rounded-lg">
					<div className="text-2xl font-bold text-purple-700">
						{spans.filter((s) => s.status.code === "OK").length}
					</div>
					<div className="text-sm text-purple-600">Successful Spans</div>
				</div>
			</div>
		</div>
	);
}
