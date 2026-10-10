# Not Kamera

**Yeni 0.5.0 cihaz akışı:** [Yükleyici](https://haydarsahin0.github.io/not-kamera/install/) üzerinden firmware güncelle; cihazın `http://192.168.4.1/camera` sayfasından fotoğrafı yükle. Tek iPhone ile yükleme onayından sonra NotEkran ağından çıkıp kişisel erişim noktasını aç. Cihaz OpenAI işlemini Supabase üzerinden sürdürüp cevabın tamamını ekrana yazar; ana fotoğraf sitesi gerekmez. Güncellemede silme seçeneğini kapalı bırak. Donanımda yeni akış henüz doğrulanmadı. [Yerel kullanım ayrıntıları](firmware/README.md).


iPhone Safari için fotoğraf analizi ve sesli okuma arayüzü. GitHub Pages arayüzü + ayrı Python API sunucusu.

## Canlı kurulum — 0.4.1

Dijitalarsam Supabase projesinde `not-kamera-api` fonksiyonu yayındadır. Sabit model `gpt-6.1-sol`, Responses API, medium reasoning, 6000 çıktı token sınırı, `store:false`. API adresi hem Pages hem cihaz sayfasında hazır doldurulur:

`https://jckoovsocynnxbrsalld.supabase.co/functions/v1/not-kamera-api`

OpenAI anahtarı yalnızca Supabase secret `NOT_KAMERA_OPENAI_API_KEY` içinde kalır. APP_TOKEN yerine kullanıcıya özel uygulama erişim kodu kullanılır; yalnızca SHA-256 özeti `not_kamera_access` tablosunda tutulur. Gerçek kod GitHub'da veya derlenmiş firmware'de bulunmaz. Eşleştirmede cihazın NVS alanına kaydedilir; OpenAI API anahtarı daima sunucudadır. Sana özel kurulum bağlantısı kodu URL fragment'inden alır, fragment'i adres çubuğundan kaldırır, sekme oturumunda saklar ve bağlantıyı otomatik kontrol eder. Kod cihazın Basic giriş şifresinden farklıdır.

1. Windows Chrome/Edge ile `web/install/` üzerinden 0.4.1 yükle; önceki Not Ekran ayarlarını korumak için erase seçme.
2. Telefon ve cihazı internet erişimli ortak 2,4 GHz Wi-Fi ağına bağla. Cihazın LAN IP'sini BOOT'a uzun basarak gör. iPhone hotspot erişimi ayrıca donanımda doğrulanmalıdır.
3. Sana özel Pages kurulum bağlantısını aç. Bağlantı bölümünde cihazın yerel HTTP adresini girip “Cihazı eşleştir”a dokun. Bu bağlantı uygulama erişim kodunu cihaz sayfasına aktarır; cihazın admin girişini yap.
4. Cihaz sayfasında bağlantı kontrolü kodu NVS'ye kaydeder. Bundan sonra HTTPS Pages ana sayfasından fotoğraf seçildiğinde cevap otomatik cihaz için seçilir. Cihaz kendi internet bağlantısıyla HTTPS üzerinden tamamını alır; telefonun yerel cihaza erişmesi yalnızca ilk eşleştirmede gerekir. Fotoğrafın yüklemesi bitince Safari açık kalması fiziksel aktarım için gerekmez.
5. BOOT: tek basış sonraki sayfa, çift basış önceki sayfa, 3 saniye basılı tutma bağlantı bilgileri. 64 KiB'ye kadar tam cevap; uzunluk aşılırsa görünür hata, sessiz kesme yok. Büyük metin küçük fontta tüm sayfalara bölünür. Bir fotoğraftaki tüm görevler aynı cevap içinde korunur. Yeni fotoğraf yeni cevabı gösterir; önceki cevaplar sitedeki geçmişten tekrar seçilebilir.

Supabase kendi internete açık HTTPS adresini sağlar. GitHub Pages yalnızca arayüzdür. Oyun/ödeme tablolarına veya fonksiyonlarına dokunulmadı. Analiz için `not_kamera_access`, `not_kamera_jobs`, `not_kamera_device`, iki service-role RPC ve yeni Edge Function eklendi. RLS açık; anon/authenticated tablo erişimi ve RPC çalıştırma izni yoktur. Fonksiyonda özel bearer kod doğrulaması olduğundan platform JWT denetimi kapalıdır; anonim istek 401 döner. Görüntü kalıcı saklanmaz. Sonuçlar 24 saat sonra listeleme/claim sırasında temizlenir.

Kabul limitleri veritabanında işlemsel kilitle korunur: aynı anda bir analiz, en az 10 saniye aralık ve saatte en fazla 60 yeni iş. Bu bir para cinsinden harcama tavanı değildir. Başarılı aynı fotoğraf+profil tekrarında 24 saatlik önbellek kullanılır. 105 saniyeyi geçen OpenAI isteği hata olur; arka plan işi Supabase `EdgeRuntime.waitUntil` ile devam eder. 3 dakikalık eski processing işleri sonraki istek sırasında hata durumuna çevrilir. Model kendiliğinden değiştirilmez.

### Doğrulama

- Canlı Supabase'de yetkili model kontrolü 200 ve `ready:true`; anonim erişim 401.
- Gerçek örnek PNG → GPT-6.1 Sol → Almanca “Aufgabe 1)” ve “Aufgabe 2)” cevapları başarıyla alındı; gerçek BIP 1000 ve çarpan etkisi 50 sonuçları görüldü. Test kaydı canlı geçmişten silindi.
- Node testleri profil, numaralama yönergesi, asenkron iş, erişim, CORS, eksik cevap ve görsel sınırlarını doğrular.
- 0.4.1 ESP32 derlemesi ve tek/çift/uzun basış testleri geçti. Sunucu tam metin, SHA-256 ve eski teslimat onayı yarış testleri geçti. Önceki metin aktarımı fiziksel cihazda çalıştı; yeni bulut→ekran akışı cihazda ayrıca doğrulanmalıdır.

Kaynaklar `supabase/` içindedir. Aşağıdaki Python backend, ayrı bir sunucu tercih edilirse kullanılan alternatif kurulumdur; canlı Supabase kullanımı için gerekmez.

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

- `OPENAI_API_KEY`: yalnızca sunucuda kalır.
- `OPENAI_MODEL`: hesabında erişebildiğin görüntü destekli modelin tam kimliği; bilerek varsayılan model seçilmedi.
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
5. Actions → Publish web app → Run workflow seç. Workflow main dalında web değişikliklerinde veya elle başlatılır ve sadece `web/` klasörünü yayınlar. Backend ve sırlar Pages çıktısına girmez.
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
- HTTP 503: OpenAI ayarları eksik.

Telefon aynı Wi-Fi'de olmak zorunda değildir; hem kamera hem telefon HTTPS sunucusuna ulaşabilmelidir. Kamera bataryası tek başına internet sağlamaz.

Maliyet kontrolü: aynı anda bir analiz, en az 10 saniye aralık ve süreç başına saatte 60 kabul sınırı. OpenAI hesabında ayrıca harcama limiti ayarla. Sunucu yeniden başladığında saatlik sayaç sıfırlanır. Birebir aynı JPEG'in başarılı sonucu 24 saat içinde tekrar kullanılır; azıcık değişen fotoğraflar yeni sayılır. Bulanıklık/sayfa değişimi tespiti veya otomatik çekim firmware'i bu sürümde YOKTUR.

## 5. iPhone kullanımı

- “Fotoğraf çek veya seç” ile telefondan fotoğraf yükleyebilir, fiziksel kamerayı beklemeden test edebilirsin.
- Fotoğraflar tarayıcıda JPEG'e dönüştürülüp uzun kenarı en fazla 2200 piksele indirilir. HEIC açılamazsa JPEG seç.
- “Kamera takibi” sunucudaki yeni sonuçları 4 saniyede bir kontrol eder; kameranın çekimini başlatmaz/durdurmaz.
- “Sesli oku” yerleşik tarayıcı konuşma motorunu kullanır. Türkçe ses kalitesi cihazdaki seslere bağlıdır. Kulaklığı iPhone'a bağla.
- Otomatik ses, Safari izinleri nedeniyle kullanıcı dokunuşu isteyebilir. Ekran kilitlendiğinde veya Safari arka plana geçtiğinde sürekli takip/okuma garantisi yok. Tam arka plan çalışması için ayrı yerel iOS uygulaması gerekir.
- Sunucu adresi ve uygulama kodu yalnızca sekmenin sessionStorage alanında tutulur. Yeniden bağlanmak için Bağlantı düğmesine dokun.

## Veri ve sınırlar

Görüntü sunucuda RAM'de işlenir ve OpenAI’ye iletilir; görüntü dosyası kalıcı olarak tutulmaz. OpenAI’nin kendi veri işleme şartları ayrıca geçerlidir. Açıklamalar ve görüntü özeti SQLite'ta tutulur. 24 saati geçen kayıtlar sonraki listeleme/yükleme isteğinde silinir; bağımsız zamanlayıcı yoktur. Geçmişi sil düğmesi kayıtları hemen siler. Veritabanı disk şifrelemesi hostingin sorumluluğundadır.

Görüntü netliği veya yapay zekâ doğruluğu garanti değildir. iPhone ekran boyutunda Chromium ile arayüz testi, yerel API güvenlik/hata kontrolleri yapılabilir; gerçek Safari, donanım ve gerçek OpenAI çağrısı ayrı doğrulama gerektirir.

## Bu pakette yapılan doğrulamalar

- Python derleme ve JavaScript sözdizimi kontrolü geçti.
- API: yetkisiz istek, cihaz kodunun sonuçları okuyamaması, eksik OpenAI ayarı, bozuk resim reddi, JPEG gönderimi, taklit API cevabı, sonuç listeleme, yabancı origin reddi ve geçmiş silme testleri geçti.
- Gerçek OpenAI çağrısı yapılmadı.
- Tarayıcı motoru bu ortamda indirilemediği için görsel tarayıcı testi tamamlanamadı. Gerçek iPhone/Safari ve kamera testi yapılmadı.

## V2 e-paper ekran — 0.4.1 doğrudan bulut aktarımı

1. USB üzerinden 0.4.1 yükle; erase seçme.
2. Cihazı internet erişimi olan kişisel 2,4 GHz Wi-Fi ağına bağla. BOOT'a uzun basıp IP'yi gör.
3. Özel kurulum bağlantısında Bağlantı → Cihazı eşleştir; admin ve cihaz koduyla yerel sayfayı aç.
4. Cihaz sayfasındaki sunucu kontrolü erişim kodunu kaydeder. Pages ana sayfasına dön.
5. Fotoğrafı seç; sunucu hazır cevabı seçer, cihaz doğrudan HTTPS üzerinden indirir. Ekran yenileme onayı gelmeden site başarı göstermez.
6. Tek basış ileri, çift basış geri. 3 saniye basılı tutma bağlantı bilgileri.

Cihaz 4 saniyede bir HTTPS kontrolü yapar. TLS sertifikası kamuya açık GTS ve ISRG kökleriyle, saat NTP ile doğrulanır; güvensiz TLS modu yoktur. Ağ işlemi ayrı FreeRTOS task'inde çalışır. Ekran ana task'ten güncellenir. Tam metnin bayt sayısı ve SHA-256 doğrulanır. Ekran sürücüsü sağlıklı olmadan sunucuya onay gitmez. Fiziksel uçtan uca test henüz yapılmadı.

Yeni cevap önceki ekrandaki cevabın yerine geçer; önceki cevap sitedeki Son çalışmalar bölümünden seçilip Cihaza yeniden gönder ile tekrar açılır. Tek fotoğraftaki bütün sorular sıralı metinde kalır. 65.536 UTF-8 bayt üzerindeki cevap kesilmez, hata döner.

## Ders profili ve Almanca cevaplar

Hem Pages arayüzünde hem cihazın fotoğraf sayfasında ders ve bilinen cevap kuralları alanı vardır. Varsayılan Makroökonomie; başka ders yazılabilir, alan boşsa görevden anlaşılması istenir. Cevaplar her zaman Almanca, açık ve akademik öğrenci diliyle üretilir. Profil bu sekmenin sessionStorage alanında tutulur ve her fotoğraf isteğinde X-Study-Profile başlığıyla UTF-8 JSON'un base64 kodlaması olarak gönderilir. Ders en fazla 120, kurallar 1000 karakterdir. Sunucu CORS bu başlığa izin verir. Eski kamera istemcileri profil göndermiyorsa Makroökonomie varsayılır.

Sorudaki operator, alt görev, verilen puan/kelime sınırı, hesap adımları, birim ve yorumlama dikkate alınması istenir. Gerçek sınav kuralları bilinmediğinde uydurulmaz; bu alana kullanıcı tarafından girilmelidir. Grafik isteyen görevde metin açıklaması çizimin yerini tutmaz. Bir 1,0 notu veya her cevabın doğruluğu garanti edilemez. Profil veya talimat değişirse aynı fotoğraf için eski sonuç tekrar kullanılmaz. Bu değişiklikler gerçek modelle henüz değerlendirilmedi.

Profil arayüzü için Pages'i tekrar yayınla; cihaz sayfası için 0.4.1 firmware yükle. Backend de aynı revizyona güncellenmelidir.

Cevaplar “Aufgabe 1)”, “Aufgabe 2)” başlıkları ve boş satırla ayrılır. Görseldeki numaralar ve alt maddeler korunur; numara yoksa kendi sıralaması olduğunu belirtir.


0.4.1 düzeltmesi: Cihazın yerel /camera sayfasındaki eşleştirme yalnızca CSRF korumalı /api/cloud POST yapar. İnternetsiz NotEkran kurulum ağında önce sunucu/model kontrolü yapılmaz. Kayıt başarılıysa eşleştirme tamamlandı mesajı gösterilir; ağ hatasında kaydedildi denmez. İlk fotoğraf ve gerçek model kontrolü HTTPS ana sitede internet bağlantısıyla yapılır. Telefon kendi internetini paylaşırken cihaz ayarları iPad üzerinden yapılabilir.
