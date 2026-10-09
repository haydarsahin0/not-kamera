# Not Kamera

iPhone Safari için fotoğraf analizi ve sesli okuma arayüzü. GitHub Pages arayüzü + ayrı Python API sunucusu.

## Durum

- Kaynak kodu haydarsahin0/not-kamera deposundadır; canlı API sunucusu henüz kurulmadı. GitHub Pages yayını kullanıcı tarafından başlatılacaktır.
- Claude API anahtarı ve seçtiğin görüntü destekleyen Claude model kimliği gereklidir. API kullanımı ayrıca ücretlendirilir.
- iPhone donanımı ve gerçek XIAO kamera ile henüz test edilmedi. Kamera yazılımı bu pakete dahil değildir; aşağıda HTTP protokolü tanımlıdır.
- Örnek düğmesi gerçek API çağrısı yapmaz; açıkça örnek olarak işaretlidir.
- Bu ilk sürüm tek kullanıcı ve tek sunucu işlemi içindir. Çok kullanıcılı bir hizmet değildir.

## 1. Yerel arayüz

Proje klasöründe:

```sh
python3 -m http.server 8080 --directory web
```

Bilgisayarda http://localhost:8080 adresini aç. Örnek ekranı ve sesli okumayı sunucu olmadan deneyebilirsin. iPhone'da localhost bilgisayarını göstermez; gerçek kullanım için HTTPS adresleri gerekir.

## 2. Sunucu

Python 3.11+ gerekir:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
```

`backend/.env.example` gerekli değişkenleri açıklar. Dosya otomatik yüklenmez; ortam değişkenlerini işletim sisteminden veya hosting panelinden ayarla. APP_TOKEN ve DEVICE_TOKEN için ayrı, rastgele en az 32 karakter kullan. Örneğin iki defa `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` çalıştır. Gerçek değerleri GitHub'a veya sohbetlere koyma.

Gerekli ortam değişkenleri:

- `ANTHROPIC_API_KEY`: yalnızca sunucuda kalır.
- `CLAUDE_MODEL`: hesabında erişebildiğin görüntü destekli modelin tam kimliği; bilerek varsayılan model seçilmedi.
- `APP_TOKEN`: iPhone'daki Bağlantı ekranına girilecek özel erişim kodu.
- `DEVICE_TOKEN`: yalnızca kameranın kullanacağı farklı kod. Sonuçları okumaya yetkisi yoktur.
- `ALLOWED_ORIGINS`: yerelde `http://localhost:8080`, yayında `https://haydarsahin0.github.io`. Virgülle birden fazla origin olabilir. Repo yolunu ekleme.
- `DATABASE_PATH`: yazılabilir kalıcı disk üzerindeki SQLite dosyası; varsayılan backend/data.sqlite3.

```sh
uvicorn backend.app:app --host 127.0.0.1 --port 8000 --workers 1
```

İnternete açarken HTTPS reverse proxy/hosting kullan, 4 MB gövde sınırı ve istek zaman aşımı uygula. Dockerfile sağlandı. Kalıcı diski `/data` konumuna bağla. Gerçek bir barındırma sağlayıcısı henüz seçilmedi veya açılmadı. Tek worker kullan; yatay ölçekleme/çoklu worker için kuyruk ve limit sistemi değiştirilmelidir.

## 3. GitHub Pages

1. Yeni bir depo oluştur veya bu projeye ayrılmış mevcut depoyu seç.
2. Bu klasörün içeriğini, `.github` klasörü dahil, deponun köküne koy. Gerçek sırları ekleme.
3. Varsayılan dalı `main` yap.
4. Settings → Pages → Source: GitHub Actions seç.
5. Actions → Publish web app → Run workflow seç. Workflow yalnızca elle başlatılır ve sadece `web/` klasörünü yayınlar. Backend ve sırlar Pages çıktısına girmez.
6. Ana sayfa `https://haydarsahin0.github.io/DEPO-ADI/` olur.
7. iPhone Safari'de Bağlantı ekranına ayrı sunucunun HTTPS adresini ve APP_TOKEN değerini gir.

GitHub Pages statik hosting olduğu için Python sunucusu çalıştırmaz. API anahtarını JavaScript'e eklemek çözüm değildir. GitHub Free ile Pages için genellikle public depo gerekir; hesabının planını kontrol et. Arayüz herkese açık olabilir, sonuçlar token korumalı API'de kalır.

## 4. XIAO kamera protokolü

Kameraya Wi-Fi, sunucu URL'si, DEVICE_TOKEN ve sunucunun geçerli TLS sertifika doğrulaması programlanmalıdır. TLS doğrulamasını kapatma. API anahtarı kameraya yazılmaz.

- `POST https://SUNUCU/api/frames`
- `Authorization: Bearer DEVICE_TOKEN`
- `Content-Type: image/jpeg`
- Gövde: ham JPEG baytları (multipart veya base64 değil), en fazla 4 MB.
- Başarılı: HTTP 202 ve `{ "id": "..." }`.
- HTTP 429: en az 10 saniye bekle; bitmeyen döngüyle tekrar gönderme.
- HTTP 401: token yanlış, gönderimi durdur.
- HTTP 503: Claude ayarları eksik.

Telefon aynı Wi-Fi'de olmak zorunda değildir; hem kamera hem telefon HTTPS sunucusuna ulaşabilmelidir. Kamera bataryası tek başına internet sağlamaz.

Maliyet kontrolü: aynı anda bir analiz, en az 10 saniye aralık ve süreç başına saatte 60 kabul sınırı. Claude hesabında ayrıca harcama limiti ayarla. Sunucu yeniden başladığında saatlik sayaç sıfırlanır. Birebir aynı JPEG'in başarılı sonucu 24 saat içinde tekrar kullanılır; azıcık değişen fotoğraflar yeni sayılır. Bulanıklık/sayfa değişimi tespiti veya otomatik çekim firmware'i bu sürümde YOKTUR.

## 5. iPhone kullanımı

- “Fotoğraf çek veya seç” ile telefondan fotoğraf yükleyebilir, fiziksel kamerayı beklemeden test edebilirsin.
- Fotoğraflar tarayıcıda JPEG'e dönüştürülüp uzun kenarı en fazla 2200 piksele indirilir. HEIC açılamazsa JPEG seç.
- “Kamera takibi” sunucudaki yeni sonuçları 4 saniyede bir kontrol eder; kameranın çekimini başlatmaz/durdurmaz.
- “Sesli oku” yerleşik tarayıcı konuşma motorunu kullanır. Türkçe ses kalitesi cihazdaki seslere bağlıdır. Kulaklığı iPhone'a bağla.
- Otomatik ses, Safari izinleri nedeniyle kullanıcı dokunuşu isteyebilir. Ekran kilitlendiğinde veya Safari arka plana geçtiğinde sürekli takip/okuma garantisi yok. Tam arka plan çalışması için ayrı yerel iOS uygulaması gerekir.
- Sunucu adresi ve uygulama kodu yalnızca sekmenin sessionStorage alanında tutulur. Yeniden bağlanmak için Bağlantı düğmesine dokun.

## Veri ve sınırlar

Görüntü sunucuda RAM'de işlenir ve Claude'a iletilir; görüntü dosyası kalıcı olarak tutulmaz. Claude'un kendi veri işleme şartları ayrıca geçerlidir. Açıklamalar ve görüntü özeti SQLite'ta tutulur. 24 saati geçen kayıtlar sonraki listeleme/yükleme isteğinde silinir; bağımsız zamanlayıcı yoktur. Geçmişi sil düğmesi kayıtları hemen siler. Veritabanı disk şifrelemesi hostingin sorumluluğundadır.

Görüntü netliği veya yapay zekâ doğruluğu garanti değildir. iPhone ekran boyutunda Chromium ile arayüz testi, yerel API güvenlik/hata kontrolleri yapılabilir; gerçek Safari, donanım ve gerçek Claude çağrısı ayrı doğrulama gerektirir.

## Bu pakette yapılan doğrulamalar

- Python derleme ve JavaScript sözdizimi kontrolü geçti.
- API: yetkisiz istek, cihaz kodunun sonuçları okuyamaması, eksik Claude ayarı, bozuk resim reddi, JPEG gönderimi, taklit Claude cevabı, sonuç listeleme, yabancı origin reddi ve geçmiş silme testleri geçti.
- Gerçek Claude çağrısı yapılmadı.
- Tarayıcı motoru bu ortamda indirilemediği için görsel tarayıcı testi tamamlanamadı. Gerçek iPhone/Safari ve kamera testi yapılmadı.
