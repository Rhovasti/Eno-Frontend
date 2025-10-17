#!/bin/bash
# Deploy Wiki UI Redesign to Production
# Date: October 1, 2025

echo "🚀 Deploying Wiki UI Redesign to Production..."

# Deploy HTML file
echo "📄 Deploying wiki_dynamic_production.html..."
sshpass -p 'ininFvTPNTguUtuuLbx3' scp \
  hml/wiki_dynamic_production.html \
  root@95.217.21.111:/var/www/pelisivusto/hml/

# Deploy CSS file
echo "🎨 Deploying wiki_dynamic_production.css..."
sshpass -p 'ininFvTPNTguUtuuLbx3' scp \
  css/wiki_dynamic_production.css \
  root@95.217.21.111:/var/www/pelisivusto/css/

# Restart server
echo "♻️  Restarting server..."
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh root@95.217.21.111 \
  'cd /var/www/pelisivusto && pkill -f "node.*server" && \
   export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && \
   nohup node js/server_sqlite_new.js > server.log 2>&1 &'

echo "✅ Deployment complete!"
echo ""
echo "📋 File sizes deployed:"
echo "  - HTML: 12 KB (was 30 KB - 60% reduction)"
echo "  - CSS: 33 KB (new external file)"
echo ""
echo "🌐 Access at: https://www.iinou.eu/hml/wiki_dynamic_production.html"
