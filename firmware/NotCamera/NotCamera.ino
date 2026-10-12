// XIAO ESP32-S3 Sense, OV2640/OV3660. No OpenAI secret in this firmware.
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <NetworkClientSecure.h>
#include <HTTPClient.h>
#include <esp_camera.h>
#include <jpeg_decoder.h>
#include <esp_heap_caps.h>
#include <esp_system.h>
#include <cJSON.h>
#include <mbedtls/base64.h>
#include <time.h>
#include "capture_policy.h"
#include "cloud_roots.h"
#include "setup_page.h"

constexpr char CAMERA_VERSION[]="0.1.5";
constexpr char API[]="https://jckoovsocynnxbrsalld.supabase.co/functions/v1/not-kamera-api";
constexpr size_t MAX_JPEG=1024*1024,MAX_REPLY=160*1024;
Preferences prefs;WebServer web(80);SemaphoreHandle_t mutex;
String apName,deviceCode,csrf,phase="starting",detail="Kamera hazırlanıyor",currentJob,deliveryId;
String networkIp;NoteCapture::Frame latestMetrics;bool cameraReady=false,hasPending=false,enabled=true;
uint8_t* latestImage=nullptr;size_t latestLength=0;unsigned frameId=0;unsigned sent=0,rendered=0,retries=0;
uint32_t rebootAt=0;bool rebootRequested=false,clearRequested=false,testRequested=false,sensorActive=false,cameraFault=false;
String cameraError;
// Last station disconnect reason (wifi_err_reason_t), 0 after an address is obtained; shown on the USB page.
volatile int wifiReason=0;volatile bool wifiScanning=false;
// Hotspot names are typed by hand ("Haydar iPhone'u") but broadcast with typographic apostrophes, other
// spacing or case ("Haydar iPhone’u"). Compare names without quotes, spaces, punctuation and case.
String looseName(String v){v.replace("\xE2\x80\x99","");v.replace("\xE2\x80\x98","");String out;
 for(size_t i=0;i<v.length();++i){unsigned char ch=v[i];if(ch>=0x80||isalnum(ch))out+=char(ch>=0x80?ch:tolower(ch));}return out;}
String visibleNetworks="[]";int visibleCount=-1;SemaphoreHandle_t scanLock;
struct Settings {String ssid,password,token,course="Makroökonomie",rules;NoteCapture::Limits limits;bool automatic=false;};
Settings settings;NoteCapture::Policy policy;

void* externalAlloc(size_t n){void* p=heap_caps_malloc(n,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);return p?p:heap_caps_malloc(n,MALLOC_CAP_8BIT);}
void externalFree(void* p){heap_caps_free(p);}
String serialize(cJSON* j){char* p=cJSON_PrintUnformatted(j);String s=p?p:"{}";cJSON_free(p);return s;}
String field(cJSON* j,const char* key){auto p=cJSON_GetObjectItemCaseSensitive(j,key);return cJSON_IsString(p)&&p->valuestring?String(p->valuestring):String();}
String uuid(){uint8_t b[16];esp_fill_random(b,16);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;char s[37];snprintf(s,sizeof(s),"%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7],b[8],b[9],b[10],b[11],b[12],b[13],b[14],b[15]);return s;}
bool validToken(const String& s){if(s.length()<32||s.length()>256)return false;for(char c:s)if(!isalnum((unsigned char)c)&&c!='-'&&c!='_')return false;return true;}
void status(const String& state,const String& message){xSemaphoreTake(mutex,portMAX_DELAY);phase=state;detail=message;xSemaphoreGive(mutex);}
Settings config(){xSemaphoreTake(mutex,portMAX_DELAY);Settings c=settings;xSemaphoreGive(mutex);return c;}
void cacheImage(camera_fb_t* fb,const NoteCapture::Frame& f){
 if(!fb||fb->len>MAX_JPEG)return;auto p=(uint8_t*)externalAlloc(fb->len);if(!p)return;memcpy(p,fb->buf,fb->len);
 xSemaphoreTake(mutex,portMAX_DELAY);externalFree(latestImage);latestImage=p;latestLength=fb->len;latestMetrics=f;++frameId;xSemaphoreGive(mutex);
}
NoteCapture::Frame measure(camera_fb_t* fb){
 NoteCapture::Frame frame;if(!fb||fb->format!=PIXFORMAT_JPEG)return frame;
 esp_jpeg_image_cfg_t c={};c.indata=fb->buf;c.indata_size=fb->len;c.out_format=JPEG_IMAGE_FORMAT_RGB888;c.out_scale=JPEG_IMAGE_SCALE_1_8;
 esp_jpeg_image_output_t out={};
 if(esp_jpeg_get_image_info(&c,&out)!=ESP_OK||out.output_len>160000||out.width<36||out.height<28)return frame;
 c.outbuf=(uint8_t*)externalAlloc(out.output_len);c.outbuf_size=out.output_len;
 auto gray=(uint8_t*)externalAlloc(size_t(out.width)*out.height);
 if(c.outbuf&&gray&&esp_jpeg_decode(&c,&out)==ESP_OK){
  for(size_t i=0;i<size_t(out.width)*out.height;++i){auto p=c.outbuf+3*i;gray[i]=(77*p[0]+150*p[1]+29*p[2])>>8;}
  frame=NoteCapture::inspect(gray,out.width,out.height);
 }externalFree(c.outbuf);externalFree(gray);return frame;
}
bool initCamera(){
 camera_config_t c={};c.ledc_channel=LEDC_CHANNEL_0;c.ledc_timer=LEDC_TIMER_0;
 c.pin_pwdn=-1;c.pin_reset=-1;c.pin_xclk=10;c.pin_sccb_sda=40;c.pin_sccb_scl=39;
 c.pin_d0=15;c.pin_d1=17;c.pin_d2=18;c.pin_d3=16;c.pin_d4=14;c.pin_d5=12;c.pin_d6=11;c.pin_d7=48;
 c.pin_vsync=38;c.pin_href=47;c.pin_pclk=13;c.xclk_freq_hz=20000000;
 c.pixel_format=PIXFORMAT_JPEG;c.frame_size=FRAMESIZE_UXGA;c.jpeg_quality=10;c.fb_count=1;
 c.fb_location=CAMERA_FB_IN_PSRAM;c.grab_mode=CAMERA_GRAB_WHEN_EMPTY;
 if(!psramFound()){status("camera_error","PSRAM bulunamadı. Kart/derleme ayarlarını kontrol et.");return false;}
 esp_err_t result=esp_camera_init(&c);
 if(result!=ESP_OK){status("camera_error",String("Kamera başlatılamadı: ")+esp_err_to_name(result)+". Gücü çıkarıp Sense modülünü kontrol et.");return false;}
 auto sensor=esp_camera_sensor_get();if(!sensor){esp_camera_deinit();status("camera_error","Sensör bulunamadı.");return false;}
 sensor->set_framesize(sensor,FRAMESIZE_UXGA);sensor->set_quality(sensor,10);
 return true;
}

// Worker exclusively owns the sensor. Stop camera clock/DMA between capture windows.
// This reduces active work; it is not a temperature sensor or a hardware power cutoff.
struct CameraWindow {
 bool ok;
 CameraWindow():ok(initCamera()){
  xSemaphoreTake(mutex,portMAX_DELAY);cameraReady=ok;sensorActive=ok;
  if(!ok){cameraFault=true;cameraError=detail;}xSemaphoreGive(mutex);
 }
 ~CameraWindow(){if(ok)esp_camera_deinit();xSemaphoreTake(mutex,portMAX_DELAY);sensorActive=false;xSemaphoreGive(mutex);}
};
bool requestTest(){xSemaphoreTake(mutex,portMAX_DELAY);bool ok=!hasPending&&!sensorActive&&!testRequested;
 if(ok){testRequested=true;cameraFault=false;}xSemaphoreGive(mutex);return ok;}

// Bound even a chunked API response; no model answer is sent to Serial or UI.
class ReplyStream:public Stream {
 uint8_t* bytes=nullptr;size_t length=0;bool overflow=false;
 public:
 ReplyStream(){bytes=(uint8_t*)externalAlloc(MAX_REPLY+1);}
 ~ReplyStream(){externalFree(bytes);}
 size_t write(uint8_t b)override{return write(&b,1);}
 size_t write(const uint8_t* p,size_t n)override{if(!bytes||length+n>MAX_REPLY){overflow=true;return 0;}memcpy(bytes+length,p,n);length+=n;return n;}
 int available()override{return 0;}int read()override{return -1;}int peek()override{return -1;}void flush()override{}
 cJSON* parse(){if(!bytes||overflow)return nullptr;bytes[length]=0;return cJSON_ParseWithLength((char*)bytes,length+1);}
};
struct ApiReply {int code=-1;cJSON* data=nullptr;~ApiReply(){cJSON_Delete(data);}ApiReply()=default;ApiReply(const ApiReply&)=delete;};
String profileHeader(const Settings& s){
 cJSON* p=cJSON_CreateObject();cJSON_AddStringToObject(p,"course",s.course.c_str());cJSON_AddStringToObject(p,"rules",s.rules.c_str());String json=serialize(p);cJSON_Delete(p);
 size_t needed=4*((json.length()+2)/3)+1;auto buf=(unsigned char*)externalAlloc(needed);if(!buf)return "";size_t written=0;
 int e=mbedtls_base64_encode(buf,needed,&written,(const unsigned char*)json.c_str(),json.length());String result=e?String():String((char*)buf,written);externalFree(buf);return result;
}
void apiRequest(ApiReply& reply,const Settings& s,const String& path,uint8_t* jpeg=nullptr,size_t length=0,const String& requestId=""){
 if(WiFi.status()!=WL_CONNECTED||time(nullptr)<1767225600)return;
 NetworkClientSecure tls;tls.setCACert(CLOUD_ROOTS);tls.setHandshakeTimeout(15);
 HTTPClient http;http.setConnectTimeout(12000);http.setTimeout(25000);http.setReuse(false);
 if(!http.begin(tls,String(API)+path))return;http.addHeader("Authorization","Bearer "+s.token);
 if(jpeg){String profile=profileHeader(s);if(profile.isEmpty()){http.end();return;}
  http.addHeader("Content-Type","image/jpeg");http.addHeader("X-Study-Profile",profile);http.addHeader("X-Request-Id",requestId);http.addHeader("X-Study-Reset","0");reply.code=http.POST(jpeg,length);
 }else reply.code=http.GET();
 if(reply.code>0){ReplyStream output;http.writeToStream(&output);reply.data=output.parse();}http.end();
}

void saveRecent(){
 // Only committed/delivered signatures are durable. No photo or cloud answer in NVS.
 xSemaphoreTake(mutex,portMAX_DELAY);prefs.putBytes("recent",&policy.recent,sizeof(policy.recent));xSemaphoreGive(mutex);
}
String snapshot(bool usb=false){
 cJSON* j=cJSON_CreateObject();xSemaphoreTake(mutex,portMAX_DELAY);
 cJSON_AddStringToObject(j,"device","NotCamera");cJSON_AddStringToObject(j,"version",CAMERA_VERSION);
 cJSON_AddStringToObject(j,"phase",phase.c_str());cJSON_AddStringToObject(j,"detail",detail.c_str());
 cJSON_AddBoolToObject(j,"sensor_active",sensorActive);cJSON_AddStringToObject(j,"camera_error",cameraError.c_str());
 cJSON_AddBoolToObject(j,"camera_ready",cameraReady);cJSON_AddBoolToObject(j,"configured",!settings.ssid.isEmpty()&&validToken(settings.token));
 cJSON_AddBoolToObject(j,"automatic",settings.automatic);cJSON_AddBoolToObject(j,"busy",hasPending);
 cJSON_AddStringToObject(j,"ssid",settings.ssid.c_str());cJSON_AddStringToObject(j,"ip",networkIp.c_str());
 cJSON_AddStringToObject(j,"course",settings.course.c_str());cJSON_AddStringToObject(j,"rules",settings.rules.c_str());
 cJSON_AddNumberToObject(j,"interval",settings.limits.interval/1000);cJSON_AddNumberToObject(j,"edge_min",settings.limits.edgeMin);cJSON_AddNumberToObject(j,"duplicate_max",settings.limits.duplicateMax);
 cJSON_AddNumberToObject(j,"mean",latestMetrics.mean);cJSON_AddNumberToObject(j,"light",latestMetrics.light);cJSON_AddNumberToObject(j,"ink",latestMetrics.ink);cJSON_AddNumberToObject(j,"edge",latestMetrics.edge);cJSON_AddNumberToObject(j,"spread",latestMetrics.spread);cJSON_AddNumberToObject(j,"frame",frameId);
 cJSON_AddNumberToObject(j,"sent",sent);cJSON_AddNumberToObject(j,"rendered",rendered);cJSON_AddNumberToObject(j,"retries",retries);
 if(usb){cJSON_AddStringToObject(j,"ap",apName.c_str());cJSON_AddStringToObject(j,"code",deviceCode.c_str());}
 xSemaphoreGive(mutex);cJSON_AddBoolToObject(j,"wifi",WiFi.status()==WL_CONNECTED);cJSON_AddNumberToObject(j,"wifi_reason",wifiReason);xSemaphoreTake(mutex,portMAX_DELAY);cJSON_AddItemToObject(j,"networks",cJSON_Parse(visibleNetworks.c_str()));cJSON_AddNumberToObject(j,"networks_seen",visibleCount);xSemaphoreGive(mutex);String s=serialize(j);cJSON_Delete(j);return s;
}
bool configure(cJSON* j,String& error){
 Settings old=config(),c; c.ssid=field(j,"ssid");c.password=field(j,"password");c.token=field(j,"token");c.course=field(j,"course");c.rules=field(j,"rules");
 if(c.password.isEmpty()&&looseName(c.ssid)==looseName(old.ssid))c.password=old.password;
 if(c.token.isEmpty())c.token=old.token;
 auto number=cJSON_GetObjectItemCaseSensitive(j,"interval");if(cJSON_IsNumber(number)){
  double seconds=number->valuedouble;
  if(!std::isfinite(seconds)||seconds<5||seconds>120||std::floor(seconds)!=seconds){error="Çekim aralığı 5–120 saniye olmalı.";return false;}
  c.limits.interval=uint32_t(seconds)*1000;
 }
 number=cJSON_GetObjectItemCaseSensitive(j,"edge_min");if(cJSON_IsNumber(number))c.limits.edgeMin=number->valuedouble;
 number=cJSON_GetObjectItemCaseSensitive(j,"duplicate_max");if(cJSON_IsNumber(number))c.limits.duplicateMax=number->valuedouble;
 auto automatic=cJSON_GetObjectItemCaseSensitive(j,"automatic");c.automatic=cJSON_IsTrue(automatic);
 if(c.ssid.isEmpty()||c.ssid.length()>32||c.password.length()<8||c.password.length()>63||!validToken(c.token)||c.course.length()>120||c.rules.length()>1000||c.limits.interval<5000||c.limits.interval>120000||c.limits.edgeMin<.5||c.limits.edgeMin>30||c.limits.duplicateMax<1||c.limits.duplicateMax>25){error="Ağ, erişim kodu veya ayar biçimi geçersiz.";return false;}
 xSemaphoreTake(mutex,portMAX_DELAY);
 if(hasPending){xSemaphoreGive(mutex);error="Önce devam eden fotoğrafın tamamlanmasını bekle.";return false;}
 // Credentials are provisioned once; never compiled into or returned by the web page.
 bool ok=prefs.putString("ssid",c.ssid)>0&&prefs.putString("password",c.password)>0&&prefs.putString("token",c.token)>0;
 prefs.putString("course",c.course);prefs.putString("rules",c.rules);prefs.putUInt("interval",c.limits.interval);prefs.putFloat("edge",c.limits.edgeMin);prefs.putFloat("duplicate",c.limits.duplicateMax);prefs.putBool("automatic",c.automatic);
 if(c.course!=old.course||c.rules!=old.rules)prefs.remove("recent");
 if(ok){settings=c;rebootRequested=true;rebootAt=millis()+1200;}
 xSemaphoreGive(mutex);if(!ok)error="Ayarlar belleğe yazılamadı.";return ok;
}
// Scans visible 2.4 GHz networks (kept for USB status) and returns the exact broadcast name matching `wanted`:
// identical name first, else the only loosely equal one. Disconnects the station while scanning.
String scanFor(const String& wanted){
 if(xSemaphoreTake(scanLock,0)!=pdTRUE)return String();wifiScanning=true;
 bool online=WiFi.status()==WL_CONNECTED;if(!online){WiFi.disconnect(false,false);delay(150);}
 int n=WiFi.scanNetworks(false,false);if(n<0){delay(500);n=WiFi.scanNetworks(false,false);}
 cJSON* list=cJSON_CreateArray();String exact,loose;int looseHits=0;
 for(int i=0;i<n;++i){String ssid=WiFi.SSID(i);if(ssid.isEmpty())continue;bool seen=false;cJSON* item;
  cJSON_ArrayForEach(item,list)if(field(item,"ssid")==ssid)seen=true;if(seen)continue;
  if(ssid==wanted)exact=ssid;else if(wanted.length()&&looseName(ssid)==looseName(wanted)){loose=ssid;++looseHits;}
  if(cJSON_GetArraySize(list)<15){item=cJSON_CreateObject();cJSON_AddStringToObject(item,"ssid",ssid.c_str());cJSON_AddNumberToObject(item,"rssi",WiFi.RSSI(i));cJSON_AddItemToArray(list,item);}}
 WiFi.scanDelete();String json=serialize(list);cJSON_Delete(list);
 xSemaphoreTake(mutex,portMAX_DELAY);visibleNetworks=json;visibleCount=n<0?-1:n;xSemaphoreGive(mutex);
 wifiScanning=false;xSemaphoreGive(scanLock);return exact.length()?exact:(looseHits==1?loose:String());
}
String scanNetworks(){
 Settings c=config();bool online=WiFi.status()==WL_CONNECTED;String found=scanFor(c.ssid);
 if(!online&&c.ssid.length())WiFi.begin((found.length()?found:c.ssid).c_str(),c.password.c_str());
 xSemaphoreTake(mutex,portMAX_DELAY);String out="{\"ok\":true,\"networks\":"+visibleNetworks+"}";xSemaphoreGive(mutex);return out;
}
// Streams the latest checked frame as one JSON line with base64 JPEG, so the USB page can show what the camera sees.
void sendPreview(){
 xSemaphoreTake(mutex,portMAX_DELAY);size_t n=latestLength;auto p=(uint8_t*)externalAlloc(n?n:1);if(p&&n)memcpy(p,latestImage,n);unsigned id=frameId;xSemaphoreGive(mutex);
 if(!p||!n){externalFree(p);Serial.println("{\"frame\":0,\"preview\":\"\"}");return;}
 Serial.print("{\"frame\":");Serial.print(id);Serial.print(",\"preview\":\"");
 unsigned char out[1032];for(size_t i=0;i<n;i+=768){size_t w=0;mbedtls_base64_encode(out,sizeof(out),&w,p+i,std::min<size_t>(768,n-i));Serial.write(out,w);}
 Serial.println("\"}");externalFree(p);
}
void serialCommand(const String& line){
 cJSON* j=cJSON_Parse(line.c_str());if(!j)return;String command=field(j,"cmd");
 if(command=="status")Serial.println(snapshot(true));
 else if(command=="scan")Serial.println(scanNetworks());
 else if(command=="preview")sendPreview();
 else if(command=="test_camera")Serial.println(requestTest()?"{\"ok\":true}":"{\"ok\":false,\"detail\":\"Kamera meşgul.\"}");
 else if(command=="configure"){String error;bool ok=configure(j,error);cJSON* r=cJSON_CreateObject();cJSON_AddBoolToObject(r,"ok",ok);cJSON_AddStringToObject(r,"detail",ok?"Ayarlar kaydedildi; kamera yeniden başlıyor.":error.c_str());Serial.println(serialize(r));cJSON_Delete(r);}
 cJSON_Delete(j);
}
bool authorized(){if(web.authenticate("admin",deviceCode.c_str()))return true;web.requestAuthentication();return false;}
bool mutation(){if(!authorized())return false;
 if(web.header("X-CSRF")!=csrf){web.send(403,"application/json","{\"detail\":\"Sayfayı yenileyip tekrar dene.\"}");return false;}return true;
}

struct Pending {
 uint8_t* image=nullptr;size_t length=0;NoteCapture::Signature signature{};String requestId,job,delivery;
 uint32_t updated=0;unsigned attempts=0;bool uploaded=false,done=false,blocked=false;
 ~Pending(){externalFree(image);}
};
void worker(void*){
 Pending* pending=nullptr;uint32_t nextPreview=0,nextCloud=0,lastReconnect=0;bool wasOnline=false;String joined;
 status("setup","İlk kurulum için USB sayfasından ayarları kaydet.");
 for(;;){
  vTaskDelay(pdMS_TO_TICKS(40));uint32_t now=millis();Settings c=config();
  xSemaphoreTake(mutex,portMAX_DELAY);bool clear=clearRequested;if(clear&&!hasPending)clearRequested=false;bool restarting=rebootRequested;xSemaphoreGive(mutex);
  if(restarting)continue;
  if(clear&&!pending){policy.recent.clear();policy.resetMotion();saveRecent();}
  bool online=WiFi.status()==WL_CONNECTED;
  if(!online&&!wifiScanning&&c.ssid.length()&&uint32_t(now-lastReconnect)>20000){
   // Look for the hotspot under its broadcast spelling instead of retrying a name that is not on air.
   joined=scanFor(c.ssid);WiFi.begin((joined.length()?joined:c.ssid).c_str(),c.password.c_str());lastReconnect=millis();}
  if(online&&!wasOnline&&joined.length()&&joined!=c.ssid){
   // Keep the exact broadcast name so the next boot connects at once.
   xSemaphoreTake(mutex,portMAX_DELAY);if(settings.ssid==c.ssid){settings.ssid=joined;prefs.putString("ssid",joined);}xSemaphoreGive(mutex);}
  if(online&&!wasOnline){configTime(0,0,"pool.ntp.org","time.google.com");}
  wasOnline=online;xSemaphoreTake(mutex,portMAX_DELAY);networkIp=online?WiFi.localIP().toString():String();xSemaphoreGive(mutex);
  if(pending){
   if(!online){status("waiting_wifi","İnternet bekleniyor; aynı fotoğraf bellekte korunuyor.");continue;}
   if(time(nullptr)<1767225600){status("waiting_clock","Güvenli bağlantı için saat eşitlemesi bekleniyor.");continue;}
   if(pending->blocked){status("access_error","Erişim kodu reddedildi. Ayarları düzeltmek için kamerayı yeniden başlatıp kurulum sayfasını aç.");continue;}
   if(int32_t(now-nextCloud)<0)continue;nextCloud=now+4000;
   if(!pending->uploaded){
    status("uploading","Fotoğraf gönderiliyor.");ApiReply r;apiRequest(r,c,"/api/frames",pending->image,pending->length,pending->requestId);
    String id=field(r.data,"id");auto outcome=NoteCapture::uploadReply(r.code,NoteCapture::uuid(id.c_str()));
    if(outcome==NoteCapture::ReplyKind::Accepted){
     pending->job=id;pending->uploaded=true;pending->updated=millis();externalFree(pending->image);pending->image=nullptr;
     xSemaphoreTake(mutex,portMAX_DELAY);currentJob=id;++sent;xSemaphoreGive(mutex);status("processing","Fotoğraf kabul edildi; cevap hazırlanıyor.");
    }else if(outcome==NoteCapture::ReplyKind::Blocked)pending->blocked=true;
    else if(outcome==NoteCapture::ReplyKind::Retry||r.code==200||r.code==202){
     ++pending->attempts;nextCloud=millis()+NoteCapture::retryDelay(pending->attempts);
     xSemaphoreTake(mutex,portMAX_DELAY);++retries;xSemaphoreGive(mutex);status("retrying","Bağlantı meşgul; aynı fotoğraf ve istek kimliğiyle yeniden denenecek.");
    }else {status("upload_error","Fotoğraf kabul edilmedi; kurulum sayfasındaki bağlantı ve ayarları kontrol et.");delete pending;pending=nullptr;policy.resetMotion();nextPreview=millis()+15000;}
   }else if(!pending->done){
    ApiReply r;apiRequest(r,c,"/api/jobs/"+pending->job+"?format=not-ekran-answer-v1");String state=field(r.data,"status");
    if(r.code==401||r.code==403)pending->blocked=true;
    else if(r.code==200&&state=="done"){pending->done=true;status("waiting_screen","Cevap hazır; NotEkran'ın ekran onayı bekleniyor.");}
    else if((r.code==200&&state=="error")||r.code==404){status("analysis_error","Analiz tamamlanamadı. Görüntü ve bağlantı kontrol edildikten sonra yeniden çekilecek.");delete pending;pending=nullptr;policy.resetMotion();nextPreview=millis()+30000;}
    else status("processing",r.code==200?"Cevap hazırlanıyor.":"Analiz durumuna bağlantı bekleniyor; yeni fotoğraf gönderilmiyor.");
   }else{
    ApiReply r;apiRequest(r,c,"/api/device/status");String selectedJob=field(r.data,"job_id"),delivery=field(r.data,"delivery_id"),ack=field(r.data,"ack_id");
    if(r.code==401||r.code==403)pending->blocked=true;
    else if(r.code==200&&selectedJob==pending->job&&NoteCapture::uuid(delivery.c_str())&&delivery==ack){
     policy.delivered(pending->signature);saveRecent();xSemaphoreTake(mutex,portMAX_DELAY);++rendered;deliveryId=delivery;xSemaphoreGive(mutex);
     delete pending;pending=nullptr;status("delivered","Cevap NotEkran tarafından gösterildi.");policy.resetMotion();
    }else if(r.code==200&&!selectedJob.isEmpty()&&selectedJob!=pending->job){
     // A phone/history action superseded this job: never overwrite that choice.
     policy.delivered(pending->signature);saveRecent();delete pending;pending=nullptr;status("superseded","Başka bir cevap seçilmiş; eski cevap tekrar seçilmedi.");
    }else status("waiting_screen","NotEkran bağlantısı veya ekranın açılması bekleniyor. Yeni fotoğraf gönderilmiyor.");
   }
   xSemaphoreTake(mutex,portMAX_DELAY);hasPending=pending!=nullptr;xSemaphoreGive(mutex);continue;
  }
  xSemaphoreTake(mutex,portMAX_DELAY);bool test=testRequested;testRequested=false;bool fault=cameraFault;xSemaphoreGive(mutex);
  if(!test){
   if(fault)continue;
   if(c.ssid.isEmpty()||!validToken(c.token)){status("setup","Kurulum bekleniyor; görüntü alma durduruldu. USB'den bağlantıyı ve tek kareyi test edebilirsin.");continue;}
   if(!c.automatic){status("paused","Otomatik çekim kapalı; sensör beklemede. Önce tek kare testi yap.");continue;}
   if(!online){status("waiting_wifi","Hotspot bekleniyor; görüntü alma durduruldu.");continue;}
   if(time(nullptr)<1767225600){status("waiting_clock","Saat eşitleniyor; görüntü alma durduruldu.");continue;}
   if(int32_t(now-nextPreview)<0)continue;
  }
  nextPreview=now+8000;
  CameraWindow window;if(!window.ok)continue;
  // Give auto exposure a few frames after restarting the sensor.
  for(int warm=0;warm<3;++warm){auto frame=esp_camera_fb_get();if(frame)esp_camera_fb_return(frame);vTaskDelay(pdMS_TO_TICKS(80));}
  camera_fb_t* fb=esp_camera_fb_get();if(!fb){status("camera_error","Görüntü alınamadı; otomatik deneme durduruldu. Tek kare testiyle yeniden dene.");xSemaphoreTake(mutex,portMAX_DELAY);cameraFault=true;cameraError=detail;xSemaphoreGive(mutex);policy.resetMotion();continue;}
  auto f=measure(fb);cacheImage(fb,f);esp_camera_fb_return(fb);
  if(test){status("test_ok","Tek kare alındı; sensör durduruldu. Görüntü yalnızca yerel önizlemede, yapay zekaya gönderilmedi.");nextPreview=millis()+8000;continue;}
  if(c.ssid.isEmpty()||!validToken(c.token)){status("setup","İlk kurulum gerekli.");policy.resetMotion();continue;}
  if(!c.automatic){status("paused","Otomatik çekim duraklatıldı.");policy.resetMotion();continue;}
  if(!online){status("waiting_wifi","Kayıtlı erişim noktası bekleniyor.");policy.resetMotion();continue;}
  if(time(nullptr)<1767225600){status("waiting_clock","Saat eşitleniyor.");policy.resetMotion();continue;}
  if(!NoteCapture::usable(f,c.limits)){status("covered_or_unsuitable","Görüntü karanlık, boş veya ayrıntı yetersiz; gönderilmiyor.");policy.resetMotion();continue;}
  if(!policy.observe(f,now,c.limits,false)){status("watching","Uygun yeni görüntü bekleniyor; aynı içerik yeniden gönderilmiyor.");continue;}
  policy.started(now);xSemaphoreTake(mutex,portMAX_DELAY);hasPending=true;xSemaphoreGive(mutex);
  status("capturing","Üç kare arasından daha uygun görüntü seçiliyor.");
  auto candidate=new Pending();float best=-1;
  for(int i=0;i<3;++i){
   fb=esp_camera_fb_get();if(fb){auto measured=measure(fb);
    if(fb->len<=MAX_JPEG&&NoteCapture::usable(measured,c.limits)&&!policy.recent.contains(measured.signature,c.limits.duplicateMax)&&measured.score>best){
     auto bytes=(uint8_t*)externalAlloc(fb->len);if(bytes){memcpy(bytes,fb->buf,fb->len);externalFree(candidate->image);candidate->image=bytes;candidate->length=fb->len;candidate->signature=measured.signature;best=measured.score;cacheImage(fb,measured);}
    }esp_camera_fb_return(fb);
   }vTaskDelay(pdMS_TO_TICKS(120));
  }
  if(!candidate->image){delete candidate;xSemaphoreTake(mutex,portMAX_DELAY);hasPending=false;xSemaphoreGive(mutex);status("watching","Uygun yeni kare bulunmadı; tekrar beklenecek.");continue;}
  candidate->requestId=uuid();candidate->updated=millis();pending=candidate;nextCloud=millis();
  xSemaphoreTake(mutex,portMAX_DELAY);hasPending=true;currentJob="";xSemaphoreGive(mutex);
 }
}

void setup(){
 // USB setup sends whole settings lines; the default 256-byte USB receive queue drops overflow.
 Serial.setRxBufferSize(2048);Serial.setTxBufferSize(4096);Serial.begin(115200);setCpuFrequencyMhz(160);mutex=xSemaphoreCreateMutex();scanLock=xSemaphoreCreateMutex();
 cJSON_Hooks hooks={externalAlloc,externalFree};cJSON_InitHooks(&hooks);
 prefs.begin("not-camera",false);
 settings.ssid=prefs.getString("ssid","");settings.password=prefs.getString("password","");settings.token=prefs.getString("token","");
 settings.course=prefs.getString("course","Makroökonomie");settings.rules=prefs.getString("rules","");settings.limits.interval=prefs.getUInt("interval",15000);
 settings.limits.edgeMin=prefs.getFloat("edge",2);settings.limits.duplicateMax=prefs.getFloat("duplicate",8);settings.automatic=prefs.getBool("automatic",false);
 // Only a device that never ran 0.1.1+ is switched off once; later updates keep the user's choice.
 if(prefs.getString("safe-version","").isEmpty()){settings.automatic=false;prefs.putBool("automatic",false);prefs.putString("safe-version",CAMERA_VERSION);}
 deviceCode=prefs.getString("code","");if(deviceCode.length()!=16){deviceCode=uuid();deviceCode.replace("-","");deviceCode=deviceCode.substring(0,16);prefs.putString("code",deviceCode);}
 csrf=uuid();uint64_t mac=ESP.getEfuseMac();char suffix[5];snprintf(suffix,5,"%04X",unsigned(mac&65535));apName="NotCamera-"+String(suffix);
 if(prefs.getBytesLength("recent")==sizeof(policy.recent)){prefs.getBytes("recent",&policy.recent,sizeof(policy.recent));if(policy.recent.count>8||policy.recent.next>7)policy.recent.clear();}
 WiFi.onEvent([](arduino_event_id_t event,arduino_event_info_t info){if(event==ARDUINO_EVENT_WIFI_STA_DISCONNECTED)wifiReason=info.wifi_sta_disconnected.reason;else if(event==ARDUINO_EVENT_WIFI_STA_GOT_IP)wifiReason=0;});
 WiFi.mode(WIFI_AP_STA);WiFi.setAutoReconnect(true);WiFi.softAP(apName.c_str(),deviceCode.c_str());if(settings.ssid.length())WiFi.begin(settings.ssid.c_str(),settings.password.c_str());
 const char* headers[]={"X-CSRF"};web.collectHeaders(headers,1);
 web.on("/",HTTP_GET,[]{if(!authorized())return;String html=FPSTR(SETUP_PAGE);html.replace("__CSRF__",csrf);web.sendHeader("Cache-Control","no-store");web.sendHeader("X-Frame-Options","DENY");web.send(200,"text/html; charset=utf-8",html);});
 web.on("/api/status",HTTP_GET,[]{if(!authorized())return;web.sendHeader("Cache-Control","no-store");web.send(200,"application/json",snapshot());});
 web.on("/api/config",HTTP_POST,[]{if(!mutation())return;if(web.arg("plain").length()>6000){web.send(413);return;}cJSON* j=cJSON_Parse(web.arg("plain").c_str());String error;bool ok=j&&configure(j,error);cJSON_Delete(j);web.send(ok?200:400,"application/json",ok?"{\"ok\":true}":"{\"detail\":\"Ayarları kontrol et; devam eden fotoğraf varsa bitmesini bekle.\"}");});
 web.on("/api/recent/clear",HTTP_POST,[]{if(!mutation())return;xSemaphoreTake(mutex,portMAX_DELAY);bool busy=hasPending;if(!busy)clearRequested=true;xSemaphoreGive(mutex);web.send(busy?409:200,"application/json",busy?"{\"detail\":\"Önce fotoğrafın tamamlanmasını bekle.\"}":"{\"ok\":true}");});
 web.on("/api/preview",HTTP_GET,[]{if(!authorized())return;xSemaphoreTake(mutex,portMAX_DELAY);size_t n=latestLength;auto p=(uint8_t*)externalAlloc(n);if(p&&n)memcpy(p,latestImage,n);xSemaphoreGive(mutex);
  if(!p||!n){externalFree(p);web.send(503,"text/plain","Görüntü henüz yok.");return;}web.sendHeader("Cache-Control","no-store");web.setContentLength(n);web.send(200,"image/jpeg","");web.client().write(p,n);externalFree(p);
 });
 web.onNotFound([]{web.send(404);});web.begin();
 if(xTaskCreatePinnedToCore(worker,"camera",24576,nullptr,1,nullptr,1)!=pdPASS)status("worker_error","Kamera görevi başlatılamadı; bellek yetersiz.");
}
void loop(){
 web.handleClient();static String input;static bool discard=false;
 while(Serial.available()>0){char c=Serial.read();if(c=='\n'){if(!discard&&input.length())serialCommand(input);input="";discard=false;}else if(c!='\r'){if(input.length()<6000&&!discard)input+=c;else {input="";discard=true;}}}
 xSemaphoreTake(mutex,portMAX_DELAY);bool reboot=rebootRequested&&int32_t(millis()-rebootAt)>=0;xSemaphoreGive(mutex);
 if(reboot){Serial.flush();ESP.restart();}delay(2);
}
