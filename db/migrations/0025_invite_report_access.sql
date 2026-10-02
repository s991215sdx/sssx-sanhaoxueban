ALTER TABLE `invite_channels` ADD `report_access` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `invite_channels` ADD `report_kinds` json;
