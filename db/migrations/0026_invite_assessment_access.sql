ALTER TABLE `invite_channels` ADD `assessment_access` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `invite_channels` ADD `assessment_kinds` json;--> statement-breakpoint
ALTER TABLE `student_profile` ADD `released_assessments` json;
