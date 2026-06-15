#!/bin/sh
# If running a custom command (e.g. healthcheck), execute it directly
if [ $# -gt 0 ]; then
  exec "$@"
fi

# Fix permissions for data directory (volume may have wrong ownership)
chown -R buzztrack:buzztrack /app/data 2>/dev/null || true

# Drop privileges and run the app
exec su -s /bin/sh buzztrack -c "node dist/server.cjs"
