# SSL Certificate Renewal Issue Documentation

## Current Situation (2025-06-07)

### Problem
- SSL certificate for iinou.eu expired on 2025-05-27
- Automatic renewal is not working
- Manual renewal attempts are timing out

### Root Cause Analysis

1. **Manual DNS Challenge Configuration**
   - Certificate was originally obtained using manual DNS-01 challenge
   - This requires manual DNS TXT record updates for renewal
   - Cannot be automated without DNS API access

2. **IPv6 Issues**
   - Server has IPv6 address (2a01:4f9:c010:614a::1)
   - Let's Encrypt tries IPv6 first and fails
   - May need to disable IPv6 or fix IPv6 routing

3. **Firewall/Port Issues**
   - Port 80 might be blocked for ACME challenges
   - Apache configuration might not serve .well-known directory

## Solutions Implemented

### 1. Auto-Renewal Setup
Created monitoring and renewal scripts:
- Added systemd timer (runs twice daily)
- Created renewal hooks for service management
- Set up weekly certificate expiry checks

### 2. Configuration Updates
- Updated renewal config to use webroot authentication
- Created .well-known/acme-challenge directory
- Installed Apache plugin for certbot

## Manual Renewal Options

### Option 1: Using DNS Challenge (Current Method)
```bash
# SSH to server
ssh root@95.217.21.111

# Run manual renewal
certbot certonly --manual --preferred-challenges dns -d www.iinou.eu -d iinou.eu

# Follow prompts to update DNS TXT records
# Wait for DNS propagation
# Complete validation
```

### Option 2: Disable IPv6 Temporarily
```bash
# Disable IPv6 for renewal
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1

# Run renewal
certbot renew --force-renewal

# Re-enable IPv6
sysctl -w net.ipv6.conf.all.disable_ipv6=0
sysctl -w net.ipv6.conf.default.disable_ipv6=0
```

### Option 3: Use Standalone with IPv4 Only
```bash
# Stop Apache
systemctl stop apache2

# Force IPv4 only renewal
certbot certonly --standalone --preferred-challenges http -d www.iinou.eu -d iinou.eu --force-renewal -4

# Start Apache
systemctl start apache2
```

## Permanent Solution Recommendations

### 1. DNS API Integration
- Get API access from DNS provider
- Use DNS plugin for automatic renewal
- Example: certbot-dns-cloudflare, certbot-dns-route53

### 2. Fix IPv6 Configuration
- Ensure IPv6 is properly configured
- Check firewall rules for IPv6
- Verify Apache listens on IPv6

### 3. Switch to HTTP-01 Challenge
- Ensure port 80 is open
- Configure Apache to serve .well-known
- Use webroot or apache plugin

## Apache Configuration for ACME
Add to Apache virtual host configuration:
```apache
<Directory /var/www/pelisivusto/.well-known>
    Options None
    AllowOverride None
    Require all granted
</Directory>

Alias /.well-known/acme-challenge /var/www/pelisivusto/.well-known/acme-challenge
```

## Monitoring Commands

```bash
# Check certificate expiry
certbot certificates

# Check renewal configuration
cat /etc/letsencrypt/renewal/www.iinou.eu.conf

# Test renewal (dry run)
certbot renew --dry-run

# Check systemd timer
systemctl status certbot.timer

# View renewal logs
journalctl -u certbot
tail -f /var/log/letsencrypt/letsencrypt.log
```

## Emergency Workaround

While SSL is being fixed, users can:
1. Access site via HTTP: http://www.iinou.eu
2. Accept security warning in browser
3. Use production API with -k flag in curl

## Next Steps

1. **Immediate**: Try manual DNS renewal or IPv4-only standalone
2. **Short-term**: Fix Apache configuration for HTTP-01 challenges
3. **Long-term**: Implement DNS API for fully automated renewal

## Important Notes

- Image generation feature is deployed and working
- Server is running on port 3000
- Database and application are functional
- Only SSL certificate is the issue

---

**Created**: 2025-06-07  
**Issue Started**: 2025-05-27 (certificate expiry)  
**Last Update**: 2025-06-07