#!/bin/bash
# Panel doğrulama akışı — dev sunucuyu başlat, tüm görünümleri ve PDF akışını tek oturumda test et
cd /home/z/my-project

setsid nohup bun run dev > dev.log 2>&1 < /dev/null &
echo "[1] sunucu başlatıldı, hazır olması bekleniyor..."
for i in $(seq 1 40); do
  if curl -s -o /dev/null --max-time 3 http://localhost:3000/; then break; fi
  sleep 2
done
curl -s -o /dev/null -w "    sunucu: HTTP %{http_code}\n" --max-time 10 http://localhost:3000/

agent-browser open http://localhost:3000/ 2>&1 | head -1
agent-browser wait 3500

echo "[2] demo girişi"
agent-browser eval "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Demo veriyle önizle'))?.click(); 'ok'" 2>&1 | head -1
agent-browser wait 2500

echo "[3] Yönetim Raporları"
agent-browser eval "[...document.querySelectorAll('a')].find(a=>a.textContent.includes('Yönetim Raporları'))?.click(); 'ok'" 2>&1 | head -1
agent-browser wait 2500

echo "[4] PDF indir testi (Modül 1)"
agent-browser eval "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('PDF indir'))?.click(); 'ok'" 2>&1 | head -1
agent-browser wait 7000
echo "    sayfa hataları:"; agent-browser errors 2>&1 | tail -3
echo "    toast: $(agent-browser eval "document.body.innerText.includes('PDF indirildi') ? 'PDF indirildi TOAST OK' : (document.body.innerText.includes('PDF oluşturulamadı') ? 'HATA TOAST' : 'toast yok')" 2>&1 | head -1)"

echo "[5] Yıllık görünüm toggle"
agent-browser eval "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Yıllık')?.click(); 'ok'" 2>&1 | head -1
agent-browser wait 1500

echo "[6] Müşteri Kartları"
agent-browser eval "[...document.querySelectorAll('a')].find(a=>a.textContent.includes('Müşteri Kartları'))?.click(); 'ok'" 2>&1 | head -1
agent-browser wait 2200
agent-browser screenshot /tmp/mkart2.png 2>&1 | head -1
echo "    hatalar:"; agent-browser errors 2>&1 | tail -3

echo "[7] koyu tema kontrolü"
agent-browser eval "[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Tema değiştir')?.click(); 'ok'" 2>&1 | head -1
agent-browser wait 1500
agent-browser eval "[...document.querySelectorAll('a')].find(a=>a.textContent.includes('Yönetim Raporları'))?.click(); 'ok'" 2>&1 | head -1
agent-browser wait 2000
agent-browser screenshot /tmp/dark.png 2>&1 | head -1

echo "[8] konsol son kayıtlar"
agent-browser console 2>&1 | tail -4
echo "TAMAM"
