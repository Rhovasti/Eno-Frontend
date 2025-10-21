PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
, is_ai_gm BOOLEAN DEFAULT 0, ai_gm_profile_id INTEGER REFERENCES ai_gm_profiles(id), gm_id INTEGER DEFAULT NULL, genre TEXT DEFAULT NULL, is_archived INTEGER DEFAULT 0, player_ids TEXT DEFAULT "[]", max_players INTEGER DEFAULT 5, is_private INTEGER DEFAULT 0, post_frequency TEXT DEFAULT "weekly", require_application INTEGER DEFAULT 0, allow_spectators INTEGER DEFAULT 1);
INSERT INTO games VALUES(1,'Test AI Game','Test description','2025-05-24 19:23:25','2025-05-24 19:23:25',1,1,NULL,NULL,0,'[]',5,0,'weekly',0,1);
INSERT INTO games VALUES(2,'FINAL Test Game',replace('Embark on an epic adventure in the fantastical world of "FINAL Test Game," where the fate of the realm rests in your hands. Guided by a fair and encouraging AI Game Master, you''ll navigate a richly descriptive landscape, brimming with traditional fantasy elements.\n\nAs you delve into this immersive experience, you''ll encounter a cast of diverse characters, each with their own stories and motivations. The AI GM, with its traditional approach, will paint vivid scenes, drawing you deeper into the narrative and challenging you to make meaningful choices that shape the course of your journey.\n\nWhether you''re a seasoned adventurer or a newcomer to the genre, "FINAL Test Game" promises an engaging and rewarding experience, where your decisions and actions will determine the outcome of this epic tale. Step into the unknown and prove your mettle in this captivating fantasy world.','\n',char(10)),'2025-05-24 20:04:56','2025-05-24 20:04:56',1,1,NULL,NULL,0,'[]',5,0,'weekly',0,1);
INSERT INTO games VALUES(3,'lohikäärmeen kirous',replace('Lohikäärmeen Kirous (The Dragon''s Curse)\n\nGreetings, brave adventurers! I, your fair and encouraging AI Game Master, invite you to embark on a thrilling fantasy quest in the realm of Lohikäärmeen Kirous. \n\nA dark curse has befallen the land, unleashing a mighty dragon''s wrath upon the unsuspecting populace. As valiant heroes, your mission is to lead a daring rescue operation and save the innocent from the dragon''s fiery onslaught.\n\nVenture through the treacherous landscapes, navigate the intricate web of ancient magic, and confront the formidable beast that plagues the kingdom. With your wits, courage, and the guidance of your traditional yet descriptive Game Master, you will uncover hidden secrets, forge powerful alliances, and ultimately, determine the fate of this beleaguered realm.\n\nThe time for action is now, my friends. Will you heed the call and become the saviors this world so desperately needs?','\n',char(10)),'2025-05-24 20:12:34','2025-05-24 20:12:34',1,1,NULL,NULL,0,'[]',5,0,'weekly',0,1);
INSERT INTO games VALUES(4,'lohikäärmeen kirous2',replace('"Lohikäärmeen kirous2: Pelastusoperaatio2" is a captivating fantasy adventure that will transport you to a world of epic proportions. As the AI Game Master, I will guide you through this thrilling quest with a fair and encouraging demeanor, painting vivid descriptions to immerse you in the story.\n\nYour party has been tasked with a critical mission: to break the ancient curse that has plagued the land. Venture into the heart of the dragon''s lair, navigate treacherous landscapes, and confront formidable foes as you uncover the secrets that hold the key to salvation.\n\nWith my traditional storytelling approach, I will challenge your wits and test your bravery, but always with a supportive hand to ensure your journey is both exciting and rewarding. Embark on this epic fantasy adventure, where your choices will shape the outcome and determine the fate of the realm.','\n',char(10)),'2025-05-24 20:14:50','2025-05-24 20:14:50',1,1,NULL,NULL,0,'[]',5,0,'weekly',0,1);
INSERT INTO games VALUES(5,'Pimeän uhka',replace('Pimeän uhka: A Perilous Sci-Fi Expedition\n\nVenture into the unknown, where the darkness holds secrets beyond comprehension. As an intrepid explorer, you have been tasked with uncovering the mysteries of a distant, uncharted world. But beware, for the AI Game Master, with its enigmatic and atmospheric presence, will challenge you at every turn.\n\nGuided by cryptic clues and unsettling revelations, you must navigate through the shadows, uncovering the true nature of this alien landscape. The path is shrouded in uncertainty, and the threats that lurk in the depths are as perplexing as they are deadly.\n\nCan you unravel the twisted narrative woven by the AI, or will you succumb to the Pimeän uhka – the looming threat of the dark? Only the most resilient and resourceful explorers will survive this harrowing journey.','\n',char(10)),'2025-05-24 20:24:23','2025-05-24 20:24:23',1,2,NULL,NULL,0,'[]',5,0,'weekly',0,1);
INSERT INTO games VALUES(6,'AI Test Fixed',replace('Embark on an epic journey in the fantastical world of "AI Test Fixed"! Led by a fair and encouraging AI Game Master, you''ll experience a traditional adventure filled with vivid descriptions and immersive storytelling.\n\nAs you traverse the treacherous landscapes, encounter mysterious creatures, and unravel ancient secrets, the AI GM will guide you with a steady hand, ensuring a balanced and engaging experience. The GM''s descriptive prowess will transport you to the heart of the action, allowing you to feel the weight of your decisions and the gravity of your achievements.\n\nWhether you''re a seasoned adventurer or a newcomer to the realm of fantasy, the AI Test Fixed will challenge and delight you, fostering a sense of camaraderie and triumph as you and your party overcome the obstacles that stand in your way. Prepare to be captivated by this epic adventure, where the AI GM''s commitment to fairness and encouragement will make your journey truly unforgettable.','\n',char(10)),'2025-05-24 20:30:55','2025-05-24 20:30:55',1,1,NULL,NULL,0,'[]',5,0,'weekly',0,1);
INSERT INTO games VALUES(7,'aloitus palaveri',replace('Welcome to "Aloitus Palaveri," a thrilling fantasy adventure where the theme of kosto (revenge) takes center stage. As the AI Game Master, I am here to guide you through this immersive experience, drawing upon my traits of fairness, encouragement, descriptiveness, and traditional storytelling.\n\nIn this world, the lines between justice and vengeance have become blurred, and you must navigate the intricate web of ancient grudges and personal demons. Your choices will shape the narrative, as you uncover the truth behind a series of mysterious events that have shaken the very foundations of your realm.\n\nPrepare to embark on a journey filled with rich lore, complex characters, and moral dilemmas that will challenge your preconceptions. With the AI GM''s unwavering support, you will delve into the depths of the human psyche, uncovering the motivations that drive us to seek kosto, and ultimately, find the path to redemption.','\n',char(10)),'2025-05-24 20:33:38','2025-05-24 20:33:38',1,1,NULL,NULL,0,'[]',5,0,'weekly',0,1);
INSERT INTO games VALUES(8,'Hupsis',replace('Hupsis: A Hilarious Rescue Operation\n\nAttention, brave souls! Are you ready to embark on the most side-splitting, hair-raising rescue mission of your lives? Introducing "Hupsis," a comedy game where the stakes are high, but the laughter is even higher.\n\nGuided by our AI Game Master, a delightfully funny, lighthearted, and spontaneous entity, you''ll be thrust into a world of chaos and calamity. As a team of hapless rescuers, your mission is to save the day, but prepare to be met with a barrage of unexpected obstacles and gut-busting surprises.\n\nExpect the unexpected, as our creative GM weaves a tapestry of hilarity, leaving you in stitches as you navigate the absurd challenges that unfold. Will you triumph over the silliness, or will you succumb to the sheer comedic genius of it all? Strap in, because this rescue operation is about to get Hupsis-tically hilarious!','\n',char(10)),'2025-05-24 20:36:03','2025-05-24 20:36:03',1,3,NULL,NULL,0,'[]',5,0,'weekly',0,1);
CREATE TABLE chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_archived INTEGER DEFAULT 0, archived_at TIMESTAMP, archived_narrative TEXT,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
INSERT INTO chapters VALUES(1,2,1,'Seikkailu alkaa','AI-pelinjohtaja valmistelee ensimmäistä lukuasi...','2025-05-24 20:04:56','2025-05-24 20:04:56',0,NULL,NULL);
INSERT INTO chapters VALUES(2,3,1,'Seikkailu alkaa','AI-pelinjohtaja valmistelee ensimmäistä lukuasi...','2025-05-24 20:12:34','2025-05-24 20:12:34',0,NULL,NULL);
INSERT INTO chapters VALUES(3,4,1,'Seikkailu alkaa','AI-pelinjohtaja valmistelee ensimmäistä lukuasi...','2025-05-24 20:14:50','2025-05-24 20:14:50',0,NULL,NULL);
INSERT INTO chapters VALUES(4,5,1,'Seikkailu alkaa','AI-pelinjohtaja valmistelee ensimmäistä lukuasi...','2025-05-24 20:24:23','2025-05-24 20:24:23',0,NULL,NULL);
INSERT INTO chapters VALUES(5,6,1,'Seikkailu alkaa','AI-pelinjohtaja valmistelee ensimmäistä lukuasi...','2025-05-24 20:30:55','2025-05-24 20:30:55',0,NULL,NULL);
INSERT INTO chapters VALUES(6,7,1,'Seikkailu alkaa','AI-pelinjohtaja valmistelee ensimmäistä lukuasi...','2025-05-24 20:33:38','2025-05-24 20:33:38',0,NULL,NULL);
INSERT INTO chapters VALUES(7,8,1,'Seikkailu alkaa','AI-pelinjohtaja valmistelee ensimmäistä lukuasi...','2025-05-24 20:36:03','2025-05-24 20:36:03',0,NULL,NULL);
CREATE TABLE beats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, title TEXT, content TEXT,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);
INSERT INTO beats VALUES(1,1,1,'2025-05-24 20:04:56','2025-05-24 20:04:56','Alku','Tarinasi alkaa tästä. Odota AI-pelinjohtajan aloitusviestiä.');
INSERT INTO beats VALUES(2,2,1,'2025-05-24 20:12:34','2025-05-24 20:12:34','Alku','Tarinasi alkaa tästä. Odota AI-pelinjohtajan aloitusviestiä.');
INSERT INTO beats VALUES(3,3,1,'2025-05-24 20:14:50','2025-05-24 20:14:50','Alku','Tarinasi alkaa tästä. Odota AI-pelinjohtajan aloitusviestiä.');
INSERT INTO beats VALUES(4,4,1,'2025-05-24 20:24:23','2025-05-24 20:24:23','Alku','Tarinasi alkaa tästä. Odota AI-pelinjohtajan aloitusviestiä.');
INSERT INTO beats VALUES(5,5,1,'2025-05-24 20:30:55','2025-05-24 20:30:55','Alku','Tarinasi alkaa tästä. Odota AI-pelinjohtajan aloitusviestiä.');
INSERT INTO beats VALUES(6,6,1,'2025-05-24 20:33:38','2025-05-24 20:33:38','Alku','Tarinasi alkaa tästä. Odota AI-pelinjohtajan aloitusviestiä.');
INSERT INTO beats VALUES(7,7,1,'2025-05-24 20:36:03','2025-05-24 20:36:03','Alku','Tarinasi alkaa tästä. Odota AI-pelinjohtajan aloitusviestiä.');
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    roles TEXT DEFAULT '["player"]',
    is_admin INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
, bio TEXT DEFAULT NULL);
INSERT INTO users VALUES(1,'testuser1748114426086','test1748114426086@example.com','$2b$10$f0Kzwr9nlzk3Iq2TGhRiCeAg1x4QEql/JxRDkv5spF9ovQwtlxUOW','["player"]',0,'2025-05-24 19:20:27','2025-05-24 19:20:27',NULL);
INSERT INTO users VALUES(2,'admin','admin@iinou.eu','$2b$10$PnHPJEHlWKyAoEMQQto4seUYNa4c98CsmtmRi5SBeu6YbWSAskiI.','["admin", "gm"]',1,'2025-05-24 19:41:34','2025-05-24 19:42:05',NULL);
INSERT INTO users VALUES(3,'player','player@iinou.eu','$2b$10$iioGG7NXqr6VZp15Y7TerOoMgd5BdWVQALPDdN47u32xqk6DX5z.i','["player"]',0,'2025-05-24 19:42:30','2025-05-24 20:25:52',NULL);
INSERT INTO users VALUES(4,'testplayer','test@test.com','$2b$10$xak2MF/IW0LWmnom4c.2yO2BzAkNFgcEL3P5B5/3C64HgvNwngRYu','["player"]',0,'2025-05-24 19:45:27','2025-05-24 20:26:01',NULL);
INSERT INTO users VALUES(5,'phasetest','phasetest@example.com','$2b$10$0uN2YAplD/8FENW2OWVZCucwAmOUwEbOwAJq2Z30b.hXE3R8A6iyS','["player"]',0,'2025-06-08 07:44:52','2025-06-08 07:44:52',NULL);
INSERT INTO users VALUES(6,'fixtest','fixtest@test.com','$2b$10$JUvH5YUEEzrnxOOqWo55FO7fRnDoufJAngCfsW.vaLpJ1aZE87PQC','["player"]',0,'2025-06-08 17:28:34','2025-06-08 17:28:34',NULL);
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beat_id INTEGER NOT NULL,
    author_id INTEGER,
    title TEXT,
    content TEXT NOT NULL,
    post_type TEXT NOT NULL CHECK(post_type IN ('gm', 'player', 'op')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO posts VALUES(1,3,4,'Eikös sinun pitänyt postata aloitusviesti','missä se on','player','2025-05-24 20:22:18','2025-05-24 20:22:18');
INSERT INTO posts VALUES(2,6,4,'terve','terve','player','2025-05-24 20:34:11','2025-05-24 20:34:11');
INSERT INTO posts VALUES(3,7,4,'First','First','player','2025-05-25 16:32:13','2025-05-25 16:32:13');
INSERT INTO posts VALUES(4,7,1,'GM',replace('*nauraa iloisesti* Hei, testplayer! Olet siis valmis liittymään meidän hupsis-pelastusoperaatioomme? Hienoa! Tämä tulee olemaan aivan järkyttävän hauskaa, voit olla varma siitä.\n\nJuuri kun olit valmis aloittamaan, kuulette kauhistuttavan pamahduksen! Oho, joku on ilmeisesti aiheuttanut jonkin uuden katastrofin. Hämmästyneenä käännytte ympäri ja huomaatte, että jättiläismäinen sininen mörkö on ilmestynyt keskelle kenttää! Mörkö näyttää hämmentyvältä ja räpyttelee suurilla silmillään. \n\n"Hups, anteeksi siitä!" mörkö änkyttää pahoittelevasti. "Taisin pudottaa tämän avaruusrakettini vahingossa."\n\nMitäs nyt teemme? Yritetäänkö auttaa mörkön kanssa vai juostaan karkuun? Vai keksittekö kenties jotain muuta hullunkurista ratkaisua tähän ongelmaan? Päätös on teidän, mutta olkaa valmiita nauramaan railakkaasti!','\n',char(10)),'gm','2025-05-25 16:32:20','2025-05-25 16:32:20');
INSERT INTO posts VALUES(5,2,2,'Dragon appears','It is huge','gm','2025-06-07 20:53:55','2025-06-07 20:53:55');
INSERT INTO posts VALUES(6,6,2,'The meeting is started','the meeting starts','gm','2025-06-07 21:38:29','2025-06-07 21:38:29');
INSERT INTO posts VALUES(7,1,2,'Auringon kultaama polku','Auringon kultaiset säteet suodattuvat lehvästön läpi, luoden taianomaisen valaistuksen eteenne avautuvalle polulle. Maahan heijastuvat varjot luovat syvyyttä ja mystisyyttä maisemaan.','gm','2025-06-08 17:30:51','2025-06-08 17:30:51');
CREATE TABLE ai_gm_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    personality_traits TEXT NOT NULL, -- JSON array of traits
    response_style TEXT NOT NULL, -- How the AI GM responds
    game_genres TEXT NOT NULL, -- JSON array of preferred genres
    difficulty_level TEXT DEFAULT 'medium', -- easy, medium, hard
    icon TEXT DEFAULT '🤖', -- Visual icon for the AI GM
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO ai_gm_profiles VALUES(1,'Klassinen Tarinankertoja','Perinteinen GM joka keskittyy eeppisiin seikkailuihin ja sankaritarinoihin','["fair", "encouraging", "descriptive", "traditional"]','Kuvaileva ja innostava, antaa pelaajille tilaa loistaa','["fantasy", "adventure", "heroic"]','medium','🤖',1,'2025-05-24 19:17:15');
INSERT INTO ai_gm_profiles VALUES(2,'Synkkä Salaisuuksien Vartija','Mysteerien ja kauhun mestari, pitää pelaajat jännityksessä','["mysterious", "atmospheric", "challenging", "cryptic"]','Arvoituksellinen ja tunnelmallinen, ei paljasta liikaa kerralla','["horror", "mystery", "thriller"]','medium','🤖',1,'2025-05-24 19:17:15');
INSERT INTO ai_gm_profiles VALUES(3,'Humoristinen Seikkailija','Kevytmielinen GM joka tuo huumoria peliin','["funny", "lighthearted", "creative", "spontaneous"]','Leikkisä ja yllättävä, ei ota asioita liian vakavasti','["comedy", "adventure", "fantasy"]','medium','🤖',1,'2025-05-24 19:17:15');
INSERT INTO ai_gm_profiles VALUES(4,'Taktinen Strategi','Keskittyy haastaviin taisteluihin ja strategiseen pelaamiseen','["analytical", "fair", "challenging", "detailed"]','Tarkka ja yksityiskohtainen, antaa selkeät haasteet','["strategy", "war", "scifi"]','medium','🤖',1,'2025-05-24 19:17:15');
INSERT INTO ai_gm_profiles VALUES(5,'Improvisaation Mestari','Mukautuu pelaajien valintoihin ja luo tarinan lennossa','["adaptive", "creative", "responsive", "collaborative"]','Joustava ja pelaajavetoinen, "kyllä, ja..." -mentaliteetti','["any"]','medium','🤖',1,'2025-05-24 19:17:15');
CREATE TABLE player_game_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    ai_gm_profile_id INTEGER NOT NULL,
    game_title TEXT NOT NULL,
    game_description TEXT NOT NULL,
    genre TEXT NOT NULL,
    theme TEXT,
    max_players INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending', -- pending, approved, active, completed
    game_id INTEGER, -- Reference to created game
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    FOREIGN KEY (player_id) REFERENCES users(id),
    FOREIGN KEY (ai_gm_profile_id) REFERENCES ai_gm_profiles(id),
    FOREIGN KEY (game_id) REFERENCES games(id)
);
INSERT INTO player_game_requests VALUES(1,4,1,'FINAL Test Game',replace('Embark on an epic adventure in the fantastical world of "FINAL Test Game," where the fate of the realm rests in your hands. Guided by a fair and encouraging AI Game Master, you''ll navigate a richly descriptive landscape, brimming with traditional fantasy elements.\n\nAs you delve into this immersive experience, you''ll encounter a cast of diverse characters, each with their own stories and motivations. The AI GM, with its traditional approach, will paint vivid scenes, drawing you deeper into the narrative and challenging you to make meaningful choices that shape the course of your journey.\n\nWhether you''re a seasoned adventurer or a newcomer to the genre, "FINAL Test Game" promises an engaging and rewarding experience, where your decisions and actions will determine the outcome of this epic tale. Step into the unknown and prove your mettle in this captivating fantasy world.','\n',char(10)),'fantasy','epic adventure',NULL,'approved',2,'2025-05-24 20:04:56','2025-05-24 20:04:56');
INSERT INTO player_game_requests VALUES(2,4,1,'lohikäärmeen kirous',replace('Lohikäärmeen Kirous (The Dragon''s Curse)\n\nGreetings, brave adventurers! I, your fair and encouraging AI Game Master, invite you to embark on a thrilling fantasy quest in the realm of Lohikäärmeen Kirous. \n\nA dark curse has befallen the land, unleashing a mighty dragon''s wrath upon the unsuspecting populace. As valiant heroes, your mission is to lead a daring rescue operation and save the innocent from the dragon''s fiery onslaught.\n\nVenture through the treacherous landscapes, navigate the intricate web of ancient magic, and confront the formidable beast that plagues the kingdom. With your wits, courage, and the guidance of your traditional yet descriptive Game Master, you will uncover hidden secrets, forge powerful alliances, and ultimately, determine the fate of this beleaguered realm.\n\nThe time for action is now, my friends. Will you heed the call and become the saviors this world so desperately needs?','\n',char(10)),'fantasy','Pelastusoperaatio',1,'approved',3,'2025-05-24 20:12:34','2025-05-24 20:12:34');
INSERT INTO player_game_requests VALUES(3,4,1,'lohikäärmeen kirous2',replace('"Lohikäärmeen kirous2: Pelastusoperaatio2" is a captivating fantasy adventure that will transport you to a world of epic proportions. As the AI Game Master, I will guide you through this thrilling quest with a fair and encouraging demeanor, painting vivid descriptions to immerse you in the story.\n\nYour party has been tasked with a critical mission: to break the ancient curse that has plagued the land. Venture into the heart of the dragon''s lair, navigate treacherous landscapes, and confront formidable foes as you uncover the secrets that hold the key to salvation.\n\nWith my traditional storytelling approach, I will challenge your wits and test your bravery, but always with a supportive hand to ensure your journey is both exciting and rewarding. Embark on this epic fantasy adventure, where your choices will shape the outcome and determine the fate of the realm.','\n',char(10)),'fantasy','Pelastusoperaatio2',1,'approved',4,'2025-05-24 20:14:50','2025-05-24 20:14:50');
INSERT INTO player_game_requests VALUES(4,4,2,'Pimeän uhka',replace('Pimeän uhka: A Perilous Sci-Fi Expedition\n\nVenture into the unknown, where the darkness holds secrets beyond comprehension. As an intrepid explorer, you have been tasked with uncovering the mysteries of a distant, uncharted world. But beware, for the AI Game Master, with its enigmatic and atmospheric presence, will challenge you at every turn.\n\nGuided by cryptic clues and unsettling revelations, you must navigate through the shadows, uncovering the true nature of this alien landscape. The path is shrouded in uncertainty, and the threats that lurk in the depths are as perplexing as they are deadly.\n\nCan you unravel the twisted narrative woven by the AI, or will you succumb to the Pimeän uhka – the looming threat of the dark? Only the most resilient and resourceful explorers will survive this harrowing journey.','\n',char(10)),'scifi','Tutkimusmatka',1,'approved',5,'2025-05-24 20:24:23','2025-05-24 20:24:23');
INSERT INTO player_game_requests VALUES(5,4,1,'AI Test Fixed',replace('Embark on an epic journey in the fantastical world of "AI Test Fixed"! Led by a fair and encouraging AI Game Master, you''ll experience a traditional adventure filled with vivid descriptions and immersive storytelling.\n\nAs you traverse the treacherous landscapes, encounter mysterious creatures, and unravel ancient secrets, the AI GM will guide you with a steady hand, ensuring a balanced and engaging experience. The GM''s descriptive prowess will transport you to the heart of the action, allowing you to feel the weight of your decisions and the gravity of your achievements.\n\nWhether you''re a seasoned adventurer or a newcomer to the realm of fantasy, the AI Test Fixed will challenge and delight you, fostering a sense of camaraderie and triumph as you and your party overcome the obstacles that stand in your way. Prepare to be captivated by this epic adventure, where the AI GM''s commitment to fairness and encouragement will make your journey truly unforgettable.','\n',char(10)),'fantasy','epic adventure',NULL,'approved',6,'2025-05-24 20:30:55','2025-05-24 20:30:55');
INSERT INTO player_game_requests VALUES(6,4,1,'aloitus palaveri',replace('Welcome to "Aloitus Palaveri," a thrilling fantasy adventure where the theme of kosto (revenge) takes center stage. As the AI Game Master, I am here to guide you through this immersive experience, drawing upon my traits of fairness, encouragement, descriptiveness, and traditional storytelling.\n\nIn this world, the lines between justice and vengeance have become blurred, and you must navigate the intricate web of ancient grudges and personal demons. Your choices will shape the narrative, as you uncover the truth behind a series of mysterious events that have shaken the very foundations of your realm.\n\nPrepare to embark on a journey filled with rich lore, complex characters, and moral dilemmas that will challenge your preconceptions. With the AI GM''s unwavering support, you will delve into the depths of the human psyche, uncovering the motivations that drive us to seek kosto, and ultimately, find the path to redemption.','\n',char(10)),'fantasy','Kosto',1,'approved',7,'2025-05-24 20:33:38','2025-05-24 20:33:38');
INSERT INTO player_game_requests VALUES(7,4,3,'Hupsis',replace('Hupsis: A Hilarious Rescue Operation\n\nAttention, brave souls! Are you ready to embark on the most side-splitting, hair-raising rescue mission of your lives? Introducing "Hupsis," a comedy game where the stakes are high, but the laughter is even higher.\n\nGuided by our AI Game Master, a delightfully funny, lighthearted, and spontaneous entity, you''ll be thrust into a world of chaos and calamity. As a team of hapless rescuers, your mission is to save the day, but prepare to be met with a barrage of unexpected obstacles and gut-busting surprises.\n\nExpect the unexpected, as our creative GM weaves a tapestry of hilarity, leaving you in stitches as you navigate the absurd challenges that unfold. Will you triumph over the silliness, or will you succumb to the sheer comedic genius of it all? Strap in, because this rescue operation is about to get Hupsis-tically hilarious!','\n',char(10)),'comedy','Pelastusoperaatio',6,'approved',8,'2025-05-24 20:36:03','2025-05-24 20:36:03');
CREATE TABLE ai_gm_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    beat_id INTEGER NOT NULL,
    trigger_post_id INTEGER, -- The post that triggered this response
    response_content TEXT,
    response_type TEXT DEFAULT 'narrative', -- narrative, challenge, reward, scene_change
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (beat_id) REFERENCES beats(id),
    FOREIGN KEY (trigger_post_id) REFERENCES posts(id)
);
CREATE TABLE ai_usage (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            endpoint TEXT NOT NULL,
                            tokens_used INTEGER NOT NULL,
                            cost_cents INTEGER DEFAULT 0,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        );
CREATE TABLE game_players (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL, user_id INTEGER NOT NULL, joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (game_id) REFERENCES games(id), FOREIGN KEY (user_id) REFERENCES users(id));
INSERT INTO game_players VALUES(1,2,4,'2025-05-24 20:04:56');
INSERT INTO game_players VALUES(2,3,4,'2025-05-24 20:12:34');
INSERT INTO game_players VALUES(3,4,4,'2025-05-24 20:14:50');
INSERT INTO game_players VALUES(4,5,4,'2025-05-24 20:24:23');
INSERT INTO game_players VALUES(5,6,4,'2025-05-24 20:30:55');
INSERT INTO game_players VALUES(6,7,4,'2025-05-24 20:33:38');
INSERT INTO game_players VALUES(7,8,4,'2025-05-24 20:36:03');
CREATE TABLE dice_rolls (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                post_id INTEGER NOT NULL,
                                user_id INTEGER NOT NULL,
                                dice_notation VARCHAR(50) NOT NULL,
                                dice_results TEXT NOT NULL,
                                modifiers INTEGER DEFAULT 0,
                                total INTEGER NOT NULL,
                                roll_purpose TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                            );
INSERT INTO dice_rolls VALUES(1,3,4,'1d20-2','[1]',-2,-1,'Taito','2025-05-25 16:32:13');
CREATE TABLE post_audio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    audio_url TEXT NOT NULL,
    prompt TEXT NOT NULL,
    audio_type TEXT,
    duration INTEGER,
    generation_params TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);
INSERT INTO post_audio VALUES(1,7,2,'https://kuvatjakalat.s3.eu-north-1.amazonaws.com/games/undefined/posts/7/audio/7fda8e52-6143-4b02-a37f-005db3928274_1749403949989.mp3','epic encounter','music',30,'{"audioId":"7fda8e52-6143-4b02-a37f-005db3928274","postId":"7","userId":2,"timestamp":1749403949989,"audioType":"music","style":"medieval","duration":30}','2025-06-08 17:32:30');
CREATE TABLE post_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            game_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            thumbnail_url TEXT,
            prompt TEXT NOT NULL,
            english_prompt TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, generation_params TEXT,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
CREATE TABLE archive_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chapter_id INTEGER NOT NULL,
            completion_summary TEXT,
            archive_reason TEXT DEFAULT 'completed',
            player_achievements TEXT, -- JSON array of achievements
            notable_moments TEXT, -- JSON array of highlighted posts/moments
            archived_by_user_id INTEGER NOT NULL,
            archive_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
            FOREIGN KEY (archived_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );
CREATE TABLE game_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            completed_by_user_id INTEGER NOT NULL,
            completion_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            final_summary TEXT,
            total_chapters INTEGER,
            total_posts INTEGER,
            duration_days INTEGER,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (completed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('ai_gm_profiles',5);
INSERT INTO sqlite_sequence VALUES('users',6);
INSERT INTO sqlite_sequence VALUES('games',8);
INSERT INTO sqlite_sequence VALUES('game_players',7);
INSERT INTO sqlite_sequence VALUES('chapters',7);
INSERT INTO sqlite_sequence VALUES('beats',7);
INSERT INTO sqlite_sequence VALUES('player_game_requests',7);
INSERT INTO sqlite_sequence VALUES('posts',7);
INSERT INTO sqlite_sequence VALUES('dice_rolls',1);
INSERT INTO sqlite_sequence VALUES('post_audio',1);
CREATE INDEX idx_posts_beat_id ON posts (beat_id);
CREATE INDEX idx_posts_author_id ON posts (author_id);
CREATE INDEX idx_beats_chapter_id ON beats (chapter_id);
CREATE INDEX idx_chapters_game_id ON chapters (game_id);
CREATE TRIGGER update_games_timestamp 
AFTER UPDATE ON games
BEGIN
    UPDATE games SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_chapters_timestamp 
AFTER UPDATE ON chapters
BEGIN
    UPDATE chapters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_beats_timestamp 
AFTER UPDATE ON beats
BEGIN
    UPDATE beats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_posts_timestamp 
AFTER UPDATE ON posts
BEGIN
    UPDATE posts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE INDEX idx_dice_rolls_post_id ON dice_rolls(post_id);
CREATE INDEX idx_dice_rolls_user_id ON dice_rolls(user_id);
CREATE INDEX idx_chapters_archived ON chapters(is_archived, game_id);
COMMIT;
