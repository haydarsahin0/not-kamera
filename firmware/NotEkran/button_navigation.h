#pragma once
#include <stdint.h>
enum class NavEvent { None, Next, Previous, Info };
// Delay the single click so a double click never briefly advances first.
class ButtonNavigation {
 bool wasDown=false,longDone=false,pending=false;
 uint32_t pressed=0,released=0;
 public:
 bool waiting() const { return pending||wasDown; }
 NavEvent update(bool down,uint32_t now){
  NavEvent event=NavEvent::None;
  if(down&&!wasDown){pressed=now;longDone=false;}
  if(down&&!longDone&&now-pressed>=3000){longDone=true;pending=false;event=NavEvent::Info;}
  if(!down&&wasDown&&!longDone&&now-pressed>=40){
   if(pending&&now-released<=400){pending=false;event=NavEvent::Previous;}
   else{pending=true;released=now;}
  }
  if(!down&&pending&&now-released>400){pending=false;event=NavEvent::Next;}
  wasDown=down;return event;
 }
};
