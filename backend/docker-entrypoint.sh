#!/bin/sh
set -e
# Fresh Postgres volumes have no garage tables; apply pending SQL before HTTP traffic.
node dist/database/migrate.js up
exec node --max-old-space-size=192 dist/main.js
