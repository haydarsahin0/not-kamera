#include <cassert>
#include <iostream>
#include "../NotEkran/button_navigation.h"
#include "../NotEkran/text_layout.h"
int main(){
 ButtonNavigation b;
 assert(b.update(true,100)==NavEvent::None);
 assert(b.update(false,160)==NavEvent::None);
 assert(b.update(false,561)==NavEvent::Next);
 assert(b.update(false,1000)==NavEvent::None);
 b.update(true,1100);b.update(false,1160);b.update(true,1260);
 assert(b.update(false,1320)==NavEvent::Previous);
 assert(b.update(false,1800)==NavEvent::None);
 b.update(true,2000);assert(b.update(true,5000)==NavEvent::Info);
 assert(b.update(false,5010)==NavEvent::None);
 assert(b.update(false,5600)==NavEvent::None);
 b.update(true,6000);assert(b.update(false,6020)==NavEvent::None);assert(b.update(false,6500)==NavEvent::None);
 std::string text;for(int i=0;i<1000;i++)text+="Aufgabe "+std::to_string(i)+")\n";
 text+="LAST ANSWER";
 auto lines=wrapText(normalizeText(text),32);
 assert(lines.size()>1000);assert(lines.back()=="LAST ANSWER");
 std::cout<<"PASS single/double/long/debounce and complete long text\n";
}
