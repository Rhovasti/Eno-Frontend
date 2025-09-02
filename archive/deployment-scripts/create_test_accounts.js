const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./data/database.sqlite');

async function createTestAccounts() {
    try {
        // Create admin account
        const adminPassword = await bcrypt.hash('admin123', 10);
        
        db.run(
            `INSERT INTO users (username, email, password, roles, is_admin) 
             VALUES (?, ?, ?, ?, ?)`,
            ['admin_test', 'admin@example.com', adminPassword, '["admin", "gm"]', 1],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        console.log('Admin account already exists, updating password...');
                        
                        // Update existing admin password
                        db.run(
                            `UPDATE users SET password = ? WHERE email = 'admin@example.com'`,
                            [adminPassword],
                            (err) => {
                                if (err) {
                                    console.error('Error updating admin password:', err);
                                } else {
                                    console.log('Admin password updated successfully');
                                }
                            }
                        );
                    } else {
                        console.error('Error creating admin account:', err);
                    }
                } else {
                    console.log('Admin account created with ID:', this.lastID);
                    console.log('Email: admin@example.com');
                    console.log('Password: admin123');
                }
            }
        );
        
        // Create human GM account
        const gmPassword = await bcrypt.hash('gm123', 10);
        
        db.run(
            `INSERT INTO users (username, email, password, roles, is_admin) 
             VALUES (?, ?, ?, ?, ?)`,
            ['human_gm', 'gm@example.com', gmPassword, '["gm"]', 0],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        console.log('Human GM account already exists');
                    } else {
                        console.error('Error creating GM account:', err);
                    }
                } else {
                    console.log('\nHuman GM account created with ID:', this.lastID);
                    console.log('Email: gm@example.com');
                    console.log('Password: gm123');
                }
                
                // Close database after both operations
                setTimeout(() => {
                    db.close();
                    console.log('\nAccounts ready for testing!');
                }, 1000);
            }
        );
        
    } catch (error) {
        console.error('Error:', error);
        db.close();
    }
}

createTestAccounts();