#!/bin/sh
# If running a custom command (e.g. healthcheck), execute it directly
if [ $# -gt 0 ]; then
  exec "$@"
fi

# Fix permissions for data directory (volume may have wrong ownership)
chown -R buzztrack:buzztrack /app/data 2>/dev/null || true

# Explicitly export env vars for Python scrapers
export TWITTER_COOKIES="${TWITTER_COOKIES}"
export YOUTUBE_API_KEY="${YOUTUBE_API_KEY}"
export TIKTOK_MS_TOKEN="${TIKTOK_MS_TOKEN}"
export DISABLE_PYTHON_SCRAPERS="${DISABLE_PYTHON_SCRAPERS:-false}"

# Drop privileges and run the app
exec su -s /bin/sh buzztrack -c "node dist/server.cjs"
