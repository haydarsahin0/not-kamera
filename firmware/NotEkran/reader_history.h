#pragma once
#include <cJSON.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

// The source document, not rendered pixels, is kept so Unicode and graphs can
// be rebuilt offline. Filesystem adapter must implement atomic replacement.
namespace NoteHistory {
constexpr size_t maxEntries=12,maxSource=65536,maxIndex=16384;
struct Files {
 virtual ~Files()=default;
 virtual bool read(const std::string&,std::string&,size_t)=0;
 virtual bool atomicWrite(const std::string&,const std::string&)=0;
 virtual bool remove(const std::string&)=0;
 virtual std::vector<std::string> names()=0;
};
struct Entry {std::string key,title,delivery;size_t page=0,pages=1;bool rendered=false;};
struct Source {std::string text;int size=2;bool structured=true;};
inline bool validKey(const std::string&s){return s.size()==64&&s.find_first_not_of("0123456789abcdef")==std::string::npos;}
inline uint32_t crc(const std::string&s){uint32_t v=0xffffffff;for(unsigned char b:s){v^=b;for(int n=0;n<8;++n)v=(v>>1)^(0xedb88320u&uint32_t(-int32_t(v&1)));}return ~v;}
inline void putNumber(std::string&s,uint32_t n){for(int i=0;i<4;++i)s+=char(n>>(8*i));}
inline uint32_t getNumber(const std::string&s,size_t p){uint32_t n=0;for(int i=0;i<4;++i)n|=uint32_t(uint8_t(s[p+i]))<<(8*i);return n;}
inline std::string pack(const Source&s){std::string o="NER1";o+=char(s.size);o+=char(s.structured);o.append(2,'\0');putNumber(o,uint32_t(s.text.size()));putNumber(o,crc(o+s.text));return o+s.text;}
inline bool unpack(const std::string&s,Source&out){
 if(s.size()<16||s.compare(0,4,"NER1")!=0||(s[4]!=1&&s[4]!=2)||(s[5]!=0&&s[5]!=1)||s[6]||s[7])return false;
 uint32_t bytes=getNumber(s,8);if(!bytes||bytes>maxSource||s.size()!=size_t(bytes)+16||getNumber(s,12)!=crc(s.substr(0,12)+s.substr(16)))return false;
 out={s.substr(16),int(s[4]),bool(s[5])};return true;
}
class Reader {
 Files&fs;std::vector<Entry> items;std::string selected;
 static std::string path(const std::string&key){return "/a"+key;}
 static bool integer(const cJSON*v,size_t&out,size_t limit){if(!cJSON_IsNumber(v)||!std::isfinite(v->valuedouble)||v->valuedouble<0||v->valuedouble>limit||std::floor(v->valuedouble)!=v->valuedouble)return false;out=size_t(v->valuedouble);return true;}
 static bool str(const cJSON*o,const char*n,std::string&s,size_t limit){auto v=cJSON_GetObjectItemCaseSensitive(o,n);if(!cJSON_IsString(v)||!v->valuestring)return false;s=v->valuestring;return s.size()<=limit;}
 bool commit(const std::vector<Entry>&next,const std::string&key){
  cJSON*o=cJSON_CreateObject();if(!o)return false;
  cJSON_AddNumberToObject(o,"v",1);cJSON_AddStringToObject(o,"selected",key.c_str());auto a=cJSON_AddArrayToObject(o,"entries");
  for(auto&e:next){auto r=cJSON_CreateObject();cJSON_AddItemToArray(a,r);cJSON_AddStringToObject(r,"key",e.key.c_str());cJSON_AddStringToObject(r,"title",e.title.c_str());cJSON_AddStringToObject(r,"delivery",e.delivery.c_str());cJSON_AddNumberToObject(r,"page",e.page);cJSON_AddNumberToObject(r,"pages",e.pages);cJSON_AddBoolToObject(r,"rendered",e.rendered);}
  char*json=cJSON_PrintUnformatted(o);cJSON_Delete(o);if(!json)return false;std::string body=json;cJSON_free(json);
  std::string checked="NEI1";putNumber(checked,crc(body));checked+=body;
  if(!fs.atomicWrite("/reader",checked))return false;
  std::string verify;if(!fs.read("/reader",verify,maxIndex)||verify!=checked)return false;
  items=next;selected=key;return true;
 }
 void prune(){for(auto&p:fs.names())if(p.size()==66&&p.rfind("/a",0)==0&&validKey(p.substr(2))&&std::none_of(items.begin(),items.end(),[&](const Entry&e){return path(e.key)==p;}))fs.remove(p);}
 public:
 explicit Reader(Files&files):fs(files){}
 const std::vector<Entry>&entries()const{return items;}
 const Entry*delivered(const std::string&id)const{if(id.empty())return nullptr;for(auto&e:items)if(e.delivery==id&&e.rendered)return &e;return nullptr;}
 const Entry*current()const{for(auto&e:items)if(e.key==selected)return &e;return nullptr;}
 bool load(const std::string&key,Source&out){if(!validKey(key))return false;std::string b;return fs.read(path(key),b,maxSource+16)&&unpack(b,out);}
 bool begin(){
  std::string index;if(!fs.read("/reader",index,maxIndex)){auto paths=fs.names();return std::find(paths.begin(),paths.end(),"/reader")==paths.end();} // absent only, not an unreadable index
  if(index.size()<8||index.compare(0,4,"NEI1")||getNumber(index,4)!=crc(index.substr(8)))return false;
  cJSON*o=cJSON_ParseWithOpts(index.c_str()+8,nullptr,true);if(!o)return false;
  auto v=cJSON_GetObjectItemCaseSensitive(o,"v"),a=cJSON_GetObjectItemCaseSensitive(o,"entries");std::string key;std::vector<Entry> next;
  bool ok=cJSON_IsNumber(v)&&v->valueint==1&&cJSON_IsArray(a)&&cJSON_GetArraySize(a)<=int(maxEntries)&&str(o,"selected",key,64)&&(key.empty()||validKey(key));
  const cJSON*r;if(ok)cJSON_ArrayForEach(r,a){Entry e;if(!str(r,"key",e.key,64)||!validKey(e.key)||!str(r,"title",e.title,160)||!str(r,"delivery",e.delivery,36)||(!e.delivery.empty()&&e.delivery.size()!=36)||!integer(cJSON_GetObjectItemCaseSensitive(r,"page"),e.page,9999)||!integer(cJSON_GetObjectItemCaseSensitive(r,"pages"),e.pages,10000)||!e.pages||e.page>=e.pages||std::any_of(next.begin(),next.end(),[&](const Entry&x){return x.key==e.key;})){ok=false;break;}
   auto rendered=cJSON_GetObjectItemCaseSensitive(r,"rendered");if(!cJSON_IsBool(rendered)){ok=false;break;}e.rendered=cJSON_IsTrue(rendered);
   Source s;if(load(e.key,s))next.push_back(e); // skip damaged/missing record, keep the rest
  }
  cJSON_Delete(o);if(!ok)return false;
  if(std::none_of(next.begin(),next.end(),[&](const Entry&e){return e.key==key;}))key=next.empty()?"":next.back().key;
  items=std::move(next);selected=key;prune();return true;
 }
 bool add(const std::string&key,const Source&source,const std::string&title,const std::string&delivery,size_t pages){
  if(!validKey(key)||source.text.empty()||source.text.size()>maxSource||(source.size!=1&&source.size!=2)||title.size()>160||(!delivery.empty()&&delivery.size()!=36)||!pages||pages>10000)return false;
  auto next=items;auto old=std::find_if(next.begin(),next.end(),[&](const Entry&e){return e.key==key;});
  if(old!=next.end()){
   Source prior;if(!load(key,prior)||prior.text!=source.text||prior.size!=source.size||prior.structured!=source.structured)return false;
   if(old->delivery!=delivery)old->rendered=false;
   old->delivery=delivery;old->pages=pages;old->page=std::min(old->page,pages-1);
   Entry recent=*old;next.erase(old);next.push_back(std::move(recent));
   return commit(next,key);
  }
  // Keep old index and records intact until both the new source and new index
  // are durably written. Interrupted writes cannot replace a readable answer.
  std::string data=pack(source);if(!fs.atomicWrite(path(key),data))return false;
  std::string verify;if(!fs.read(path(key),verify,maxSource+16)||verify!=data)return false;
  next.push_back({key,title,delivery,0,pages});if(next.size()>maxEntries)next.erase(next.begin());
  if(!commit(next,key))return false;
  prune();return true;
 }
 bool checkpoint(const std::string&key,size_t page,bool rendered=false){
  auto next=items;auto i=std::find_if(next.begin(),next.end(),[&](const Entry&e){return e.key==key;});if(i==next.end()||page>=i->pages)return false;
  if(selected==key&&i->page==page&&(!rendered||i->rendered))return true;
  i->page=page;i->rendered=i->rendered||rendered;return commit(next,key);
 }
 bool erase(const std::string&key){auto next=items;next.erase(std::remove_if(next.begin(),next.end(),[&](const Entry&e){return e.key==key;}),next.end());std::string keep=selected;if(keep==key)keep=next.empty()?"":next.back().key;if(!commit(next,keep))return false;prune();return true;}
};
} // namespace NoteHistory
