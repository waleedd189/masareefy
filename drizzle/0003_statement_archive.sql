CREATE TABLE `statements` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`card_id` text,
	`source` text DEFAULT 'PDF' NOT NULL,
	`period_from` integer,
	`period_to` integer,
	`rows_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`total_in` real DEFAULT 0 NOT NULL,
	`total_out` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EGP' NOT NULL,
	`file_hash` text,
	`notes` text,
	`imported_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `statement_card_idx` ON `statements` (`card_id`);--> statement-breakpoint
CREATE INDEX `statement_imported_idx` ON `statements` (`imported_at`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `statement_id` text;--> statement-breakpoint
CREATE INDEX `tx_statement_idx` ON `transactions` (`statement_id`);