#!/bin/bash

# Script to manually renew the Let's Encrypt SSL certificate
# This only needs to be run when the current certificate is about to expire

# Check current certificate status
echo "Current certificate information:"
certbot certificates

# Verify that the current certificate files exist
if [ ! -f /etc/letsencrypt/live/www.iinou.eu/fullchain.pem ]; then
    echo "ERROR: Certificate file doesn't exist!"
    exit 1
fi

# Instructions for manual renewal
echo "===================================================================="
echo "IMPORTANT: Since your certificate was originally obtained with the"
echo "manual plugin, you'll need to perform a manual renewal process."
echo "===================================================================="
echo ""
echo "To renew the certificate manually:"
echo ""
echo "1. Run: certbot certonly --manual -d www.iinou.eu -d iinou.eu"
echo "2. Follow the instructions to complete the DNS or HTTP challenge"
echo "3. After the certificate is renewed, reload Apache: systemctl reload apache2"
echo ""
echo "The automatic renewal will be attempted by the system but might fail."
echo "If you receive email notifications about renewal failures, run this script."