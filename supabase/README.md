# Not Kamera sunucu kodu

## 0.10.1

Fotoğraf yüklemesindeki veritabanı hatası, çalışma bağlamı temizleme sorgusundan kaynaklanıyordu. Sıfırlama artık yalnızca ilgili çalışma oturumunun sayfalarını temizler. Cihaza yeniden yazılım yüklemeden sunucu düzeltmesi uygulanabilir.

Matematik dönüşümü metne ve grafik etiketlerine uygulanır: y^2 → y², x^{a+b} → xᵃ⁺ᵇ, Y_{t+1} → Yₜ₊₁, x_i → xᵢ. Desteklenmeyen ifadeler korunur. Tam LaTeX, matris veya üst üste kesir gösterimi yoktur. Sunucu grafik ölçümleri cihazın aynı font verisinden üretilir.

Dağıtım kaynakları: `index.ts`, `answer.ts`, `context.ts`, `math-text.ts`, `font-metrics.ts`. Beşi birlikte yüklenir. Anahtarlar sunucuda yapılandırılır; bu depoya veya tarayıcıya eklenmez.

Test komutu: `node --test supabase/tests/*.test.mjs`. `page-context-regression.sql` testi yalnızca geçici tablolarla çalışır ve sonunda geri alınır; gerçek fotoğraf/cevap kayıtlarını değiştirmez. 1,5 MB ilk ve ikinci sayfa, yeniden deneme, yeni çalışma ve temizleme senaryoları doğrulandı. Cihaz çizim sınırları ve API teslimi de test edildi; fiziksel cihaz testi kullanıcıdaki USB yüklemesinden sonra gerekir.

## Sayfalar arası bağlam

Model yeni sayfayla birlikte en fazla altı önceki başarılı orijinal fotoğrafı görür. Yalnızca yeni sayfadaki soruları yanıtlar; bağımsız sorular eski değerleri kullanmamalıdır. Önceki çözümler yeniden girdi olarak verilmez. Bağlantıyı model değerlendirir; bu bir doğruluk garantisi değildir.

Yeni çalışma, ders profili değişikliği veya iki saatlik hareketsizlikten sonraki kabul edilen fotoğraf bağlamı yeniler. En fazla yedi orijinal fotoğraf saklanır. Hareketsizlikte temizlik sonraki kabul edilen istekte yapılır; zamanlanmış silici yoktur. İş kayıtları 24 saat sonra sonraki erişimde temizlenir. Önceki görüntüler istemciye gönderilmez. Birden fazla görüntü analiz maliyetini ve gecikmeyi artırabilir.
