ALTER TABLE `knowledge_points` ADD `stage` enum('小学','初中','高中') NOT NULL DEFAULT '初中';
--> statement-breakpoint
ALTER TABLE `knowledge_points` ADD `grade` varchar(16) NOT NULL DEFAULT '初一';
