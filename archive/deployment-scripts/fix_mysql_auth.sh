#\!/bin/bash

# Connect to the remote server and fix MySQL authentication for the Node.js application
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
echo 'Checking for Foorumi database...'
# Check if Foorumi database exists
if \! mysql -e 'SHOW DATABASES' | grep -q Foorumi; then
    echo 'Creating Foorumi database...'
    mysql -e 'CREATE DATABASE Foorumi;'
    
    echo 'Importing database schema...'
    mysql Foorumi < /var/www/pelisivusto/sql/mysql_schema.txt || echo 'Failed to import schema'
fi

echo 'Fixing MySQL authentication for Node.js...'
# Fix MySQL authentication for the root user to be compatible with Node.js client
mysql -e \"ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY ''\" || echo 'Failed to alter user authentication'
mysql -e \"FLUSH PRIVILEGES;\"

echo 'Creating test user for the application...'
mysql -e \"CREATE USER IF NOT EXISTS 'eno_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password123'\" || echo 'Failed to create user'
mysql -e \"GRANT ALL PRIVILEGES ON Foorumi.* TO 'eno_user'@'localhost'\" || echo 'Failed to grant privileges'
mysql -e \"FLUSH PRIVILEGES;\"

echo 'Testing connection with new credentials...'
cat > test_new_db.js << 'TEST_DB'
const mysql = require('mysql');

// Create connection with new credentials
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'eno_user',
    password: 'password123',
    database: 'Foorumi'
});

// Connect
db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        process.exit(1);
    }
    console.log('Connected to the database successfully\!');
    
    // Test query
    db.query('SHOW TABLES', (err, results) => {
        if (err) {
            console.error('Query error:', err);
            process.exit(1);
        }
        console.log('Tables in Foorumi database:', results.map(row => Object.values(row)[0]).join(', '));
        
        // Close connection
        db.end();
    });
});
TEST_DB

node test_new_db.js
"

echo "MySQL authentication fixed"
