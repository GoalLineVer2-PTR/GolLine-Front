#!/bin/sh
set -e

if [ -n "$API_URL" ]; then
  printf "window.GOALLINE_API_URL = '%s';\n" "$API_URL" > /usr/share/nginx/html/js/config.js
fi

exec "$@"
