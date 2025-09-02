const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

async function createAdmin() {
    const dbPath = path.join(__dirname, 'data', 'database.sqlite');
    console.log('Connecting to database:', dbPath);
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err);
            return;
        }
        console.log('Connected to SQLite database');
    });

    try {
        // Hash passwords
        const adminPassword = await bcrypt.hash('admin123', 10);
        const testPassword = await bcrypt.hash('test123', 10);
        
        console.log('Passwords hashed');
        
        // Check if users already exist
        db.get('SELECT id FROM users WHERE username = ?', ['admin'], async (err, row) => {
            if (err) {
                console.error('Error checking for existing admin:', err);
                return;
            }
            
            if (row) {
                console.log('Admin user already exists, updating password...');
                // Update existing admin user
                db.run(
                    'UPDATE users SET password = ?, roles = ?, is_admin = 1 WHERE username = ?',
                    [adminPassword, JSON.stringify(['admin', 'gm', 'player']), 'admin'],
                    (err) => {
                        if (err) {
                            console.error('Error updating admin user:', err);
                        } else {
                            console.log('Admin user updated successfully');
                        }
                    }
                );
            } else {
                // Create new admin user
                db.run(
                    `INSERT INTO users (username, email, password, roles, is_admin) 
                     VALUES (?, ?, ?, ?, ?)`,
                    ['admin', 'admin@example.com', adminPassword, JSON.stringify(['admin', 'gm', 'player']), 1],
                    function(err) {
                        if (err) {
                            console.error('Error creating admin user:', err);
                        } else {
                            console.log('Admin user created with ID:', this.lastID);
                        }
                    }
                );
            }
        });
        
        // Check if test user exists
        db.get('SELECT id FROM users WHERE username = ?', ['testuser'], async (err, row) => {
            if (err) {
                console.error('Error checking for existing test user:', err);
                return;
            }
            
            if (row) {
                console.log('Test user already exists, updating password...');
                // Update existing test user
                db.run(
                    'UPDATE users SET password = ?, roles = ?, is_admin = 0 WHERE username = ?',
                    [testPassword, JSON.stringify(['player']), 'testuser'],
                    (err) => {
                        if (err) {
                            console.error('Error updating test user:', err);
                        } else {
                            console.log('Test user updated successfully');
                        }
                    }
                );
            } else {
                // Create new test user
                db.run(
                    `INSERT INTO users (username, email, password, roles, is_admin) 
                     VALUES (?, ?, ?, ?, ?)`,
                    ['testuser', 'test@example.com', testPassword, JSON.stringify(['player']), 0],
                    function(err) {
                        if (err) {
                            console.error('Error creating test user:', err);
                        } else {
                            console.log('Test user created with ID:', this.lastID);
                        }
                    }
                );
            }
        });
        
        // Wait a bit then show all users
        setTimeout(() => {
            db.all('SELECT id, username, email, roles, is_admin FROM users', (err, rows) => {
                if (err) {
                    console.error('Error fetching users:', err);
                } else {
                    console.log('\nUsers in database:');
                    rows.forEach(user => {
                        console.log(`- ${user.username} (${user.email}) - Admin: ${user.is_admin ? 'Yes' : 'No'}, Roles: ${user.roles}`);
                    });
                }
                db.close();
            });
        }, 1000);
        
    } catch (error) {
        console.error('Error:', error);
        db.close();
    }
}

createAdmin();