#pragma once
#include <stdint.h>

enum class ScreenFrame { None, Standby, Content };
// E-paper retains its image without power. Paint the battery standby picture
// before disabling its rail. Reading state remains in RAM.
class ScreenVisibility {
 bool hidden_=false,blankPending_=false,restorePending_=false;
 public:
 bool hidden() const {return hidden_;}
 bool canReceiveAnswer() const {return !hidden_&&!restorePending_;}
 void toggle(){hidden_=!hidden_;blankPending_=hidden_;restorePending_=!hidden_;}
 void refreshStandby(){if(hidden_)blankPending_=true;}
 ScreenFrame frame(bool dirty) const {
  if(hidden_)return blankPending_?ScreenFrame::Standby:ScreenFrame::None;
  return dirty||restorePending_?ScreenFrame::Content:ScreenFrame::None;
 }
 void painted(ScreenFrame frame){
  if(frame==ScreenFrame::Standby)blankPending_=false;
  if(frame==ScreenFrame::Content)restorePending_=false;
 }
};
// One toggle on a debounced release. Ignore the power-on press already held
// during startup, and do not repeat while holding the button.
class ScreenPowerButton {
 bool raw=false,stable=false,armed=false;
 uint32_t changedAt=0;
 public:
 void begin(bool down,uint32_t now){raw=stable=down;armed=!down;changedAt=now;}
 bool waiting() const {return raw||stable;}
 bool update(bool down,uint32_t now){
  if(down!=raw){raw=down;changedAt=now;}
  if(raw==stable||uint32_t(now-changedAt)<35)return false;
  stable=raw;
  if(stable){armed=true;return false;}
  const bool click=armed;armed=false;return click;
 }
};
