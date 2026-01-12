CREATE INDEX `matches_created_at_idx` ON `matches` (`created_at`);--> statement-breakpoint
CREATE INDEX `matches_player1_created_at_idx` ON `matches` (`player1_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `elo_idx` ON `users` (`elo`);