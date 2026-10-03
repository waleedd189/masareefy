CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_idx` ON `api_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bank_key` text DEFAULT 'generic' NOT NULL,
	`bank_name` text DEFAULT '' NOT NULL,
	`brand` text DEFAULT 'VISA' NOT NULL,
	`last4` text NOT NULL,
	`type` text DEFAULT 'CREDIT' NOT NULL,
	`currency` text DEFAULT 'EGP' NOT NULL,
	`credit_limit` real,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`current_balance` real DEFAULT 0 NOT NULL,
	`available_amount` real,
	`balance_synced_at` integer,
	`statement_day` integer,
	`due_day` integer,
	`color` text DEFAULT 'emerald' NOT NULL,
	`notes` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cards_last4_idx` ON `cards` (`last4`);--> statement-breakpoint
CREATE INDEX `cards_archived_idx` ON `cards` (`is_archived`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🏷️' NOT NULL,
	`color` text DEFAULT 'slate' NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`monthly_budget` real,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_idx` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_text` text NOT NULL,
	`sender` text,
	`received_at` integer NOT NULL,
	`hash` text NOT NULL,
	`status` text DEFAULT 'NEEDS_REVIEW' NOT NULL,
	`bank_key` text,
	`confidence` real DEFAULT 0 NOT NULL,
	`parsed` text,
	`card_id` text,
	`error` text,
	`source` text DEFAULT 'PASTE' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_hash_idx` ON `messages` (`hash`);--> statement-breakpoint
CREATE INDEX `messages_status_idx` ON `messages` (`status`);--> statement-breakpoint
CREATE INDEX `messages_received_idx` ON `messages` (`received_at`);--> statement-breakpoint
CREATE TABLE `parser_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bank_key` text DEFAULT 'custom' NOT NULL,
	`pattern` text NOT NULL,
	`type_hint` text,
	`priority` integer DEFAULT 100 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text,
	`type` text DEFAULT 'PURCHASE' NOT NULL,
	`direction` text DEFAULT 'OUT' NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'EGP' NOT NULL,
	`fx_amount` real,
	`fx_currency` text,
	`merchant` text,
	`description` text,
	`category_id` text,
	`occurred_at` integer NOT NULL,
	`balance_after` real,
	`available_after` real,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`is_pending` integer DEFAULT false NOT NULL,
	`note` text,
	`message_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tx_card_date_idx` ON `transactions` (`card_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `tx_date_idx` ON `transactions` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `tx_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tx_message_idx` ON `transactions` (`message_id`);