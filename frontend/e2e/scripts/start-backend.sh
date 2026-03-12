#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
DB_PATH="/tmp/runtao-academy-e2e.db"

rm -f "$DB_PATH"

cd "$BACKEND_DIR"
npm run build >/dev/null

exec env \
  PORT=3102 \
  NODE_ENV=test \
  JWT_SECRET=e2e-secret-key \
  JWT_EXPIRES_IN=7d \
  DATABASE_TYPE=sqlite \
  SQLITE_PATH="$DB_PATH" \
  AI_ENABLED=true \
  DEFAULT_AI_PROVIDER=openai \
  OPENAI_API_KEY=e2e-fake-key \
  INIT_ADMIN_USERNAME=e2e_admin \
  INIT_ADMIN_EMAIL=e2e_admin@example.com \
  INIT_ADMIN_PASSWORD=AdminPass123 \
  npm start
