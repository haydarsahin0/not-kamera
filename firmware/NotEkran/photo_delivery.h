#pragma once
#include <cJSON.h>
#include "photo_buffer.h"
constexpr size_t MAX_PHOTO_BYTES=4*1024*1024;
struct PhotoRequest{PhotoBuffer image;String profile,requestId;bool resetContext=false;};
QueueHandle_t photoInbox;
bool photoBusy=false;
String photoState="idle",photoDetail="Fotoğraf bekleniyor",photoJob;
uint32_t photoRevision=0;
int photoContextPages=-1;
String photoRequestId(){
 uint8_t b[16];esp_fill_random(b,sizeof(b));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 char id[37];snprintf(id,sizeof(id),"%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7],b[8],b[9],b[10],b[11],b[12],b[13],b[14],b[15]);return String(id);
}
void photoContext(const String& json){
 cJSON* doc=cJSON_Parse(json.c_str());if(!doc)return;
 cJSON* n=cJSON_GetObjectItemCaseSensitive(doc,"context_pages");
 if(cJSON_IsNumber(n)&&n->valueint>=0&&n->valueint<=6){xSemaphoreTake(cloudLock,portMAX_DELAY);photoContextPages=n->valueint;xSemaphoreGive(cloudLock);}
 cJSON_Delete(doc);
}
void photoUpdate(const String& state,const String& detail){
 xSemaphoreTake(cloudLock,portMAX_DELAY);if(photoState!=state||photoDetail!=detail){photoState=state;photoDetail=detail;++photoRevision;}xSemaphoreGive(cloudLock);
}
void photoFinish(const String& state,const String& detail){
 xSemaphoreTake(cloudLock,portMAX_DELAY);photoState=state;photoDetail=detail;photoBusy=false;++photoRevision;xSemaphoreGive(cloudLock);
}
String jsonField(const String& json,const char* field){
 cJSON *doc=cJSON_Parse(json.c_str());if(!doc)return "";
 cJSON *item=cJSON_GetObjectItemCaseSensitive(doc,field);String value=cJSON_IsString(item)?item->valuestring:"";cJSON_Delete(doc);return value;
}
String networkError(HTTPClient& http,int code){
 if(code==401)return "Erisim kodu reddedildi; cihaz eslesmesini yenile.";
 if(code<0)return "Baglanti hatasi: "+HTTPClient::errorToString(code);
 String detail=jsonField(http.getString(),"detail");return detail.length()?detail:"Sunucu hatasi: "+String(code);
}
void photoRendered(){
 xSemaphoreTake(cloudLock,portMAX_DELAY);
 if(photoBusy&&photoState=="received"){photoState="rendered";photoDetail="Cevap ekrana geldi";photoBusy=false;++photoRevision;}
 xSemaphoreGive(cloudLock);
}
