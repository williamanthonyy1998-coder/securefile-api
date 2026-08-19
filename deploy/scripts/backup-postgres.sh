#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
pg_dump "$DATABASE_URL" > "backup-$(date +%Y%m%d-%H%M%S).sql"
echo "Backup created."
