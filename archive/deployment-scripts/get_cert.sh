#!/bin/bash

# Delete existing certificate (since we have backups)
certbot delete --cert-name www.iinou.eu --non-interactive

# Obtain a new certificate using the Apache plugin
certbot --apache -d www.iinou.eu -d iinou.eu --non-interactive --agree-tos --email admin@iinou.eu

# Verify renewal works
certbot renew --dry-run