#!/usr/bin/env bash
# تشغيل Caddy بدون Docker (Linux / macOS) أمام خادم RMS يعمل على المنفذ 4000 (npm run local)
#   الاستخدام:  sudo RMS_HOST=192.168.1.10 ./deploy/local/run-caddy.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
: "${RMS_HOST:?ضع RMS_HOST = عنوان IP الثابت لهذا الجهاز، مثل RMS_HOST=192.168.1.10}"
command -v caddy >/dev/null || { echo "ثبّت Caddy أولًا: https://caddyserver.com/docs/install"; exit 1; }
export XDG_DATA_HOME="$HERE/caddy-data" XDG_CONFIG_HOME="$HERE/caddy-config"
export RMS_UPSTREAM="${RMS_UPSTREAM:-localhost:4000}"
export RMS_CA_DIR="$XDG_DATA_HOME/caddy/pki/authorities/local"
export RMS_SETUP_DIR="$HERE"
echo "صفحة إعداد الأجهزة: http://$RMS_HOST/    النظام: https://$RMS_HOST/"
exec caddy run --config "$HERE/Caddyfile" --adapter caddyfile
