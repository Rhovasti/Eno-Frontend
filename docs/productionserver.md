# Eno Frontend Production Server Documentation

> **✅ SSL STATUS**: SSL certificate is VALID until 2025-11-05. Auto-renewal via Certbot is working correctly with systemd timer.
> 
> **✅ SERVER STATUS**: Production server is online and functional as of 2025-09-24. Latest deployment includes Wiki system, Narrative Engine, and AsyncGameManager.
> 
> **🎨 IMAGE GENERATION**: UI visible on production with "coming soon" placeholder. Backend integration requires dependency resolution (see `js/server_sqlite_new.js` issues).

## Production Server Overview

### Server Details
- **Primary Domain:** https://www.iinou.eu (also accessible via https://iinou.eu)
- **Server IP:** 95.217.21.111
- **SSH Access:** `root@95.217.21.111`
- **Application Path:** `/var/www/pelisivusto`
- **Node.js Port:** 3000
- **Web Server:** Apache/Nginx (reverse proxy to Node.js)

## Quick Deployment Commands

### Deploy Latest Code with Image Feature
```bash
# From local development machine (/root/Eno/Eno-Frontend)
./deploy_ai_gm_enhanced.sh
```

### Manual Deployment Steps
```bash
# 1. Upload files via SCP
sshpass -p 'ininFvTPNTguUtuuLbx3' scp -r \
  js/server_sqlite_new.js \
  js/services/ \
  hml/ \
  css/ \
  style/ \
  .env \
  root@95.217.21.111:/var/www/pelisivusto/

# 2. SSH into server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh root@95.217.21.111

# 3. Navigate to application directory
cd /var/www/pelisivusto

# 4. Stop current server
pkill -f "node.*server"

# 5. Start new server with environment variables
export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && nohup node js/server_sqlite_new.js > server.log 2>&1 &

# 6. Exit SSH
exit
```

## Environment Configuration

### Required Environment Variables (.env file)
```bash
# AI Service Configuration
AI_SERVICE=anthropic
AI_API_KEY=your-claude-api-key-here
AI_MODEL=claude-3-haiku-20240307

# JWT Secret (CHANGE IN PRODUCTION!)
JWT_SECRET=eno-game-platform-secret-key-change-in-production
PORT=3000

# AWS S3 Configuration (for image storage)
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_BUCKET_NAME=kuvatjakalat
AWS_REGION=eu-north-1

# Stability AI Configuration (for image generation)
STABILITY_API_KEY=your-stability-api-key-here
```

## Database Management

### Production Database
- **Type:** SQLite
- **Location:** `/var/www/pelisivusto/data/database.sqlite`
- **Backup:** Automatically created as `.backup` files

### Database Migrations
```bash
# Apply schema updates on production
cd /var/www/pelisivusto
sqlite3 data/database.sqlite < sql/update_schema.sql

# Backup database before major changes
cp data/database.sqlite data/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)
```

## SSL Certificate Management

### Current SSL Setup
- **Certificate Provider:** Let's Encrypt
- **Auto-renewal:** Configured via Certbot
- **Web Server Config:** Apache/Nginx handles SSL termination

### Manual SSL Renewal
```bash
# Run on production server
certbot renew --dry-run  # Test renewal
certbot renew           # Actual renewal
systemctl reload apache2 # Or nginx
```

### SSL Configuration Check
```bash
# Verify SSL certificate
curl -I https://www.iinou.eu
openssl s_client -connect www.iinou.eu:443 -servername www.iinou.eu
```

## Service Management

### Systemd Service
The Node.js server runs as a systemd service for automatic startup and management.

```bash
# Service file location: /etc/systemd/system/eno-server.service
[Unit]
Description=Eno Game Platform Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/pelisivusto
Environment="AWS_REGION=eu-north-1"
Environment="AWS_BUCKET_NAME=kuvatjakalat"
ExecStart=/usr/bin/node /var/www/pelisivusto/js/server_sqlite_new.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Service Commands
```bash
# Start/stop/restart service
systemctl start eno-server
systemctl stop eno-server
systemctl restart eno-server

# Check service status
systemctl status eno-server

# View logs
journalctl -u eno-server -f
```

## Deployment Scripts

### Available Deployment Scripts
1. **deploy_ai_gm_enhanced.sh** - Full deployment with AI & image features
2. **deploy_profile_to_iinou.sh** - Deploy profile features only
3. **deploy_dice_to_iinou.sh** - Deploy dice roll features
4. **restart_iinou_server.sh** - Restart production server only
5. **sync_production_scp.sh** - Sync specific files

### Creating New Deployment Script
```bash
#!/bin/bash
# deploy_image_feature.sh

echo "Deploying image generation feature to production..."

# Define files to deploy
FILES_TO_DEPLOY="
js/server_sqlite_new.js
js/services/imageService.js
hml/threads.html
css/styles.css
style/
.env
"

# Deploy files
for file in $FILES_TO_DEPLOY; do
    echo "Uploading $file..."
    sshpass -p 'ininFvTPNTguUtuuLbx3' scp -r $file root@95.217.21.111:/var/www/pelisivusto/
done

# Restart server
echo "Restarting production server..."
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh root@95.217.21.111 'cd /var/www/pelisivusto && pkill -f "node.*server" && export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && nohup node js/server_sqlite_new.js > server.log 2>&1 &'

echo "Deployment complete!"
```

## Production Monitoring

### Health Checks
```bash
# Check if server is running
curl -s https://www.iinou.eu/api/games

# Check server logs
ssh root@95.217.21.111 'tail -f /var/www/pelisivusto/server.log'

# Check system resources
ssh root@95.217.21.111 'htop'
```

### Common Production Issues

#### 1. Server Not Responding
```bash
# SSH to server and check process
ssh root@95.217.21.111
ps aux | grep node
# If not running, restart:
cd /var/www/pelisivusto
./restart_server.sh
```

#### 2. Database Locked
```bash
# On production server
cd /var/www/pelisivusto
# Check for locked database
lsof data/database.sqlite
# Kill stuck processes if needed
```

#### 3. Image Generation Failures
- Check AWS credentials in .env
- Verify Stability AI API key is valid
- Check S3 bucket permissions
- Review server logs for API errors

#### 4. SSL Certificate Issues
```bash
# Check certificate expiration
certbot certificates
# Force renewal if needed
certbot renew --force-renewal
```

## Security Considerations

### Production Security Checklist
- [ ] Change JWT_SECRET from default value
- [ ] Use strong database passwords
- [ ] Keep API keys secure and rotate regularly
- [ ] Enable firewall (only allow 80, 443, 22)
- [ ] Regular security updates: `apt update && apt upgrade`
- [ ] Monitor access logs: `/var/log/apache2/access.log`
- [ ] Set up fail2ban for SSH protection
- [ ] Use environment variables, never hardcode secrets

### Backup Strategy
```bash
# Daily backup script (add to crontab)
#!/bin/bash
BACKUP_DIR="/var/backups/eno"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
cp /var/www/pelisivusto/data/database.sqlite $BACKUP_DIR/database_$DATE.sqlite

# Backup uploaded images (if stored locally)
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/pelisivusto/uploads/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sqlite" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

## API Endpoints Reference

### Public Endpoints
- `GET https://www.iinou.eu/` - Main application
- `GET https://www.iinou.eu/hml/login.html` - Login page
- `GET https://www.iinou.eu/hml/register.html` - Registration

### Protected Endpoints (require authentication)
- `GET https://www.iinou.eu/api/games` - List games
- `POST https://www.iinou.eu/api/posts` - Create post
- `POST https://www.iinou.eu/api/posts/:id/generate-image` - Generate AI image

## Testing Production Deployment

### Post-Deployment Checklist
1. [ ] Website loads: https://www.iinou.eu
2. [ ] Can login with test account
3. [ ] Can view game threads
4. [ ] Can create new posts
5. [ ] Image generation works (sketch + AI)
6. [ ] Images display correctly from S3
7. [ ] No console errors in browser
8. [ ] SSL certificate valid

### Test Commands
```bash
# Test API health
curl -s https://www.iinou.eu/api/games | jq

# Test image generation endpoint (requires auth token)
curl -X POST https://www.iinou.eu/api/posts/1/generate-image \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_AUTH_TOKEN" \
  -d '{"prompt": "test image", "style": "cartoon"}'
```

## Rollback Procedures

### Quick Rollback
```bash
# 1. SSH to production
ssh root@95.217.21.111

# 2. Stop current server
pkill -f "node.*server"

# 3. Restore previous version
cd /var/www/pelisivusto
cp js/server_sqlite_backup.js js/server_sqlite_new.js

# 4. Restore database if needed
cp data/database.sqlite.backup data/database.sqlite

# 5. Restart server
./restart_server.sh
```

## Contact & Support

### Server Access Issues
- Primary server credentials are stored securely
- Backup access available through hosting provider panel
- DNS managed through domain registrar

### Emergency Contacts
- Hosting Provider: Hetzner (for 95.217.21.111)
- Domain Registrar: (check WHOIS for iinou.eu)
- SSL Issues: Let's Encrypt community forums

---

**Last Updated:** 2025-01-06  
**Current Production Version:** SQLite-based server with AI image generation  
**Next Planned Features:** Multiple aspect ratio support, improved image resolution