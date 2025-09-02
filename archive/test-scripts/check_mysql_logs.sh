#\!/bin/bash

# Connect to the remote server and check MySQL logs and database connection settings
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
echo '=== MySQL Error Log ==='
tail -n 50 /var/log/mysql/error.log
echo

echo '=== Database Connection Info ==='
grep -A 10 'MySQL connection' /var/www/pelisivusto/js/server.js
echo

echo '=== Check Database Existence ==='
mysql -e 'SHOW DATABASES;' 2>&1 || echo 'Failed to list databases'
echo

echo '=== Testing DB Connection from Node.js ==='
cd /var/www/pelisivusto
cat > test_db.js << 'TEST_DB'
const mysql = require('mysql');

// Create connection
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'Foorumi'
});

// Connect
db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        process.exit(1);
    }
    console.log('Connected to the database');
    
    // Test query
    db.query('SELECT 1 + 1 AS solution', (err, results) => {
        if (err) {
            console.error('Query error:', err);
            process.exit(1);
        }
        console.log('Test query result:', results[0].solution);
        
        // Try to query users table
        db.query('SELECT COUNT(*) AS user_count FROM users', (err, results) => {
            if (err) {
                console.error('Users table query error:', err);
            } else {
                console.log('Users in database:', results[0].user_count);
            }
            process.exit(0);
        });
    });
});
TEST_DB

node test_db.js
"

echo "MySQL diagnostics completed"
