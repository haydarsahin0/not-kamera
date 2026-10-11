#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Adafruit_GFX.h>
#include <esp_system.h>
#include "epaper_driver_bsp.h"
#include "text_layout.h"
#include "unicode_text.h"
#include "page_rotation.h"
#include "screen_visibility.h"
#include "camera_page.h"
#include "cloud_delivery.h"
#include "button_navigation.h"
#include "answer_document.h"
#include "battery_view.h"
#include "history_files.h"
#include "firmware_version.h"

// Waveshare ESP32-S3-ePaper-1.54 V2 only. GPIOs from vendor V2 examples.
constexpr int EPD_POWER=6, AUDIO_POWER=42, BATTERY_HOLD=17, BOOT_KEY=0, PWR_KEY=18;
WebServer server(80);
Preferences prefs;
epaper_driver_display *panel=nullptr;
class Canvas: public Adafruit_GFX {
 public: Canvas():Adafruit_GFX(200,200){}
 void drawPixel(int16_t x,int16_t y,uint16_t color) override {
   if(x>=0&&x<200&&y>=0&&y<200) panel->EPD_DrawColorPixel(x,y,color?0xff:0x00);
 }
} canvas;
String apName, devicePassword, csrf, savedSsid, savedPassword;
NoteAnswer::Document document;
size_t currentPage=0;
int fontSize=2;
bool helpVisible=true, dirty=true, connectPending=false;
uint32_t lastPaint=0, receivedAt=0, lastRetry=0;
int previousStatus=-1;
uint32_t textRevision=0, renderedRevision=0, paintedReaderRevision=0,lastSaveRetry=0;
size_t paintedReaderPage=0;
String activeDelivery;
HistoryFiles historyFiles;NoteHistory::Reader history(historyFiles);
bool historyReady=false;String historyError;std::string visibleKey;
ButtonNavigation navigation;
PageRotation rotation;
ScreenVisibility visibility;
ScreenPowerButton powerButton;
bool displayRailOn=true;
PhotoRequest *uploadPhoto=nullptr;String uploadError;bool uploadReserved=false;
uint32_t shownPhotoRevision=0;bool showPhotoProgress=false;
constexpr int BATTERY_ADC=4; // V2 ADC1 channel 3, calibrated 1:2 divider.
int batteryMv=0,standbyPercent=-2;
uint32_t lastBatterySample=0,lastStandbyPaint=0;
void sampleBattery(){
 uint32_t samples[24];for(auto &v:samples)v=analogReadMilliVolts(BATTERY_ADC);
 std::sort(samples,samples+24);uint32_t sum=0;for(int i=6;i<18;++i)sum+=samples[i];batteryMv=int((sum*2+6)/12);lastBatterySample=millis();
}

String randomCode(){char b[17];snprintf(b,sizeof(b),"%08lx%08lx",(unsigned long)esp_random(),(unsigned long)esp_random());return String(b);}
String htmlEscape(String s){s.replace("&","&amp;");s.replace("<","&lt;");s.replace(">","&gt;");s.replace("\"","&quot;");s.replace("'","&#39;");return s;}
size_t rowsPerPage(){return 160/NoteText::font(fontSize).lineHeight;}
size_t pageCount(){return max((size_t)1,document.pages.size());}
bool authorized(){
 if(server.authenticate("admin",devicePassword.c_str()))return true;
 server.requestAuthentication(BASIC_AUTH,"Not Ekran","Ekrandaki kodla giris yap.");return false;
}
bool mutationAllowed(){
 if(!authorized())return false;
 if(server.arg("csrf")!=csrf){server.send(403,"text/plain; charset=utf-8","Oturum yenilendi. Ana sayfayi tekrar ac.");return false;}
 return true;
}
void redirect(){server.sendHeader("Location","/");server.send(303,"text/plain","");}
String formStart(const char* action){return String("<form method='post' action='")+action+"'><input type='hidden' name='csrf' value='"+csrf+"'>";}
void root(){
 if(!authorized())return;
 String h=R"HTML(<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not Ekran</title><style>
 body{font:17px system-ui;background:#f0f4f8;color:#173044;max-width:620px;margin:auto;padding:22px}h1{margin-bottom:6px}section{background:white;border-radius:18px;padding:20px;margin:18px 0}label{display:block;margin:12px 0}input,textarea,select,button{font:inherit;box-sizing:border-box;width:100%;padding:12px;border:1px solid #b9cbd6;border-radius:9px}textarea{min-height:170px}button{background:#185ed2;color:white;border:0;margin:8px 0;cursor:pointer}small{display:block;line-height:1.5;color:#526b7c}.buttons{display:flex;gap:8px}.buttons form{flex:1}code{overflow-wrap:anywhere}a{color:#185ed2}</style><h1>Not Ekran</h1><small>V2 · __FIRMWARE_VERSION__ · Metin ve fotoğraf</small><section><strong>Bağlantı</strong><p>)HTML";
 h+=WiFi.status()==WL_CONNECTED?"Wi-Fi bağlı. Yerel adres: <code>http://"+WiFi.localIP().toString()+"</code>":"Wi-Fi bağlı değil. Cihazın kendi ağı üzerinden kullanabilirsin.";
 if(!panel->healthy)h+="<p><strong>Ekran yanıt vermedi. Kurulumu durdur; V2 kartı ve bağlantıyı kontrol et.</strong></p>";
 h+="</p><small>Kurulum ağı: "+htmlEscape(apName)+" · http://192.168.4.1<br>Sayfa "+String(currentPage+1)+" / "+String(pageCount());
 if(receivedAt)h+=" · Son metin "+String((millis()-receivedAt)/1000)+" saniye önce alındı";
 h+="<br>Bulut: "+htmlEscape(cloudGetError());
 h+="</small></section><section><h2>Fotoğraftan açıklama</h2><p><a href='/camera'>Fotoğraf çek ve cevabı ekrana gönder →</a></p><small>Fotoğrafı bu cihaz sayfasından yükle. Cihaz internet geldiğinde gönderir ve cevabı ekranda gösterir. OpenAI anahtarı Supabase’de kalır.</small></section><section><h2>Metin gönder</h2>"+formStart("/text");
 h+=R"HTML(<label>Metin<textarea name="text" maxlength="65536" required placeholder="Merhaba"></textarea></label><label>Yazı boyutu<select name="size"><option value="2">Standart · 18 px</option><option value="1">Orta · 16 px</option></select></label><button>Metni ekrana gönder</button><small>En fazla 65536 UTF-8 bayt. Uzun metin sayfalara ayrılır. Türkçe/Almanca harfler ve yaygın matematik simgeleri korunur. Nadir desteklenmeyen karakterler ? yerine [U+XXXX] koduyla belirtilir. Sayfalar 30 saniyede otomatik ilerler; son sayfadan ilk sayfaya döner. Butonla geçişte süre yeniden başlar. Metin sayfalara ayrılır; hiçbir bölüm kısaltılmaz. Son 12 cevap ve her cevabın son kaydedilmiş sayfası cihazda saklanır. Yeniden açılınca internet beklemeden okuma devam eder.</small></form><div class="buttons">)HTML";
 h+=formStart("/previous")+"<button>Önceki</button></form>"+formStart("/next")+"<button>Sonraki</button></form></div>";
 h+=formStart("/display")+"<button>"+(visibility.hidden()?String("Ekranı aç; kaldığın sayfaya dön"):String("Pil ekranına geç; sayfayı koru"))+"</button></form>";
 h+=formStart("/help")+"<button>Bağlantı bilgilerini göster</button></form>"+formStart("/read")+"<button>Metne dön</button></form>"+formStart("/clear")+"<button>Bu cevabı geçmişten sil</button></form></section>";
 h+="<section><h2>Cevap geçmişi</h2><small>Son 12 cevap saklanır. Yeni cevap otomatik açılır; eskilere buradan dönebilirsin.</small>";
 if(historyError.length())h+="<p>"+htmlEscape(historyError)+"</p>";
 for(auto i=history.entries().rbegin();i!=history.entries().rend();++i){
  h+=formStart("/history/select")+"<input type='hidden' name='key' value='"+String(i->key.c_str())+"'><button>"+htmlEscape(String(i->title.c_str()))+" · "+String(i->page+1)+"/"+String(i->pages)+(i->key==visibleKey?" · açık":"")+"</button></form>";
 }
 h+="</section>";
 h+="<section><h2>Wi-Fi ayarı</h2>"+formStart("/wifi");
 h+="<label>Ağ adı<input name='ssid' maxlength='32' required value='"+htmlEscape(savedSsid)+"' autocomplete='off'></label>";
 h+=R"HTML(<label>Ağ şifresi<input name="password" type="password" minlength="8" maxlength="63" required autocomplete="new-password"></label><button>Kaydet ve bağlan</button><small>2,4 GHz, kişisel şifreli ağ kullan. iPhone erişim noktasında gerekirse “Uyumluluğu En Üst Düzeye Çıkar” seçeneğini aç. eduroam ve giriş sayfalı ağlar bu sürümde desteklenmez. Şifre yanlışsa cihazın kendi ağı açık kalır. Bağlanmayı denedikten sonra bu sayfayı yenile.</small></form></section><small>BOOT: tek basış sonraki, çift basış önceki sayfa; 3 saniye basılı tut: bağlantı bilgileri. PWR kısa basış: pil ekranı/okuma; aynı sayfa korunur. USB'yi takarken BOOT'a basılı tutma; bu yükleme moduna geçirir. Yalnızca güvendiğin yerel ağda kullan; bu HTTP arayüzünü internete açma.</small></html>)HTML";
 server.sendHeader("Cache-Control","no-store");server.sendHeader("X-Frame-Options","DENY");
 h.replace("__FIRMWARE_VERSION__",FIRMWARE_VERSION);server.send(200,"text/html; charset=utf-8",h);
}
void savePaintedPosition(){
 lastSaveRetry=millis();
 if(historyReady&&history.checkpoint(visibleKey,currentPage,true)){
  historyError="";renderedRevision=textRevision;
  if(activeDelivery.length()){cloudRendered(activeDelivery,pageCount());photoRendered();}
 }else historyError="Okuma konumu kaydedilemedi; teslimat onaylanmadı.";
}
void paint(){
 const ScreenFrame frame=visibility.frame(dirty);
 if(frame==ScreenFrame::None)return;
 if(!displayRailOn){digitalWrite(EPD_POWER,LOW);displayRailOn=true;delay(100);}
 if(frame==ScreenFrame::Standby){
  panel->EPD_Clear();
  sampleBattery();NoteBattery::draw(canvas,batteryMv);
  if(panel->healthy){panel->EPD_Init();if(panel->healthy)panel->EPD_Display();}
  // Never acknowledge the standby picture as a rendered answer.
  if(panel->healthy){digitalWrite(EPD_POWER,HIGH);displayRailOn=false;visibility.painted(frame);}
  dirty=false;lastPaint=millis();lastStandbyPaint=lastPaint;standbyPercent=NoteBattery::percent(batteryMv);rotation.pause();return;
 }
 panel->EPD_Clear();canvas.setTextColor(0);canvas.setTextWrap(false);canvas.setTextSize(1);canvas.setCursor(4,3);
 if(showPhotoProgress){
  canvas.println("FOTOGRAF / NOT EKRAN");
  xSemaphoreTake(cloudLock,portMAX_DELAY);String detail=photoDetail;xSemaphoreGive(cloudLock);
  auto progress=wrapText(normalizeText(std::string(detail.c_str())),32);
  for(size_t n=0;n<progress.size()&&n<9;++n){canvas.setCursor(4,25+n*10);canvas.println(progress[n].c_str());}
  canvas.setCursor(4,135);canvas.println("Telefon: NotEkran agindan cik");
  canvas.setCursor(4,147);canvas.println("Kisisel erisim noktasini ac");
  canvas.setCursor(4,165);canvas.println("Cihaz acik kalsin");
 }else if(helpVisible){
  canvas.println("NOT EKRAN / V2");canvas.setCursor(4,23);canvas.println("Wi-Fi agi:");canvas.setCursor(4,35);canvas.println(apName);
  canvas.setCursor(4,55);canvas.println("Ag sifresi / giris kodu:");canvas.setCursor(4,67);canvas.println(devicePassword);
  canvas.setCursor(4,87);canvas.println("Kullanici: admin");canvas.setCursor(4,105);canvas.println("http://192.168.4.1");
  canvas.setCursor(4,125);canvas.println(WiFi.status()==WL_CONNECTED?"Diger agda adres:":"Diger ag: bagli degil");
  canvas.setCursor(4,137);if(WiFi.status()==WL_CONNECTED)canvas.println(WiFi.localIP().toString());
  canvas.setCursor(4,160);canvas.println("Telefon: agi sec, Safari ac");canvas.setCursor(4,178);canvas.println("BOOT: metne don");
 } else {
  if(!document.pages.empty()){
   const auto &page=document.pages[currentPage];const auto &headerFont=NoteFont::font16;
   NoteText::draw(canvas,NoteAnswer::heading(page),4,16,headerFont);
   std::string counter=std::to_string(page.taskPage)+"/"+std::to_string(page.taskPages);
   NoteText::draw(canvas,counter,196-NoteText::width(counter,headerFont),16,headerFont);
  }
  const auto &bodyFont=NoteText::font(fontSize);
  if(!document.pages.empty()){
   const auto &page=document.pages[currentPage];
   if(page.graphic)NoteGraph::draw(canvas,page.graph);
   else for(size_t n=0;n<page.lines.size();++n)NoteText::draw(canvas,page.lines[n],4,21+bodyFont.ascent+n*bodyFont.lineHeight,bodyFont);
  }
  canvas.setTextSize(1);canvas.setCursor(4,188);canvas.print("30sn oto / 1:ileri 2:geri");
 }
 if(panel->healthy){panel->EPD_Init();if(panel->healthy)panel->EPD_Display();}
 if(panel->healthy&&!helpVisible&&!showPhotoProgress&&!document.pages.empty()){
  paintedReaderRevision=textRevision;paintedReaderPage=currentPage;savePaintedPosition();
 }
 dirty=false;lastPaint=millis();visibility.painted(frame);
 if(panel->healthy&&!helpVisible&&!showPhotoProgress&&!document.pages.empty())rotation.shown(lastPaint);else rotation.pause();
}
bool saveAnswer(const String&t,int size,bool structured,const String&delivery){
 if(!historyReady){historyError="Cevap belleği açılamadı; mevcut kayıtlar silinmedi.";return false;}
 historyError="";NoteAnswer::Document next;
 if(structured){if(!NoteAnswer::parse(std::string(t.c_str()),size,next))return false;}
 else {NoteAnswer::addText(next,std::string(t.c_str()),size);NoteAnswer::labelSection(next,0,"Not");}
 if(next.pages.empty())return false;
 std::string key=textHash(String(structured?"J":"P")+String(size)+":"+t).c_str();
 std::string title=next.pages.front().task;
 if(title=="Not"&&!next.pages.front().lines.empty())title=next.pages.front().lines.front();
 if(title.size()>160){size_t cut=0;while(cut<title.size()){size_t n=cut;NoteText::decode(title,n);if(n>157)break;cut=n;}title=title.substr(0,cut)+"…";}
 if(!history.add(key,{std::string(t.c_str()),size,structured},title,std::string(delivery.c_str()),next.pages.size())){historyError="Cevap kaydedilemedi; önceki cevap korunuyor.";return false;}
 visibleKey=key;fontSize=size;document=std::move(next);currentPage=std::min(history.current()->page,pageCount()-1);
 rotation.pause();activeDelivery=delivery;showPhotoProgress=false;helpVisible=false;dirty=true;receivedAt=millis();++textRevision;historyError="";return true;
}
bool acceptText(const String&t,const String&size){
 if(!t.length()||t.length()>65536||(size!="1"&&size!="2"))return false;
 return saveAnswer(t,size.toInt(),false,"");
}
bool acceptAnswer(const String&t,const String&delivery){return saveAnswer(t,2,true,delivery);}
bool openHistory(std::string key){
 NoteHistory::Source source;NoteAnswer::Document next;
 if(!historyReady||!history.load(key,source))return false;
 if(source.structured){if(!NoteAnswer::parse(source.text,source.size,next))return false;}
 else {NoteAnswer::addText(next,source.text,source.size);NoteAnswer::labelSection(next,0,"Not");}
 const NoteHistory::Entry*record=nullptr;for(auto&e:history.entries())if(e.key==key){record=&e;break;}
 if(!record||next.pages.empty())return false;
 size_t page=std::min(record->page,next.pages.size()-1);
 if(!history.checkpoint(key,page))return false;
 document=std::move(next);visibleKey=key;fontSize=source.size;currentPage=page;
 activeDelivery="";showPhotoProgress=false;helpVisible=false;dirty=true;rotation.pause();++textRevision;return true;
}
void setup(){
 pinMode(BATTERY_HOLD,OUTPUT);digitalWrite(BATTERY_HOLD,HIGH);
 pinMode(AUDIO_POWER,OUTPUT);digitalWrite(AUDIO_POWER,HIGH);
 pinMode(EPD_POWER,OUTPUT);digitalWrite(EPD_POWER,LOW);
 pinMode(BOOT_KEY,INPUT_PULLUP);pinMode(PWR_KEY,INPUT_PULLUP);
 powerButton.begin(digitalRead(PWR_KEY)==LOW,millis());Serial.begin(115200);
 analogReadResolution(12);analogSetPinAttenuation(BATTERY_ADC,ADC_11db);sampleBattery();
 delay(100);
 custom_lcd_spi_t pins={11,10,9,8,13,12,SPI2_HOST,5000};
 panel=new epaper_driver_display(200,200,pins);
 prefs.begin("not-ekran",false);
 historyReady=historyFiles.begin()&&history.begin();
 if(historyReady&&history.current()){
  std::string key=history.current()->key;String delivery=history.current()->delivery.c_str();
  if(openHistory(key))activeDelivery=delivery;else historyError="Son kayıt okunamadı; geçmişten başka bir cevap seçebilirsin.";
 }else if(!historyReady)historyError="Cevap belleği açılamadı; kayıtlar silinmedi.";
 cloudLock=xSemaphoreCreateMutex();cloudInbox=xQueueCreate(1,sizeof(CloudMessage*));photoInbox=xQueueCreate(1,sizeof(PhotoRequest*));
 cloudSetToken(prefs.getString("cloud-token",""));
 devicePassword=prefs.getString("code","");if(devicePassword.length()!=16){devicePassword=randomCode();prefs.putString("code",devicePassword);}
 csrf=randomCode();savedSsid=prefs.getString("ssid","");savedPassword=prefs.getString("wifi-pass","");
 uint64_t mac=ESP.getEfuseMac();char suffix[5];snprintf(suffix,sizeof(suffix),"%04X",(unsigned)(mac&0xffff));apName="NotEkran-"+String(suffix);
 WiFi.mode(WIFI_AP_STA);WiFi.setAutoReconnect(true);WiFi.softAP(apName.c_str(),devicePassword.c_str());
 if(savedSsid.length())WiFi.begin(savedSsid.c_str(),savedPassword.c_str());
 configTime(0,0,"pool.ntp.org","time.google.com");
 xTaskCreate(cloudWorker,"cloud",24576,nullptr,1,nullptr);
 const char* requestHeaders[]={"X-CSRF","X-Study-Profile","X-Study-Reset"};server.collectHeaders(requestHeaders,3);
 server.on("/",HTTP_GET,root);
 server.on("/api/cloud",HTTP_POST,[]{
  if(!mutationAllowed())return;
  String token=server.arg("token");
  if(!token.isEmpty()&&!validCloudToken(token)){server.send(400,"application/json","{\"detail\":\"Erisim kodu gecersiz.\"}");return;}
  prefs.putString("cloud-token",token);cloudSetToken(token);
  server.send(200,"application/json",String("{\"saved\":true,\"version\":\"")+FIRMWARE_VERSION+"\"}");
 });
 server.on("/camera",HTTP_GET,[]{
  if(!authorized())return;
  String h=FPSTR(CAMERA_PAGE);h.replace("__CSRF__",csrf);
  server.sendHeader("Cache-Control","no-store");server.sendHeader("X-Frame-Options","DENY");
  h.replace("__FIRMWARE_VERSION__",FIRMWARE_VERSION);server.send(200,"text/html; charset=utf-8",h);
 });

 server.on("/api/photo/status",HTTP_GET,[]{
  if(!authorized())return;
  cJSON* doc=cJSON_CreateObject();cJSON_AddStringToObject(doc,"version",FIRMWARE_VERSION);
  xSemaphoreTake(cloudLock,portMAX_DELAY);
  cJSON_AddBoolToObject(doc,"paired",cloudToken.length()>0);cJSON_AddBoolToObject(doc,"busy",photoBusy);
  cJSON_AddStringToObject(doc,"state",photoState.c_str());cJSON_AddStringToObject(doc,"detail",photoDetail.c_str());
  cJSON_AddNumberToObject(doc,"context_pages",photoContextPages);
  cJSON_AddStringToObject(doc,"cloud",cloudError.c_str());cJSON_AddStringToObject(doc,"job",photoJob.c_str());
  xSemaphoreGive(cloudLock);
  cJSON_AddBoolToObject(doc,"screen_hidden",visibility.hidden());
  int percent=NoteBattery::percent(batteryMv);if(percent<0)cJSON_AddNullToObject(doc,"battery_percent");else cJSON_AddNumberToObject(doc,"battery_percent",percent);
  cJSON_AddNumberToObject(doc,"battery_mv",batteryMv);cJSON_AddBoolToObject(doc,"battery_estimated",true);
  cJSON_AddBoolToObject(doc,"wifi",WiFi.status()==WL_CONNECTED);cJSON_AddBoolToObject(doc,"clock",time(nullptr)>=1767225600);
  cJSON_AddNumberToObject(doc,"history_count",history.entries().size());cJSON_AddStringToObject(doc,"history_error",historyError.c_str());
  cJSON_AddNumberToObject(doc,"pages",pageCount());cJSON_AddBoolToObject(doc,"healthy",panel->healthy);
  char* json=cJSON_PrintUnformatted(doc);server.sendHeader("Cache-Control","no-store");server.send(200,"application/json",json);cJSON_free(json);cJSON_Delete(doc);
 });
 server.on("/api/photo",HTTP_POST,[]{
  if(!authorized())return;
  if(server.header("X-CSRF")!=csrf){server.send(403,"application/json","{\"detail\":\"Sayfayi yenile.\"}");return;}
  if(!uploadReserved||uploadError.length()||!uploadPhoto||!uploadPhoto->image.jpeg()){
   String message=uploadError.length()?uploadError:"Fotograf eksik veya JPEG degil.";
   if(uploadPhoto){free(uploadPhoto->image.data);delete uploadPhoto;uploadPhoto=nullptr;}
   if(uploadReserved){photoFinish("error",message);uploadReserved=false;}
   cJSON* doc=cJSON_CreateObject();cJSON_AddStringToObject(doc,"detail",message.c_str());char* json=cJSON_PrintUnformatted(doc);server.send(400,"application/json",json);cJSON_free(json);cJSON_Delete(doc);return;
  }
  if(xQueueSend(photoInbox,&uploadPhoto,0)!=pdTRUE){free(uploadPhoto->image.data);delete uploadPhoto;uploadPhoto=nullptr;uploadReserved=false;photoFinish("error","Fotograf kuyrugu dolu");server.send(409,"application/json","{\"detail\":\"Fotograf kuyrugu dolu.\"}");return;}
  uploadPhoto=nullptr;uploadReserved=false;activeDelivery="";photoUpdate("waiting","Fotograf cihazda; internet bekleniyor");showPhotoProgress=true;helpVisible=false;dirty=true;
  server.send(202,"application/json","{\"queued\":true}");
 },[]{
  HTTPUpload& u=server.upload();
  if(u.status==UPLOAD_FILE_START){
   if(uploadReserved){uploadError="Tek seferde yalnizca bir fotograf gonder";return;}
   // All local headers are parsed before file bytes; no unauthorized allocation.
   if(uploadPhoto){free(uploadPhoto->image.data);delete uploadPhoto;uploadPhoto=nullptr;}
   uploadError="";uploadReserved=false;
   if(!server.authenticate("admin",devicePassword.c_str())||server.header("X-CSRF")!=csrf){uploadError="Giris veya oturum gecersiz";return;}
   xSemaphoreTake(cloudLock,portMAX_DELAY);
   if(!panel->healthy)uploadError="Ekran surucusu hata bildirdi";
   else if(photoBusy)uploadError="Once bekleyen fotografin tamamlanmasini bekle";
   else if(cloudToken.isEmpty())uploadError="Once cihazi eslestir";
   else {photoBusy=true;photoJob="";++cloudGeneration;uploadReserved=true;}
   xSemaphoreGive(cloudLock);
   if(!uploadReserved)return;
   if(u.name!="photo"||u.type!="image/jpeg"||server.header("X-Study-Profile").length()>7000){uploadError="JPEG veya ders profili gecersiz";return;}
   if(server.header("X-Study-Reset").length()&&server.header("X-Study-Reset")!="0"&&server.header("X-Study-Reset")!="1"){uploadError="Yeni calisma secenegi gecersiz";return;}
   uploadPhoto=new PhotoRequest();uploadPhoto->profile=server.header("X-Study-Profile");uploadPhoto->requestId=photoRequestId();uploadPhoto->resetContext=server.header("X-Study-Reset")=="1";
   uploadPhoto->image.data=(uint8_t*)ps_malloc(MAX_PHOTO_BYTES);uploadPhoto->image.capacity=MAX_PHOTO_BYTES;
   if(!uploadPhoto->image.data)uploadError="Fotograf icin bellek yetersiz";
  }else if(u.status==UPLOAD_FILE_WRITE){
   if(uploadPhoto&&uploadError.isEmpty()&&!uploadPhoto->image.append(u.buf,u.currentSize))uploadError="Fotograf 4 MB sinirini asti";
  }else if(u.status==UPLOAD_FILE_ABORTED){
   if(uploadPhoto){free(uploadPhoto->image.data);delete uploadPhoto;uploadPhoto=nullptr;}
   if(uploadReserved)photoFinish("error","Fotograf aktarimi kesildi");uploadReserved=false;uploadError="Fotograf aktarimi kesildi";
  }
 });

 server.on("/api/screen",HTTP_GET,[]{
  if(!authorized())return;
  server.sendHeader("Cache-Control","no-store");
  server.send(200,"application/json",String("{\"revision\":")+textRevision+",\"rendered\":"+renderedRevision+",\"pages\":"+pageCount()+",\"healthy\":"+(panel->healthy?"true":"false")+"}");
 });
 server.on("/api/text",HTTP_POST,[]{
  if(!mutationAllowed())return;
  if(!panel->healthy){server.send(503,"application/json","{\"detail\":\"Ekran surucusu hata bildirdi.\"}");return;}
  if(!acceptText(server.arg("text"),server.arg("size"))){server.send(historyError.length()?503:400,"application/json",historyError.length()?String("{\"detail\":\"Cevap belleğe kaydedilemedi.\"}"):String("{\"detail\":\"Metin veya boyut gecersiz; en fazla 65536 UTF-8 bayt.\"}"));return;}
  server.sendHeader("Cache-Control","no-store");
  server.send(202,"application/json",String("{\"accepted\":true,\"revision\":")+textRevision+"}");
 });
 server.on("/text",HTTP_POST,[]{
  if(!mutationAllowed())return;
  if(!acceptText(server.arg("text"),server.arg("size"))){server.send(historyError.length()?503:400,"text/plain; charset=utf-8",historyError.length()?historyError:String("Metin veya boyut gecersiz; en fazla 65536 UTF-8 bayt."));return;}
  redirect();
 });
 server.on("/wifi",HTTP_POST,[]{
  if(!mutationAllowed())return;String s=server.arg("ssid"),p=server.arg("password");
  if(s.length()==0||s.length()>32||p.length()<8||p.length()>63){server.send(400,"text/plain","Ag adi veya sifre uzunlugu gecersiz.");return;}
  savedSsid=s;savedPassword=p;prefs.putString("ssid",s);prefs.putString("wifi-pass",p);connectPending=true;redirect();
 });
 server.on("/display",HTTP_POST,[]{if(!mutationAllowed())return;visibility.toggle();rotation.pause();navigation=ButtonNavigation();dirty=true;redirect();});
 server.on("/next",HTTP_POST,[]{if(!mutationAllowed())return;if(visibility.hidden()){server.send(409,"text/plain; charset=utf-8","Önce ekranı aç.");return;}currentPage=(currentPage+1)%pageCount();helpVisible=false;dirty=true;redirect();});
 server.on("/previous",HTTP_POST,[]{if(!mutationAllowed())return;if(visibility.hidden()){server.send(409,"text/plain; charset=utf-8","Önce ekranı aç.");return;}currentPage=(currentPage+pageCount()-1)%pageCount();helpVisible=false;dirty=true;redirect();});
 server.on("/help",HTTP_POST,[]{if(!mutationAllowed())return;helpVisible=true;dirty=true;redirect();});
 server.on("/read",HTTP_POST,[]{if(!mutationAllowed())return;helpVisible=false;dirty=true;redirect();});
 server.on("/history/select",HTTP_POST,[]{
  if(!mutationAllowed())return;
  if(visibility.hidden()){server.send(409,"text/plain; charset=utf-8","Önce ekranı aç.");return;}
  if(!openHistory(server.arg("key").c_str())){server.send(503,"text/plain; charset=utf-8","Kayıt açılamadı; mevcut cevap korunuyor.");return;}redirect();
 });
 server.on("/clear",HTTP_POST,[]{
  if(!mutationAllowed())return;
  if(!historyReady||(!visibleKey.empty()&&!history.erase(visibleKey))){server.send(503,"text/plain; charset=utf-8","Kayıt silinemedi.");return;}
  document.pages.clear();visibleKey="";activeDelivery="";currentPage=0;receivedAt=0;++textRevision;helpVisible=false;showPhotoProgress=false;dirty=true;rotation.pause();
  if(history.current())openHistory(history.current()->key);redirect();
 });
 server.onNotFound([]{server.send(404,"text/plain","Not found");});
 server.begin();paint();
}
void loop(){
 server.handleClient();
 if(uint32_t(millis()-lastBatterySample)>=5000)sampleBattery();
 if(visibility.hidden()&&uint32_t(millis()-lastStandbyPaint)>=60000){
  int percent=NoteBattery::percent(batteryMv);
  if((percent<0)!=(standbyPercent<0)||std::abs(percent-standbyPercent)>=2)visibility.refreshStandby();
 }
 if(powerButton.update(digitalRead(PWR_KEY)==LOW,millis())){
  visibility.toggle();rotation.pause();navigation=ButtonNavigation();dirty=true;
 }
 if(connectPending){connectPending=false;WiFi.disconnect(false,false);WiFi.begin(savedSsid.c_str(),savedPassword.c_str());lastRetry=millis();}
 xSemaphoreTake(cloudLock,portMAX_DELAY);uint32_t revision=photoRevision;String state=photoState;xSemaphoreGive(cloudLock);
 if(revision!=shownPhotoRevision){shownPhotoRevision=revision;if(showPhotoProgress){if(state=="rendered")showPhotoProgress=false;dirty=true;}}
 int status=WiFi.status();if(status!=previousStatus){previousStatus=status;if(helpVisible)dirty=true;}
 if(savedSsid.length()&&status!=WL_CONNECTED&&millis()-lastRetry>30000){WiFi.reconnect();lastRetry=millis();}
 CloudMessage *message=nullptr;
 if(visibility.canReceiveAnswer()&&xQueueReceive(cloudInbox,&message,0)==pdTRUE){
  xSemaphoreTake(cloudLock,portMAX_DELAY);bool current=message->generation==cloudGeneration;xSemaphoreGive(cloudLock);
  if(current){
   const auto known=history.delivered(std::string(message->id.c_str()));
   if(known){cloudRendered(message->id,known->pages);photoRendered();}
   else if(!acceptAnswer(message->text,message->id)){
    String detail=historyError.length()?historyError:String("Cevap/grafik ekrana sığmıyor; daha küçük bölümlere ayır.");
    photoFinish("error",detail);cloudSetError(detail+" Teslimat onaylanmadı.");
   }
  }
  delete message;
 }
 if(visibility.hidden())navigation=ButtonNavigation();
 else switch(navigation.update(digitalRead(BOOT_KEY)==LOW,millis())){
  case NavEvent::Info:helpVisible=true;dirty=true;break;
  case NavEvent::Next:if(helpVisible)helpVisible=false;else currentPage=(currentPage+1)%pageCount();dirty=true;break;
  case NavEvent::Previous:if(helpVisible)helpVisible=false;else currentPage=(currentPage+pageCount()-1)%pageCount();dirty=true;break;
  default:break;
 }
 // Retry a failed checkpoint without repainting or requiring a button press.
 // Only save the exact reader frame already shown successfully on the panel.
 if(historyReady&&panel->healthy&&!dirty&&!visibility.hidden()&&!helpVisible&&!showPhotoProgress&&
    paintedReaderRevision==textRevision&&paintedReaderPage==currentPage&&historyError.length()&&uint32_t(millis()-lastSaveRetry)>=5000)savePaintedPosition();
 if(rotation.due(millis(),!visibility.hidden()&&!helpVisible&&!showPhotoProgress&&panel->healthy&&!document.pages.empty(),pageCount(),dirty||navigation.waiting()||powerButton.waiting())){
  currentPage=(currentPage+1)%pageCount();dirty=true;
 }
 if(panel->healthy&&visibility.frame(dirty)!=ScreenFrame::None&&!navigation.waiting()&&!powerButton.waiting()&&millis()-lastPaint>=3000)paint();
 delay(2);
}
