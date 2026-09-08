CREATE TABLE `message_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`workspaceId` int NOT NULL,
	`kind` enum('file','image','audio','video','document') NOT NULL DEFAULT 'file',
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`fileSize` int NOT NULL DEFAULT 0,
	`storageKey` text NOT NULL,
	`url` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `messages` ADD `isStarred` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `editedAt` timestamp;--> statement-breakpoint
ALTER TABLE `messages` ADD `deletedAt` timestamp;--> statement-breakpoint
CREATE INDEX `attachment_message_idx` ON `message_attachments` (`messageId`);--> statement-breakpoint
CREATE INDEX `attachment_workspace_idx` ON `message_attachments` (`workspaceId`);