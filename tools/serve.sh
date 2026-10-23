#!/usr/bin/env bash
# Builds and serves the site locally. Open http://localhost:4000 when it is ready.
#   ./serve.sh          build and serve (reuses the previous build)
#   ./serve.sh clean    throw away the previous build first

# The script lives in tools; the site is one folder up.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

JEKYLL_PORT="${JEKYLL_PORT:-4000}"
# 127.0.0.1 is reachable from this computer only. Run with JEKYLL_HOST=0.0.0.0
# to let other devices on the network open it.
JEKYLL_HOST="${JEKYLL_HOST:-127.0.0.1}"

JEKYLL_CLEAN=0
for arg in "$@"; do
    opt=$(printf '%s' "$arg" | tr 'A-Z' 'a-z' | tr -d '-')
    case "$opt" in
        build) ;;
        clean) JEKYLL_CLEAN=1 ;;
        *) echo "Unknown option \"$arg\". Use: ./serve.sh or ./serve.sh clean"; exit 1 ;;
    esac
done

if [ ! -f "_config.yml" ]; then
    echo "Could not find _config.yml in $PWD - keep this script in the tools folder."
    exit 1
fi
echo "Site root: $PWD"
echo

if [ "$JEKYLL_CLEAN" = "1" ]; then
    echo "Removing the previous build..."
    rm -rf _site .jekyll-cache .jekyll-metadata
fi

if ! command -v bundle >/dev/null 2>&1; then
    echo "Bundler was not found. Install Ruby (https://jekyllrb.com/docs/installation/) and run: gem install bundler"
    exit 1
fi

if ! bundle check >/dev/null 2>&1; then
    echo "Installing gems..."
    bundle install || { echo; echo "bundle install failed - see the messages above."; exit 1; }
    echo
fi

# Stop an old server still holding the port, or it keeps serving the old build.
old_pids=""
if command -v lsof >/dev/null 2>&1; then
    old_pids=$(lsof -ti "tcp:$JEKYLL_PORT" -sTCP:LISTEN 2>/dev/null)
elif command -v fuser >/dev/null 2>&1; then
    old_pids=$(fuser "$JEKYLL_PORT/tcp" 2>/dev/null)
fi
for pid in $old_pids; do
    echo "Stopping old server (PID $pid)..."
    kill "$pid" 2>/dev/null
done
[ -n "$old_pids" ] && sleep 1

echo "Open http://localhost:$JEKYLL_PORT when the server is ready. Press Ctrl+C to stop it."
echo

exec bundle exec jekyll serve --host "$JEKYLL_HOST" --port "$JEKYLL_PORT" --livereload --incremental
