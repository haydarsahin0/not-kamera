#pragma once
#include <NetworkClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include <mbedtls/sha256.h>
#include "cloud_roots.h"
constexpr size_t MAX_TEXT_BYTES=65536;
constexpr const char* CLOUD_API="https://jckoovsocynnxbrsalld.supabase.co/functions/v1/not-kamera-api";
struct CloudMessage{String id,text;};
QueueHandle_t cloudInbox;
SemaphoreHandle_t cloudLock;
String cloudToken,cloudAck,cloudError="Eslesme gerekli";
unsigned cloudAckPages=0;
void cloudSetError(const String &s){xSemaphoreTake(cloudLock,portMAX_DELAY);cloudError=s;xSemaphoreGive(cloudLock);}
String cloudGetError(){xSemaphoreTake(cloudLock,portMAX_DELAY);String s=cloudError;xSemaphoreGive(cloudLock);return s;}
bool validCloudToken(const String &s){if(s.length()<32||s.length()>256)return false;for(size_t i=0;i<s.length();++i){char c=s[i];if(!isalnum(c)&&c!='-'&&c!='_')return false;}return true;}
void cloudSetToken(const String &s){xSemaphoreTake(cloudLock,portMAX_DELAY);cloudToken=s;cloudAck="";cloudAckPages=0;xSemaphoreGive(cloudLock);}
void cloudRendered(const String &id,unsigned pages){xSemaphoreTake(cloudLock,portMAX_DELAY);cloudAck=id;cloudAckPages=pages;xSemaphoreGive(cloudLock);}
String textHash(const String &s){unsigned char digest[32];mbedtls_sha256((const unsigned char*)s.c_str(),s.length(),digest,0);char hex[65];for(int i=0;i<32;i++)snprintf(hex+2*i,3,"%02x",digest[i]);return String(hex);}
// TLS/network I/O is on a worker task: BOOT and the local web server stay responsive.
void cloudWorker(void*){
 String lastReceived,lastAcked,previousToken;
 for(;;){
  vTaskDelay(pdMS_TO_TICKS(4000));
  xSemaphoreTake(cloudLock,portMAX_DELAY);String token=cloudToken,ack=cloudAck;unsigned pages=cloudAckPages;xSemaphoreGive(cloudLock);
  if(token!=previousToken){lastReceived="";lastAcked="";previousToken=token;}
  if(token.isEmpty()){cloudSetError("Eslesme gerekli");continue;}
  if(WiFi.status()!=WL_CONNECTED){cloudSetError("Internet Wi-Fi bekleniyor");continue;}
  if(time(nullptr)<1767225600){cloudSetError("Saat esitleme bekleniyor");continue;}
  NetworkClientSecure tls;tls.setCACert(CLOUD_ROOTS);tls.setHandshakeTimeout(12);
  HTTPClient http;http.setConnectTimeout(10000);http.setTimeout(12000);http.setReuse(false);
  if(ack.length()==36&&ack!=lastAcked){
   http.begin(tls,String(CLOUD_API)+"/api/device/ack?id="+ack+"&pages="+pages);
   http.addHeader("Authorization","Bearer "+token);int code=http.POST("");http.end();
   if(code==200||code==409)lastAcked=ack;
  }
  if(uxQueueMessagesWaiting(cloudInbox))continue;
  http.begin(tls,String(CLOUD_API)+"/api/device/poll?after="+lastReceived);
  const char* names[]={"X-Delivery-Id","X-Text-Bytes","X-Text-Sha256"};http.collectHeaders(names,3);
  http.addHeader("Authorization","Bearer "+token);int code=http.GET();
  if(code==204){cloudSetError("Bulut bagli");http.end();continue;}
  if(code!=200){cloudSetError("Bulut hatasi: "+String(code));http.end();continue;}
  String id=http.header("X-Delivery-Id"),sha=http.header("X-Text-Sha256");long bytes=http.header("X-Text-Bytes").toInt();
  if(id.length()!=36||bytes<=0||bytes>MAX_TEXT_BYTES){cloudSetError("Metin boyutu gecersiz");http.end();continue;}
  String text=http.getString();http.end();
  if(text.length()!=size_t(bytes)||textHash(text)!=sha){cloudSetError("Eksik metin; yeniden aliniyor");continue;}
  CloudMessage *message=new CloudMessage{id,text};
  if(xQueueSend(cloudInbox,&message,0)==pdTRUE){lastReceived=id;cloudSetError("Metin alindi");}else delete message;
 }
}
