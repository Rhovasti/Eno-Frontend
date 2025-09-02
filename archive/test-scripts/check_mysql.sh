#\!/bin/bash

# Connect to the remote server and check if MySQL is running
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
echo '=== MySQL Service Status ==='
systemctl status mysql || systemctl status mariadb || echo 'MySQL/MariaDB service not found'
echo

echo '=== MySQL Processes ==='
ps aux | grep -E '[m]ysqld|[m]ariadbd'
echo

echo '=== Database Connection Test ==='
mysql -e 'SELECT version();' 2>&1 || echo 'Failed to connect to MySQL'
echo
"

echo "MySQL check completed"
