-- Database schema for the Foorumi application

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    roles TEXT,
    is_admin BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    sequence_number INT NOT NULL,
    title VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Beats table
CREATE TABLE IF NOT EXISTS beats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chapter_id INT NOT NULL,
    sequence_number INT NOT NULL,
    title VARCHAR(100),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    beat_id INT NOT NULL,
    author_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    post_type ENUM('player', 'gm') DEFAULT 'player',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add test data - Admin user
INSERT INTO users (username, email, password, roles, is_admin) 
VALUES ('admin', 'admin@example.com', '$2b$10$DaM5Xx1mMs0g.t3C0M/V/.Uc5ZTi7KIKkV92/JXGoMZa3Ff.9EpYG', '["player","gm"]', 1);

-- Add test data - GM user
INSERT INTO users (username, email, password, roles, is_admin) 
VALUES ('gm', 'gm@example.com', '$2b$10$DaM5Xx1mMs0g.t3C0M/V/.Uc5ZTi7KIKkV92/JXGoMZa3Ff.9EpYG', '["player","gm"]', 0);

-- Add test data - Player user
INSERT INTO users (username, email, password, roles, is_admin) 
VALUES ('player', 'player@example.com', '$2b$10$DaM5Xx1mMs0g.t3C0M/V/.Uc5ZTi7KIKkV92/JXGoMZa3Ff.9EpYG', '["player"]', 0);

-- Add test game
INSERT INTO games (id, name, description) 
VALUES (1, 'Test Game', 'This is a test game for development purposes');

-- Add test chapter
INSERT INTO chapters (id, game_id, sequence_number, title, description)
VALUES (1, 1, 1, 'Chapter 1', 'The first chapter of the test game');

-- Add test beat
INSERT INTO beats (id, chapter_id, sequence_number, title, content)
VALUES (1, 1, 1, 'Beat 1', 'The first beat of the first chapter');

-- Add test post
INSERT INTO posts (beat_id, author_id, title, content, post_type)
VALUES (1, 1, 'Welcome', 'Welcome to the game\!', 'gm');
