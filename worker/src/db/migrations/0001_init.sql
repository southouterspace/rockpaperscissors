-- Migration: 0001_init
-- Creates all tables for the Rock Paper Scissors application

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`elo` integer DEFAULT 1000 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

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

CREATE UNIQUE INDEX `passkeys_credential_id_unique` ON `passkeys` (`credential_id`);
CREATE INDEX `elo_idx` ON `users` (`elo`);
CREATE INDEX `matches_created_at_idx` ON `matches` (`created_at`);
CREATE INDEX `matches_player1_created_at_idx` ON `matches` (`player1_id`, `created_at`);
