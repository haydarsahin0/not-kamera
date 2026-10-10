#pragma once
#include <NetworkClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include <mbedtls/sha256.h>
#include "cloud_roots.h"
constexpr size_t MAX_TEXT_BYTES=65536;
constexpr const char* CLOUD_API="https://jckoovsocynnxbrsalld.supabase.co/functions/v1/not-kamera-api";
struct CloudMessage{String id,text;uint32_t generation;};
uint32_t cloudGeneration=0;
QueueHandle_t cloudInbox;
SemaphoreHandle_t cloudLock;
String cloudToken,cloudAck,cloudError="Eslesme gerekli";
unsigned cloudAckPages=0;
#include "photo_delivery.h"
void cloudSetError(const String &s){xSemaphoreTake(cloudLock,portMAX_DELAY);cloudError=s;xSemaphoreGive(cloudLock);}
String cloudGetError(){xSemaphoreTake(cloudLock,portMAX_DELAY);String s=cloudError;xSemaphoreGive(cloudLock);return s;}
bool validCloudToken(const String &s){if(s.length()<32||s.length()>256)return false;for(size_t i=0;i<s.length();++i){char c=s[i];if(!isalnum(c)&&c!='-'&&c!='_')return false;}return true;}
void cloudSetToken(const String &s){xSemaphoreTake(cloudLock,portMAX_DELAY);cloudToken=s;cloudAck="";cloudAckPages=0;xSemaphoreGive(cloudLock);}
void cloudRendered(const String &id,unsigned pages){xSemaphoreTake(cloudLock,portMAX_DELAY);cloudAck=id;cloudAckPages=pages;xSemaphoreGive(cloudLock);}
String textHash(const String &s){unsigned char digest[32];mbedtls_sha256((const unsigned char*)s.c_str(),s.length(),digest,0);char hex[65];for(int i=0;i<32;i++)snprintf(hex+2*i,3,"%02x",digest[i]);return String(hex);}
// TLS/network I/O is on a worker task: BOOT and the local web server stay responsive.
void cloudWorker(void*){
 String lastReceived,lastAcked,previousToken;
 PhotoRequest *photo=nullptr;String pendingJob;unsigned attempts=0;uint32_t lastAttempt=0;
 for(;;){
  vTaskDelay(pdMS_TO_TICKS(4000));
  if(!photo&&pendingJob.isEmpty()&&xQueueReceive(photoInbox,&photo,0)==pdTRUE){attempts=0;lastAttempt=0;}
  xSemaphoreTake(cloudLock,portMAX_DELAY);String token=cloudToken,ack=cloudAck;unsigned pages=cloudAckPages;uint32_t generation=cloudGeneration;bool localBusy=photoBusy;xSemaphoreGive(cloudLock);
  if(token!=previousToken){lastReceived="";lastAcked="";previousToken=token;}
  String blocked;
  if(token.isEmpty())blocked="Eslesme gerekli";
  else if(WiFi.status()!=WL_CONNECTED)blocked="Internet Wi-Fi bekleniyor";
  else if(time(nullptr)<1767225600)blocked="Saat esitleme bekleniyor";
  if(blocked.length()){
   cloudSetError(blocked);if(photo||pendingJob.length())photoUpdate("waiting",blocked);continue;
  }
  NetworkClientSecure tls;tls.setCACert(CLOUD_ROOTS);tls.setHandshakeTimeout(20);
  HTTPClient http;http.setConnectTimeout(15000);http.setTimeout(30000);http.setReuse(false);
  if(photo){
   if(lastAttempt&&millis()-lastAttempt<30000)continue;
   lastAttempt=millis();photoUpdate("sending","Fotograf sunucuya gonderiliyor");
   http.begin(tls,String(CLOUD_API)+"/api/frames");http.addHeader("Authorization","Bearer "+token);
   http.addHeader("Content-Type","image/jpeg");http.addHeader("X-Study-Profile",photo->profile);
   int code=http.POST(photo->image.data,photo->image.size);String id;
   if(code==202||code==200)id=jsonField(http.getString(),"id");
   if(id.length()==36){
    pendingJob=id;xSemaphoreTake(cloudLock,portMAX_DELAY);photoJob=id;xSemaphoreGive(cloudLock);
    free(photo->image.data);delete photo;photo=nullptr;photoUpdate("processing","Yapay zeka cevabi hazirlaniyor");
   }else{
    String error=networkError(http,code);++attempts;
    if(code<0||((code>=500||code==429)&&attempts<4)){photoUpdate("waiting",error+"; yeniden denenecek");cloudSetError(error);}
    else {free(photo->image.data);delete photo;photo=nullptr;photoFinish("error",error);}
   }
   http.end();continue;
  }
  if(ack.length()==36&&ack!=lastAcked){
   http.begin(tls,String(CLOUD_API)+"/api/device/ack?id="+ack+"&pages="+pages);
   http.addHeader("Authorization","Bearer "+token);int code=http.POST("");http.end();
   if(code==200||code==409)lastAcked=ack;
  }
  if(uxQueueMessagesWaiting(cloudInbox))continue;
  if(pendingJob.length()){
   http.begin(tls,String(CLOUD_API)+"/api/jobs/"+pendingJob+"?format=not-ekran-answer-v1");http.addHeader("Authorization","Bearer "+token);
   int code=http.GET();
   if(code!=200){String error=networkError(http,code);http.end();cloudSetError(error);
    if(code==401||code==404){pendingJob="";photoFinish("error",error);}else photoUpdate("waiting",error);
    continue;
   }
   String body=http.getString();http.end();String state=jsonField(body,"status");
   if(state=="error"){String error=jsonField(body,"error");pendingJob="";photoFinish("error",error);continue;}
   if(state!="done"){photoUpdate("processing","Yapay zeka cevabi hazirlaniyor");continue;}
   String text=jsonField(body,"answer");body="";
   if(text.isEmpty()||text.length()>MAX_TEXT_BYTES){pendingJob="";photoFinish("error","Cevap boyutu gecersiz");continue;}
   // Select this exact job: another site/history action cannot substitute its answer.
   http.begin(tls,String(CLOUD_API)+"/api/device/select?job="+pendingJob);http.addHeader("Authorization","Bearer "+token);
   code=http.POST("");String id=code==200?jsonField(http.getString(),"delivery_id"):"";
   if(id.length()!=36){cloudSetError(networkError(http,code));http.end();continue;}http.end();
   CloudMessage *message=new CloudMessage{id,text,generation};
   if(xQueueSend(cloudInbox,&message,0)==pdTRUE){lastReceived=id;pendingJob="";photoUpdate("received","Cevap alindi; ekran yenileniyor");cloudSetError("Metin alindi");}else delete message;
   continue;
  }
  if(localBusy)continue; // uploading or awaiting physical render: do not fetch an older mailbox answer
  http.begin(tls,String(CLOUD_API)+"/api/device/poll?format=not-ekran-answer-v1&after="+lastReceived);
  const char* names[]={"X-Delivery-Id","X-Text-Bytes","X-Text-Sha256"};http.collectHeaders(names,3);
  http.addHeader("Authorization","Bearer "+token);int code=http.GET();
  if(code==204){cloudSetError("Bulut bagli");http.end();continue;}
  if(code!=200){cloudSetError(networkError(http,code));http.end();continue;}
  String id=http.header("X-Delivery-Id"),sha=http.header("X-Text-Sha256");long bytes=http.header("X-Text-Bytes").toInt();
  if(id.length()!=36||bytes<=0||bytes>MAX_TEXT_BYTES){cloudSetError("Metin boyutu gecersiz");http.end();continue;}
  String text=http.getString();http.end();
  if(text.length()!=size_t(bytes)||textHash(text)!=sha){cloudSetError("Eksik metin; yeniden aliniyor");continue;}
  CloudMessage *message=new CloudMessage{id,text,generation};
  if(xQueueSend(cloudInbox,&message,0)==pdTRUE){lastReceived=id;cloudSetError("Metin alindi");}else delete message;
 }
}
