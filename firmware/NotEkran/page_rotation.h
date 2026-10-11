#pragma once
#include <stdint.h>
#include <stddef.h>
// Count reading time from a completed physical refresh, not receipt of a reply.
class PageRotation {
 uint32_t displayedAt=0;bool armed=false;
 public:
 static constexpr uint32_t interval=50000;
 void shown(uint32_t now){displayedAt=now;armed=true;}
 void pause(){armed=false;}
 bool due(uint32_t now,bool reading,size_t pages,bool pending){
  if(!reading){pause();return false;}
  if(!armed||pages<2||pending||uint32_t(now-displayedAt)<interval)return false;
  armed=false;return true;
 }
};
