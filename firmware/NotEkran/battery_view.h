#pragma once
#include <cmath>
#include <string>
#include "graph_view.h"

namespace NoteBattery {
// Same endpoints as the pinned vendor V2 factory example. This is a voltage
// estimate, not a coulomb counter; charging/load can change the estimate.
inline int percent(int mv){if(mv<2500||mv>4350)return -1;if(mv<=3000)return 0;if(mv>=4120)return 100;return (mv-3000)*100/1120;}
template<class C> struct Scale {C&c;int ox,oy;void drawPixel(int x,int y,int color){for(int dy=0;dy<2;++dy)for(int dx=0;dx<2;++dx)c.drawPixel(ox+2*x+dx,oy+2*y+dy,color);}};
template<class C> void draw(C&c,int mv){
 auto center=[&](const std::string&s,int base){NoteText::draw(c,s,(200-NoteText::width(s,NoteFont::font16))/2,base,NoteFont::font16);};
 center("Dinleniyorum",29);int p=percent(mv);
 // Rounded battery silhouette, cap and a sleepy little face.
 for(int offset=0;offset<2;++offset){int x=28+offset,y=49+offset,w=139-2*offset,h=57-2*offset;
  NoteGraph::line(c,x+6,y,x+w-6,y);NoteGraph::line(c,x+6,y+h,x+w-6,y+h);NoteGraph::line(c,x,y+6,x,y+h-6);NoteGraph::line(c,x+w,y+6,x+w,y+h-6);
  NoteGraph::line(c,x,y+6,x+6,y);NoteGraph::line(c,x+w-6,y,x+w,y+6);NoteGraph::line(c,x,y+h-6,x+6,y+h);NoteGraph::line(c,x+w-6,y+h,x+w,y+h-6);
 }
 NoteGraph::line(c,169,65,177,65);NoteGraph::line(c,177,65,177,90);NoteGraph::line(c,177,90,169,90);
 if(p>=0){int n=125*p/100;for(int y=55;y<=100;++y)for(int x=34;x<34+n;++x)c.drawPixel(x,y,0);}
 // White face panel keeps the expression visible at every fill level.
 NoteGraph::Box face{76,63,43,28,""};NoteGraph::white(c,face);
 NoteGraph::line(c,81,73,90,73);NoteGraph::line(c,104,73,113,73);
 NoteGraph::line(c,90,84,94,88);NoteGraph::line(c,94,88,101,88);NoteGraph::line(c,101,88,105,84);
 std::string label=p<0?"--%":"~"+std::to_string(p)+"%";
 Scale<C> scaled{c,(200-2*NoteText::width(label,NoteFont::font18))/2,116};NoteText::draw(scaled,label,0,NoteFont::font18.ascent,NoteFont::font18);
 char volts[24];if(p<0)center("Pil ölçümü yok",178);else {snprintf(volts,sizeof(volts),"Yaklaşık · %.2f V",mv/1000.0);center(volts,178);}
}
} // namespace NoteBattery
