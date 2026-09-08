CREATE TABLE `agent_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`workspaceId` int NOT NULL,
	`kind` enum('semantic','episodic','working','preference') NOT NULL DEFAULT 'semantic',
	`content` text NOT NULL,
	`source` varchar(160),
	`importance` int NOT NULL DEFAULT 50,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_tools` (
	`agentId` int NOT NULL,
	`toolId` int NOT NULL,
	`grantedBy` int,
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_tool_unique` UNIQUE(`agentId`,`toolId`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`departmentId` int,
	`name` varchar(120) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`role` varchar(160) NOT NULL,
	`avatar` varchar(8) NOT NULL,
	`accent` varchar(32) NOT NULL DEFAULT 'mint',
	`status` enum('online','working','idle','offline') NOT NULL DEFAULT 'idle',
	`model` varchar(120),
	`expertise` json NOT NULL,
	`permissions` json NOT NULL,
	`systemPrompt` text,
	`isRightHand` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_slug_unique` UNIQUE(`workspaceId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`workflowRunId` int,
	`requestedByAgentId` int,
	`requestedForUserId` int,
	`action` varchar(180) NOT NULL,
	`rationale` text NOT NULL,
	`payload` json,
	`status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_participants` (
	`conversationId` int NOT NULL,
	`agentId` int,
	`userId` int,
	`participantRole` enum('owner','member','observer') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_participant_unique` UNIQUE(`conversationId`,`agentId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`departmentId` int,
	`kind` enum('direct','group','right_hand','workflow') NOT NULL DEFAULT 'direct',
	`name` varchar(180) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`purpose` text NOT NULL,
	`color` varchar(32) NOT NULL DEFAULT 'mint',
	`status` enum('active','paused','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`departmentId` int,
	`title` varchar(220) NOT NULL,
	`sourceType` enum('document','url','note','database','conversation') NOT NULL DEFAULT 'document',
	`uri` text,
	`status` enum('ready','syncing','error','archived') NOT NULL DEFAULT 'ready',
	`chunkCount` int NOT NULL DEFAULT 0,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderAgentId` int,
	`senderUserId` int,
	`parentMessageId` int,
	`kind` enum('text','system','tool_call','tool_result','approval_request','workflow_event') NOT NULL DEFAULT 'text',
	`content` text NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`kind` enum('connector','function','browser','code','data') NOT NULL DEFAULT 'function',
	`description` text NOT NULL,
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
	`config` json,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tools_id` PRIMARY KEY(`id`),
	CONSTRAINT `tool_name_unique` UNIQUE(`workspaceId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` int NOT NULL,
	`workspaceId` int NOT NULL,
	`initiatedBy` int,
	`status` enum('queued','running','waiting_approval','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`input` json,
	`state` json,
	`output` json,
	`error` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`departmentId` int,
	`name` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`trigger` varchar(180) NOT NULL,
	`status` enum('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
	`graphDefinition` json NOT NULL,
	`requiresApproval` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`description` text,
	`rightHandAgentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `memory_agent_idx` ON `agent_memories` (`agentId`);--> statement-breakpoint
CREATE INDEX `memory_workspace_idx` ON `agent_memories` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `agent_workspace_idx` ON `agents` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `agent_department_idx` ON `agents` (`departmentId`);--> statement-breakpoint
CREATE INDEX `approval_workspace_idx` ON `approvals` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `approval_status_idx` ON `approvals` (`status`);--> statement-breakpoint
CREATE INDEX `conversation_workspace_idx` ON `conversations` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `conversation_department_idx` ON `conversations` (`departmentId`);--> statement-breakpoint
CREATE INDEX `department_workspace_idx` ON `departments` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `knowledge_workspace_idx` ON `knowledge_sources` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `knowledge_department_idx` ON `knowledge_sources` (`departmentId`);--> statement-breakpoint
CREATE INDEX `message_conversation_idx` ON `messages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `message_parent_idx` ON `messages` (`parentMessageId`);--> statement-breakpoint
CREATE INDEX `tool_workspace_idx` ON `tools` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `workflow_run_workflow_idx` ON `workflow_runs` (`workflowId`);--> statement-breakpoint
CREATE INDEX `workflow_run_workspace_idx` ON `workflow_runs` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `workflow_workspace_idx` ON `workflows` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `workspace_owner_idx` ON `workspaces` (`ownerId`);