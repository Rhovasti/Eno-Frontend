#!/bin/bash

# Make the renewal script executable
chmod +x renew_ssl_certificate.sh

# Add crontab entry to run twice per month (1st and 15th at 3:30 AM)
(crontab -l 2>/dev/null || echo "") | grep -v "renew_ssl_certificate.sh" | { cat; echo "30 3 1,15 * * $(pwd)/renew_ssl_certificate.sh >> $(pwd)/ssl_renewal.log 2>&1"; } | crontab -

echo "Automatic SSL certificate renewal has been set up"
echo "The certificate will be renewed on the 1st and 15th of each month at 3:30 AM"
echo "Logs will be saved to $(pwd)/ssl_renewal.log"

# For manual renewal, test with:
echo ""
echo "To test certificate renewal without actually renewing, run:"
echo "certbot renew --dry-run"