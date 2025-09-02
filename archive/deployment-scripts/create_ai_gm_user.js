const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./data/database.sqlite');

async function createAIGMUser() {
    try {
        // Hash a password for the AI GM user
        const hashedPassword = await bcrypt.hash('ai_gm_system_2024', 10);
        
        db.run(
            `INSERT INTO users (username, email, password, roles, is_admin) 
             VALUES (?, ?, ?, ?, ?)`,
            ['AI_GM_System', 'ai_gm@system.local', hashedPassword, '["gm"]', 0],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        console.log('AI GM user already exists');
                        
                        // Get the existing AI GM user ID
                        db.get(
                            `SELECT id FROM users WHERE username = 'AI_GM_System'`,
                            (err, row) => {
                                if (err) {
                                    console.error('Error finding AI GM user:', err);
                                } else {
                                    console.log('AI GM user ID:', row.id);
                                }
                                db.close();
                            }
                        );
                    } else {
                        console.error('Error creating AI GM user:', err);
                        db.close();
                    }
                } else {
                    console.log('AI GM user created with ID:', this.lastID);
                    db.close();
                }
            }
        );
    } catch (error) {
        console.error('Error:', error);
        db.close();
    }
}

createAIGMUser();