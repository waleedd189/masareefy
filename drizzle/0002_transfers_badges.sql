ALTER TABLE `transactions` ADD `transfer_id` text;--> statement-breakpoint
CREATE INDEX `tx_transfer_idx` ON `transactions` (`transfer_id`);