"use client";
import dynamic from 'next/dynamic';
import type { TraceSpan } from '@tsdev/workflow';

const Inner = dynamic(() => import('../../../examples/workflow-viz/src/components/TraceViewer'), { ssr: false });

export default function TraceViewer({ spans }: { spans: TraceSpan[] }) {
  return <Inner spans={spans} />;
}
