CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`person` text NOT NULL,
	`direction` text DEFAULT 'OWED_BY_ME' NOT NULL,
	`amount` real NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EGP' NOT NULL,
	`due_date` integer,
	`card_id` text,
	`notes` text,
	`is_settled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_amount` real NOT NULL,
	`saved_amount` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EGP' NOT NULL,
	`due_date` integer,
	`emoji` text DEFAULT '🎯' NOT NULL,
	`color` text DEFAULT 'brand' NOT NULL,
	`notes` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parser_words` (
	`id` text PRIMARY KEY NOT NULL,
	`word_key` text NOT NULL,
	`display` text NOT NULL,
	`kind` text DEFAULT 'PURCHASE' NOT NULL,
	`category_id` text,
	`origin` text DEFAULT 'USER' NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`is_protected` integer DEFAULT false NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parser_words_key_idx` ON `parser_words` (`word_key`,`kind`);--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`amount` real NOT NULL,
	`direction` text DEFAULT 'OUT' NOT NULL,
	`kind` text DEFAULT 'SUBSCRIPTION' NOT NULL,
	`interval` text DEFAULT 'MONTHLY' NOT NULL,
	`day_of_month` integer,
	`card_id` text,
	`category_id` text,
	`next_run_at` integer,
	`last_run_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `sender_links` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_key` text NOT NULL,
	`last4` text DEFAULT '' NOT NULL,
	`card_id` text NOT NULL,
	`category_id` text,
	`label` text,
	`auto_file` integer DEFAULT true NOT NULL,
	`approved_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sender_links_key_idx` ON `sender_links` (`sender_key`,`last4`);--> statement-breakpoint
ALTER TABLE `api_tokens` ADD `token_hash` text;--> statement-breakpoint
ALTER TABLE `cards` ADD `account_type` text DEFAULT 'CARD' NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `design` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `decision` text DEFAULT 'REVIEW' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `reasons` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `goal_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `recurring_id` text;