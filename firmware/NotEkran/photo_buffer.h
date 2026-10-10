#pragma once
#include <stddef.h>
#include <stdint.h>
#include <string.h>
// Caller owns storage. Never accept partial/oversized images as complete.
struct PhotoBuffer {
 uint8_t *data=nullptr;size_t capacity=0,size=0;bool failed=false;
 bool append(const uint8_t *src,size_t count){
  if(failed||!data||count>capacity-size){failed=true;return false;}
  memcpy(data+size,src,count);size+=count;return true;
 }
 bool jpeg()const{return !failed&&size>3&&data[0]==0xff&&data[1]==0xd8;}
};
