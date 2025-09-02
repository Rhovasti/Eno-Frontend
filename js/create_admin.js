const mysql = require('mysql');
const bcrypt = require('bcrypt');

async function createAdmin() {
    // Create a database connection
    const db = mysql.createConnection({
        host: '127.0.0.1',
        user: 'eno',
        password: 'password',
        database: 'Foorumi'
    });

    // Connect to the database
    db.connect(async (err) => {
        if (err) {
            console.error('Error connecting to database:', err);
            return;
        }
        
        console.log('Connected to database');
        
        try {
            // Hash the password
            const password = 'admin123';
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            
            console.log('Password hashed:', hashedPassword);
            
            // Handle foreign key constraints and reset the tables in the correct order
            db.query('SET FOREIGN_KEY_CHECKS=0;', (err) => {
                if (err) {
                    console.error('Error disabling foreign key checks:', err);
                    return;
                }
                
                console.log('Foreign key checks disabled');
                
                // Now we can truncate the users table
                db.query('TRUNCATE TABLE users', (err) => {
                    if (err) {
                        console.error('Error truncating users table:', err);
                        return;
                    }
                    
                    console.log('Users table truncated');
                    
                    // Re-enable foreign key checks
                    db.query('SET FOREIGN_KEY_CHECKS=1;', (err) => {
                        if (err) {
                            console.error('Error re-enabling foreign key checks:', err);
                            return;
                        }
                        
                        console.log('Foreign key checks re-enabled');
                        
                        // Create admin user
                        const adminUser = {
                            username: 'admin',
                            email: 'admin@example.com',
                            password: hashedPassword,
                            roles: JSON.stringify(["admin", "gm", "player"]),
                            is_admin: true
                        };
                        
                        // Insert admin user
                        db.query('INSERT INTO users SET ?', adminUser, (err, result) => {
                            if (err) {
                                console.error('Error creating admin user:', err);
                                return;
                            }
                            
                            console.log('Admin user created with ID:', result.insertId);
                            
                            // Create test user
                            bcrypt.hash('test123', saltRounds).then(testHash => {
                                const testUser = {
                                    username: 'testuser',
                                    email: 'test@example.com',
                                    password: testHash,
                                    roles: JSON.stringify(["player"]),
                                    is_admin: false
                                };
                                
                                // Insert test user
                                db.query('INSERT INTO users SET ?', testUser, (err, result) => {
                                    if (err) {
                                        console.error('Error creating test user:', err);
                                        return;
                                    }
                                    
                                    console.log('Test user created with ID:', result.insertId);
                                    
                                    // Verify users
                                    db.query('SELECT id, username, email, roles, is_admin FROM users', (err, results) => {
                                        if (err) {
                                            console.error('Error fetching users:', err);
                                            return;
                                        }
                                        
                                        console.log('Users in database:');
                                        console.log(results);
                                        
                                        // Close the connection
                                        db.end();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        } catch (error) {
            console.error('Error:', error);
            db.end();
        }
    });
}

createAdmin();