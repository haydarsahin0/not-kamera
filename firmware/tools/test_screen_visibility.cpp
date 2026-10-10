#include <cassert>
#include <iostream>
#include "../NotEkran/screen_visibility.h"
#include "../NotEkran/page_rotation.h"
int main(){
 ScreenVisibility screen;PageRotation rotation;
 assert(!screen.hidden()&&screen.canReceiveAnswer());
 assert(screen.frame(false)==ScreenFrame::None);
 assert(screen.frame(true)==ScreenFrame::Content);
 rotation.shown(1000);
 screen.toggle();rotation.pause();
 assert(screen.hidden());assert(!screen.canReceiveAnswer());
 assert(screen.frame(false)==ScreenFrame::Standby);
 screen.painted(ScreenFrame::Standby);
 // New web/status changes must not repaint hidden text, nor advance pages.
 assert(screen.frame(true)==ScreenFrame::None);
 assert(!rotation.due(120000,false,9,false));
 screen.toggle();
 assert(!screen.hidden());assert(!screen.canReceiveAnswer());
 assert(screen.frame(false)==ScreenFrame::Content);
 // Restore the retained content before accepting a waiting cloud answer.
 screen.painted(ScreenFrame::Content);rotation.shown(130000);
 assert(screen.canReceiveAnswer());assert(screen.frame(false)==ScreenFrame::None);
 assert(!rotation.due(159999,true,9,false));assert(rotation.due(160000,true,9,false));
 // A second quick toggle cancels a pending white frame safely.
 screen.toggle();screen.toggle();assert(screen.frame(false)==ScreenFrame::Content);
 ScreenPowerButton key;key.begin(false,0);
 assert(!key.update(true,100));assert(!key.update(false,110)); // bounce
 assert(!key.update(false,145));
 assert(!key.update(true,200));assert(!key.update(true,235));
 assert(!key.update(true,30000)); // long hold never repeats
 assert(!key.update(false,30010));assert(!key.update(false,30044));
 assert(key.update(false,30045));assert(!key.update(false,99999));
 // Button held to turn on the board must not blank the startup screen.
 key.begin(true,100000);assert(!key.update(false,100050));assert(!key.update(false,100085));
 key.update(true,100100);key.update(true,100135);key.update(false,100150);assert(key.update(false,100185));
 // Unsigned timing also works across millis rollover.
 key.begin(false,0xffffffe0);key.update(true,0xfffffff0);assert(!key.update(true,0x13));key.update(false,0x20);assert(key.update(false,0x43));
 std::cout<<"PASS blank/restore, suppressed hidden refresh, delivery ordering, paused 30s timer, PWR debounce/startup/hold/rollover\n";
}
