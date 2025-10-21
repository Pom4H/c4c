export type ServeMode = "all" | "rest" | "workflow" | "rpc";

export type DevSessionStatus = "running" | "stopping";

export interface DevSessionMetadata {
	id: string;
	pid: number;
	port: number;
	mode: ServeMode;
	projectRoot: string;
	handlersPath: string;
	logFile: string;
	startedAt: string;
	status: DevSessionStatus;
}

export interface DevSessionPaths {
	directory: string;
	sessionFile: string;
	logFile: string;
	logStateFile: string;
	stopSignalFile: string;
}

export interface DevLogState {
	lastReadBytes: number;
	updatedAt: string;
}

export interface DevLogReadResult {
	lines: string[];
	nextOffset: number;
}

export interface DiscoveredSession {
	paths: DevSessionPaths;
	metadata: DevSessionMetadata;
}

export type ConsoleMethod = "log" | "info" | "warn" | "error";

export interface LogWriter {
	write(method: ConsoleMethod, args: unknown[]): void;
	flush(): Promise<void>;
}
