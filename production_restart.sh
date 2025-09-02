#!/bin/bash
# Quick production restart script

cd /var/www/pelisivusto
pkill -f "node.*server"
sleep 2
export AWS_REGION=eu-north-1
export AWS_BUCKET_NAME=kuvatjakalat
nohup node js/server_sqlite_new.js > server.log 2>&1 &
echo "Server restarted with image generation support"