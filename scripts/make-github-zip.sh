#!/bin/bash
# GitHub'a push için tam proje paketi (RTDB + yükleme sayımı düzeltmesi dahil)
set -e
cd /home/z/my-project

OUT1="/home/z/my-project/download/yatsan-panel-github.zip"
OUT2="/home/z/my-project/public/yatsan-panel.zip"

rm -f "$OUT1" "$OUT2"

# Zip kök seviyesinde proje dosyaları (repo köküne doğrudan kopyalanabilir)
zip -q -r "$OUT1" \
  src public scripts \
  package.json bun.lock tsconfig.json next.config.ts \
  tailwind.config.ts postcss.config.mjs eslint.config.mjs components.json \
  firebase.json database.rules.json firestore.rules .env.example README.md \
  -x "public/*.zip" -x "*.DS_Store"

cp "$OUT1" "$OUT2"

echo "== $OUT1 =="
unzip -l "$OUT1" | tail -3
echo "== public servis =="
ls -la "$OUT2"
