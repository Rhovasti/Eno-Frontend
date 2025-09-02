#!/bin/bash

echo "=== Eno Server Restart with MySQL Recovery ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo or as root"
  exit 1
fi

# Stop any running Node.js server
echo "Stopping any running Node.js servers..."
pkill -f "node.*server.js" || true

# Run the MySQL recovery script
echo "Running MySQL recovery script..."
./fix_mysql_auto.sh

# Check the status code of the recovery script
if [ $? -ne 0 ]; then
  echo "MySQL recovery failed. Please check the logs and fix the issues manually."
  exit 1
fi

# Restart the Node.js server
echo "Starting the Node.js server..."
NODE_ENV=production nohup node js/server.js > server.log 2>&1 &

# Save the PID for future reference
PID=$!
echo $PID > server.pid
echo "Server started with PID: $PID"

# Check if server is responding
echo "Waiting for server to start..."
sleep 5
if curl -s http://localhost:3000/health | grep -q "ok"; then
  echo "Server is up and running!"
else
  echo "Server may not have started correctly. Check server.log for details."
  tail -n 20 server.log
fi

echo "=== Process complete ==="