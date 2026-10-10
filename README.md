# Not Kamera

iPhone Safari için fotoğraf analizi ve sesli okuma arayüzü. GitHub Pages arayüzü + ayrı Python API sunucusu.

## Durum

- Kaynak kodu haydarsahin0/not-kamera deposundadır; canlı API sunucusu henüz kurulmadı. GitHub Pages yayını kullanıcı tarafından başlatılacaktır.
- OpenAI API anahtarı ve seçtiğin görüntü destekleyen model kimliği gereklidir. API kullanımı ayrıca ücretlendirilir.
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

## V2 e-paper ekran — 0.2.0 fotoğraf köprüsü

0.1.0 firmware ile cihazda metin gönderimi kullanıcı tarafından doğrulandı. 0.2.0,
telefonun fotoğrafı sunucuya göndermesini ve yanıtı cihaza aktarmasını ekler.

1. Actions → Publish web app → Run workflow ile Pages'i güncelle.
2. Windows Chrome/Edge üzerinden [yükleyiciyi](https://haydarsahin0.github.io/not-kamera/install/) açıp 0.2.0 yükle. Mevcut Not Ekran ayarlarını korumak için “erase” seçme.
3. Cihazı internet erişimi olan 2,4 GHz Wi-Fi ağına bağla. Telefon da bu ağda olsun. BOOT'a 3 saniye basıp cihazın LAN IP adresini gör. iPhone hotspot da denenebilir, telefondan istemci IP'sine erişim ayrıca doğrulanmalıdır.
4. Safari'de cihazın **http://LAN-IP** adresini aç. Cihazın admin girişini yap, “Fotoğraf çek ve cevabı ekrana gönder”e dokun.
5. Ayrı backend'in HTTPS adresini ve **APP_TOKEN** değerini gir. **OpenAI anahtarını bu forma girme.** Sunucu OPENAI_API_KEY ve görüntü destekli OPENAI_MODEL ile yapılandırılmış olmalı.
6. Bağlantıyı kontrol et. “Fotoğraf çek veya seç” ile çekimi yapıp onayla. Otomatik analiz seçeneği açıksa fotoğraf sunucuya gönderilir, yanıt otomatik ekrana aktarılır. Çekim kamera uygulamasında kullanıcı onayı ister.
7. “Ekran yenilendi” görüldüğünde BOOT ile sayfalarda ilerle. Tam yanıt telefonda kalır; 6000 UTF-8 bayt üzeri ekranda kısaltılır.

Safari açık ve ön planda kalmalı. Telefon hem HTTPS sunucuya hem cihazın yerel IP'sine ulaşmalı. Cihazın internetsiz NotEkran ağına bağlanmak tek başına bu koşulu sağlamaz. GitHub Pages'ten yerel HTTP cihaza erişmeye çalışmak yerine, fotoğraf sayfası **cihazdan** açılır: aynı origin ile metin aktarılır, HTTPS sunucuya CORS ile bağlanılır. Sunucu varsayılan olarak özel LAN HTTP origin'lerine izin verir; kimlik doğrulama her istekte devam eder. `ALLOW_LOCAL_DEVICE_ORIGINS=0` ile bunu kapatıp tam cihaz origin'ini `ALLOWED_ORIGINS` içine yazabilirsin.

Bekleyen yanıtın kontrolü `/api/jobs/{id}` ile yalnızca kendi işini takip eder.
Bağlantı koparsa yeni analiz başlatmak yerine “Bekleyen cevabı kontrol et”e dokun.
Ekran aktarımı hata verirse “Cihaza yeniden gönder” kullanılabilir. Takibi durdurmak sunucuda başlamış API isteğini iptal etmez.

Sunucu bir OpenAI Responses isteği yapar (`store:false`); görüntü RAM'de işlenir, yanıt SQLite'ta 24 saat tutulur. Sağlayıcının API veri işleme şartları geçerlidir. Gerçek OpenAI çağrısı ve yeni akışın fiziksel Safari testi yapılmadı; canlı HTTPS sunucu ve API kimlik bilgileri henüz sağlanmadı. Donanım ayrıntıları ve derleme: [firmware rehberi](firmware/README.md).

## Ders profili ve Almanca cevaplar

Hem Pages arayüzünde hem cihazın fotoğraf sayfasında ders ve bilinen cevap kuralları alanı vardır. Varsayılan Makroökonomie; başka ders yazılabilir, alan boşsa görevden anlaşılması istenir. Cevaplar her zaman Almanca, açık ve akademik öğrenci diliyle üretilir. Profil bu sekmenin sessionStorage alanında tutulur ve her fotoğraf isteğinde X-Study-Profile başlığıyla UTF-8 JSON'un base64 kodlaması olarak gönderilir. Ders en fazla 120, kurallar 1000 karakterdir. Sunucu CORS bu başlığa izin verir. Eski kamera istemcileri profil göndermiyorsa Makroökonomie varsayılır.

Sorudaki operator, alt görev, verilen puan/kelime sınırı, hesap adımları, birim ve yorumlama dikkate alınması istenir. Gerçek sınav kuralları bilinmediğinde uydurulmaz; bu alana kullanıcı tarafından girilmelidir. Grafik isteyen görevde metin açıklaması çizimin yerini tutmaz. Bir 1,0 notu veya her cevabın doğruluğu garanti edilemez. Profil veya talimat değişirse aynı fotoğraf için eski sonuç tekrar kullanılmaz. Bu değişiklikler gerçek modelle henüz değerlendirilmedi.

Profil arayüzü için Pages'i tekrar yayınla; cihaz sayfası için 0.2.1 firmware yükle. Backend de aynı revizyona güncellenmelidir.

Cevaplar “Aufgabe 1)”, “Aufgabe 2)” başlıkları ve boş satırla ayrılır. Görseldeki numaralar ve alt maddeler korunur; numara yoksa kendi sıralaması olduğunu belirtir.
