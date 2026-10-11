#pragma once
#include <LittleFS.h>
#include <esp_partition.h>
#include "reader_history.h"

class HistoryFiles: public NoteHistory::Files {
 public:
 bool begin(){
  if(LittleFS.begin(false))return true;
  // Format only a wholly erased partition on first use. A mount error must
  // never silently erase existing answers or unrelated data.
  auto part=esp_partition_find_first(ESP_PARTITION_TYPE_DATA,ESP_PARTITION_SUBTYPE_DATA_SPIFFS,"spiffs");
  if(!part)return false;
  uint8_t block[1024];
  for(size_t offset=0;offset<part->size;offset+=sizeof(block)){
   size_t n=std::min(sizeof(block),size_t(part->size-offset));
   if(esp_partition_read(part,offset,block,n)!=ESP_OK)return false;
   for(size_t i=0;i<n;++i)if(block[i]!=0xff)return false;
  }
  return LittleFS.format()&&LittleFS.begin(false);
 }
 bool read(const std::string&path,std::string&out,size_t maxBytes)override{
  File f=LittleFS.open(path.c_str(),"r");if(!f||f.isDirectory()||f.size()>maxBytes)return false;
  out.resize(f.size());size_t n=f.readBytes(out.data(),out.size());f.close();return n==out.size();
 }
 bool atomicWrite(const std::string&path,const std::string&bytes)override{
  const std::string temp=path+".tmp";
  File f=LittleFS.open(temp.c_str(),"w");if(!f)return false;
  size_t written=f.write(reinterpret_cast<const uint8_t*>(bytes.data()),bytes.size());f.flush();f.close();
  std::string checked;
  if(written!=bytes.size()||!read(temp,checked,bytes.size())||checked!=bytes){LittleFS.remove(temp.c_str());return false;}
  // LittleFS rename atomically replaces an existing file. Do not unlink the
  // old file first: it must survive a power loss before replacement commits.
  if(!LittleFS.rename(temp.c_str(),path.c_str())){LittleFS.remove(temp.c_str());return false;}
  return true;
 }
 bool remove(const std::string&path)override{return LittleFS.remove(path.c_str());}
 std::vector<std::string> names()override{
  std::vector<std::string> paths;File root=LittleFS.open("/");if(!root)return paths;
  File f=root.openNextFile();while(f){paths.emplace_back(f.path());f.close();f=root.openNextFile();}root.close();return paths;
 }
};
