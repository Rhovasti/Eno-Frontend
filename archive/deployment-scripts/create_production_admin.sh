#!/bin/bash

echo "Creating admin user on production server..."

# Create the admin user creation script
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# First check if we're using SQLite or MySQL
if [ -f /var/www/pelisivusto/data/database.sqlite ]; then
    echo 'Using SQLite database...'
    
    # Create SQLite admin script
    cat > create_admin_sqlite.js << 'ADMIN_SCRIPT'
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
        // Hash password
        const adminPassword = await bcrypt.hash('admin123', 10);
        
        // Check if admin exists
        db.get('SELECT id FROM users WHERE username = ?', ['admin'], async (err, row) => {
            if (err) {
                console.error('Error checking for admin:', err);
                return;
            }
            
            if (row) {
                console.log('Admin already exists, updating...');
                db.run(
                    'UPDATE users SET password = ?, roles = ?, is_admin = 1 WHERE username = ?',
                    [adminPassword, JSON.stringify(['admin', 'gm', 'player']), 'admin'],
                    (err) => {
                        if (err) console.error('Error updating admin:', err);
                        else console.log('Admin updated successfully');
                    }
                );
            } else {
                console.log('Creating new admin user...');
                db.run(
                    'INSERT INTO users (username, email, password, roles, is_admin) VALUES (?, ?, ?, ?, ?)',
                    ['admin', 'admin@example.com', adminPassword, JSON.stringify(['admin', 'gm', 'player']), 1],
                    function(err) {
                        if (err) console.error('Error creating admin:', err);
                        else console.log('Admin created with ID:', this.lastID);
                    }
                );
            }
            
            // Show all users after operation
            setTimeout(() => {
                db.all('SELECT id, username, email, roles, is_admin FROM users', (err, rows) => {
                    if (err) {
                        console.error('Error fetching users:', err);
                    } else {
                        console.log('\\nUsers in database:');
                        rows.forEach(user => {
                            console.log(\`- \${user.username} (\${user.email}) - Admin: \${user.is_admin ? 'Yes' : 'No'}\`);
                        });
                    }
                    db.close();
                });
            }, 1000);
        });
    } catch (error) {
        console.error('Error:', error);
        db.close();
    }
}

createAdmin();
ADMIN_SCRIPT

    # Run SQLite admin creation
    node create_admin_sqlite.js
    
else
    echo 'Using MySQL database...'
    
    # Create MySQL admin script
    cat > create_admin_mysql.js << 'ADMIN_SCRIPT'
const mysql = require('mysql');
const bcrypt = require('bcrypt');

async function createAdmin() {
    const db = mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'Foorumi'
    });

    db.connect(async (err) => {
        if (err) {
            console.error('Error connecting to database:', err);
            
            // Try without password
            const db2 = mysql.createConnection({
                host: '127.0.0.1',
                user: 'root',
                database: 'Foorumi'
            });
            
            db2.connect(async (err2) => {
                if (err2) {
                    console.error('Still cannot connect:', err2);
                    return;
                }
                console.log('Connected to MySQL without password');
                await createAdminUser(db2);
            });
            return;
        }
        
        console.log('Connected to MySQL database');
        await createAdminUser(db);
    });
}

async function createAdminUser(db) {
    try {
        // Hash password
        const adminPassword = await bcrypt.hash('admin123', 10);
        
        // Check if admin exists
        db.query('SELECT id FROM users WHERE username = ?', ['admin'], async (err, results) => {
            if (err) {
                console.error('Error checking for admin:', err);
                return;
            }
            
            if (results.length > 0) {
                console.log('Admin already exists, updating...');
                db.query(
                    'UPDATE users SET password = ?, roles = ?, is_admin = 1 WHERE username = ?',
                    [adminPassword, JSON.stringify(['admin', 'gm', 'player']), 'admin'],
                    (err) => {
                        if (err) console.error('Error updating admin:', err);
                        else console.log('Admin updated successfully');
                        showUsers(db);
                    }
                );
            } else {
                console.log('Creating new admin user...');
                db.query(
                    'INSERT INTO users (username, email, password, roles, is_admin) VALUES (?, ?, ?, ?, ?)',
                    ['admin', 'admin@example.com', adminPassword, JSON.stringify(['admin', 'gm', 'player']), 1],
                    (err, result) => {
                        if (err) console.error('Error creating admin:', err);
                        else console.log('Admin created with ID:', result.insertId);
                        showUsers(db);
                    }
                );
            }
        });
    } catch (error) {
        console.error('Error:', error);
        db.end();
    }
}

function showUsers(db) {
    db.query('SELECT id, username, email, roles, is_admin FROM users', (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
        } else {
            console.log('\\nUsers in database:');
            results.forEach(user => {
                console.log(\`- \${user.username} (\${user.email}) - Admin: \${user.is_admin ? 'Yes' : 'No'}\`);
            });
        }
        db.end();
    });
}

createAdmin();
ADMIN_SCRIPT

    # First try to fix MySQL connection
    systemctl status mysql || systemctl start mysql
    
    # Run MySQL admin creation
    node create_admin_mysql.js
fi

echo 'Admin creation process completed'
echo 'Login credentials:'
echo '  Username: admin'
echo '  Email: admin@example.com'
echo '  Password: admin123'
"