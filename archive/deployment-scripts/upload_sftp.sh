#\!/bin/bash

# Create batch file
cat > sftp_commands.txt << 'EOF'
mkdir -p /var/www/pelisivusto
cd /var/www/pelisivusto
put -r css
put -r hml
put -r js
put -r sql
put index.html
put package.json
put package-lock.json
EOF

# Run SFTP with the batch file
sshpass -p 'ininFvTPNTguUtuuLbx3' sftp -o StrictHostKeyChecking=no root@95.217.21.111 < sftp_commands.txt

echo 'SFTP upload completed'

