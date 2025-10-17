import { avitoItemMonitoringWorkflow } from "./avito-item-monitoring.js";
import { driveFileRecoveryWorkflow } from "./drive-file-recovery.js";
import { googleDriveInventoryWorkflow } from "./google-drive-inventory.js";
import { integratedOperationsWorkflow } from "./integrated-operations.js";
import { multiSourceSnapshotWorkflow } from "./multi-source-snapshot.js";
import { complexWorkflow } from "./complex-workflow.js";
import { conditionalProcessingWorkflow } from "./conditional-processing.js";
import { errorDemoWorkflow } from "./error-demo.js";
import { mathCalculationWorkflow } from "./math-calculation.js";
import { parallelTasksWorkflow } from "./parallel-tasks.js";

export {
	avitoItemMonitoringWorkflow,
	driveFileRecoveryWorkflow,
	googleDriveInventoryWorkflow,
	integratedOperationsWorkflow,
	multiSourceSnapshotWorkflow,
	complexWorkflow,
	conditionalProcessingWorkflow,
	errorDemoWorkflow,
	mathCalculationWorkflow,
	parallelTasksWorkflow,
};

export const workflows = [
	avitoItemMonitoringWorkflow,
	driveFileRecoveryWorkflow,
	googleDriveInventoryWorkflow,
	integratedOperationsWorkflow,
	multiSourceSnapshotWorkflow,
	complexWorkflow,
	conditionalProcessingWorkflow,
	errorDemoWorkflow,
	mathCalculationWorkflow,
	parallelTasksWorkflow,
] as const;
