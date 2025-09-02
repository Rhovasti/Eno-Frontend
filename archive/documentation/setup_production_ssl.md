# SSL Certificate Setup for www.iinou.eu

This guide will help you set up and automatically renew Let's Encrypt SSL certificates for www.iinou.eu.

## Prerequisites

- A server with Ubuntu/Debian
- Root or sudo access
- Domain name (www.iinou.eu) pointing to your server IP
- Either Apache or Nginx web server

## 1. Install Certbot

```bash
sudo apt update
sudo apt install -y certbot
```

For Apache:
```bash
sudo apt install -y python3-certbot-apache
```

For Nginx:
```bash
sudo apt install -y python3-certbot-nginx
```

## 2. Obtain Initial Certificate

### For Apache

```bash
sudo certbot --apache -d www.iinou.eu -d iinou.eu
```

### For Nginx

```bash
sudo certbot --nginx -d www.iinou.eu -d iinou.eu
```

Follow the prompts to complete the certificate installation.

## 3. Verify Automatic Renewal

Certbot creates a systemd timer that runs twice daily to check if your certificates need renewal.

To verify it's working:

```bash
sudo systemctl status certbot.timer
```

You should see that the timer is active and enabled.

## 4. Test the Renewal Process

```bash
sudo certbot renew --dry-run
```

This should complete without errors.

## 5. Additional Configuration

If you need to customize the renewal process, you can create a renewal hook script:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/post
sudo nano /etc/letsencrypt/renewal-hooks/post/reload-webserver.sh
```

Add the following content:

```bash
#!/bin/bash

# Reload web server after certificate renewal
if command -v apache2ctl &> /dev/null; then
    apache2ctl graceful
elif command -v nginx &> /dev/null; then
    nginx -s reload
fi
```

Make the script executable:

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-webserver.sh
```

## Troubleshooting

If you encounter issues:

1. Check the certbot logs:
   ```bash
   sudo journalctl -u certbot
   ```

2. Ensure ports 80 and 443 are open in your firewall:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. Verify domain DNS resolves correctly:
   ```bash
   dig www.iinou.eu
   ```

For additional help, visit the Let's Encrypt community forum: https://community.letsencrypt.org/