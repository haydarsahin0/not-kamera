#pragma once
#include <cJSON.h>
#include "photo_buffer.h"
constexpr size_t MAX_PHOTO_BYTES=4*1024*1024;
struct PhotoRequest{PhotoBuffer image;String profile;};
QueueHandle_t photoInbox;
bool photoBusy=false;
String photoState="idle",photoDetail="Fotoğraf bekleniyor",photoJob;
uint32_t photoRevision=0;
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
