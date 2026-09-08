CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`actorUserId` int,
	`actorAgentId` int,
	`action` varchar(160) NOT NULL,
	`resourceType` varchar(80) NOT NULL,
	`resourceId` varchar(80),
	`outcome` enum('success','denied','failed','pending') NOT NULL DEFAULT 'success',
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tool_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`agentId` int,
	`toolId` int NOT NULL,
	`workflowRunId` int,
	`status` enum('queued','running','completed','failed','denied') NOT NULL DEFAULT 'queued',
	`input` json,
	`output` json,
	`error` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tool_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_workspace_idx` ON `audit_logs` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `tool_run_workspace_idx` ON `tool_runs` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `tool_run_status_idx` ON `tool_runs` (`status`);