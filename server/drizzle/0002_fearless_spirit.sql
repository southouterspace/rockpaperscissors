CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`player1_id` text NOT NULL,
	`player2_id` text,
	`winner_id` text,
	`player1_score` integer NOT NULL,
	`player2_score` integer NOT NULL,
	`rounds` text NOT NULL,
	`is_solo` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player1_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player2_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
