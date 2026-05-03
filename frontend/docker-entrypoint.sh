#!/bin/sh
set -e
# Easypanel / Docker runtime: set BACKEND_URL or REACT_APP_BACKEND_URL on the frontend service
# (no trailing slash). Example: https://api.example.com
BF="${BACKEND_URL:-${REACT_APP_BACKEND_URL:-}}"
export BACKEND_URL="$BF"
envsubst '${BACKEND_URL}' < /runtime-config.js.template > /usr/share/nginx/html/runtime-config.js
exec "$@"
