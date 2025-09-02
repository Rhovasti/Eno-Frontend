#\!/bin/bash

# Create the target directory on the server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 'mkdir -p /var/www/pelisivusto'

# Upload the files with scp (recursive)
sshpass -p 'ininFvTPNTguUtuuLbx3' scp -r -o StrictHostKeyChecking=no css hml js sql index.html package.json package-lock.json root@95.217.21.111:/var/www/pelisivusto/

echo 'SCP upload completed'

