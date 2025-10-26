import { PausedWorkflows } from "@/components/PausedWorkflows";

export default function PausedPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Paused Workflows</h1>
        <p className="text-muted-foreground">
          Monitor and manage workflows waiting for external events or human approval
        </p>
      </div>
      <PausedWorkflows />
    </div>
  );
}
