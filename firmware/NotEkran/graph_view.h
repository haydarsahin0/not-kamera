#pragma once
#include <algorithm>
#include <cmath>
#include <string>
#include <vector>
#include "unicode_text.h"

namespace NoteGraph {
struct Point {float x=0,y=0;};
struct Curve {std::string label;std::vector<Point> points;Point anchor;bool dashed=false;};
struct Mark {std::string label;Point at;};
struct Arrow {Point from,to;};
struct Tick {std::string label;float value=0;};
struct Graph {std::string title,xLabel,yLabel;std::vector<Curve> curves;std::vector<Mark> marks;std::vector<Arrow> arrows;std::vector<Tick> xTicks,yTicks;};
struct Box {int x,y,w,h;std::string text;};
constexpr int left=34,right=174,top=48,bottom=145;
inline int px(float v){return left+int(std::lround(v*(right-left)/100));}
inline int py(float v){return bottom-int(std::lround(v*(bottom-top)/100));}
inline bool intersects(const Box&a,const Box&b){return a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;}
template<class C> void line(C&c,int x,int y,int ex,int ey,bool dashed=false,int thickness=1){
 int dx=std::abs(ex-x),sx=x<ex?1:-1,dy=-std::abs(ey-y),sy=y<ey?1:-1,err=dx+dy,n=0;
 for(;;){if(!dashed||n%7<4){c.drawPixel(x,y,0);if(thickness==2&&x<199)c.drawPixel(x+1,y,0);}if(x==ex&&y==ey)break;int e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}++n;}
}
template<class C> void arrow(C&c,int x,int y,int ex,int ey){
 line(c,x,y,ex,ey);float a=std::atan2(float(ey-y),float(ex-x));
 for(float off:{-.55f,.55f})line(c,ex,ey,ex-int(std::lround(7*std::cos(a+off))),ey-int(std::lround(7*std::sin(a+off))));
}
template<class C> void white(C&c,const Box&b){for(int y=b.y-1;y<b.y+b.h+1;++y)for(int x=b.x-1;x<b.x+b.w+1;++x)c.drawPixel(x,y,1);}
inline bool crosses(const Box&b,const std::vector<Curve>&curves){
 for(auto&c:curves)for(size_t i=1;i<c.points.size();++i){
  float x=px(c.points[i-1].x),y=py(c.points[i-1].y),dx=px(c.points[i].x)-x,dy=py(c.points[i].y)-y,t0=0,t1=1;
  float p[]={-dx,dx,-dy,dy},q[]={x-b.x+2,b.x+b.w+2-x,y-b.y+2,b.y+b.h+2-y};bool hit=true;
  for(int j=0;j<4;++j){if(p[j]==0){if(q[j]<0){hit=false;break;}}else {float t=q[j]/p[j];if(p[j]<0)t0=std::max(t0,t);else t1=std::min(t1,t);if(t0>t1){hit=false;break;}}}if(hit)return true;
 }return false;
}
inline bool place(const std::string&text,int ax,int ay,std::vector<Box>&boxes,Box&out,const std::vector<Curve>&curves){
 const auto&f=NoteFont::font16;int w=NoteText::width(text,f),h=f.lineHeight;
 const int offsets[][2]={{5,-h-3},{5,4},{-w-5,-h-3},{-w-5,4},{-w/2,-h-8},{-w/2,8},{9,-h/2},{-w-9,-h/2}};
 bool found=false;int best=1000000;
 auto consider=[&](Box b){if(b.x<36||b.y<41||b.x+b.w>194||b.y+b.h>143)return;for(auto&r:boxes)if(intersects(b,r))return;
  int score=(b.x+w/2-ax)*(b.x+w/2-ax)+(b.y+h/2-ay)*(b.y+h/2-ay)+(crosses(b,curves)?100000:0);if(score<best){best=score;out=b;found=true;}};
 for(auto &d:offsets)consider({ax+d[0],ay+d[1],w,h,text});
 // Nearby equilibrium points often need a longer callout. Search the remaining
 // plot area for the nearest free box instead of overlapping or shrinking text.
 for(int y=41;y+h<=143;y+=4)for(int x=36;x+w<=194;x+=4)consider({x,y,w,h,text});
 if(found){boxes.push_back(out);return true;}
 return false;
}
// Returns any labels that require a separate legend page. No label is omitted.
// Text has a white halo, curve labels are joined to their anchor by a leader.
template<class C> std::vector<std::string> draw(C&c,const Graph&g){
 const auto&f=NoteFont::font16;std::vector<Box> boxes;std::vector<std::string> legend;
 for(auto&m:g.marks)boxes.push_back({px(m.at.x)-4,py(m.at.y)-4,9,9,""});
 arrow(c,left,148,182,148);arrow(c,left,148,left,41);
 NoteText::draw(c,g.yLabel,4,35,f);NoteText::draw(c,g.xLabel,195-NoteText::width(g.xLabel,f),182,f);
 for(auto&t:g.xTicks){int x=px(t.value);line(c,x,147,x,151);int w=NoteText::width(t.label,f);NoteText::draw(c,t.label,std::max(3,std::min(195-w,x-w/2)),170,f);}
 for(auto&t:g.yTicks){int y=py(t.value);line(c,left-3,y,left,y);NoteText::draw(c,t.label,30-NoteText::width(t.label,f),y+5,f);}
 for(auto&m:g.marks){line(c,left,py(m.at.y),px(m.at.x),py(m.at.y),true);line(c,px(m.at.x),py(m.at.y),px(m.at.x),148,true);}
 for(auto&v:g.curves)for(size_t i=1;i<v.points.size();++i)line(c,px(v.points[i-1].x),py(v.points[i-1].y),px(v.points[i].x),py(v.points[i].y),v.dashed,2);
 for(auto&a:g.arrows)arrow(c,px(a.from.x),py(a.from.y),px(a.to.x),py(a.to.y));
 for(auto&m:g.marks)for(int y=-3;y<=3;++y)for(int x=-3;x<=3;++x)if(x*x+y*y<=9)c.drawPixel(px(m.at.x)+x,py(m.at.y)+y,0);
 struct Pending {Box b;int ax,ay;};std::vector<Pending> pending;
 auto label=[&](const std::string&text,Point p,const std::string&fallback){
  int ax=px(p.x),ay=py(p.y);Box b;
  if(!place(text,ax,ay,boxes,b,g.curves)){
   // Use a short code and carry the complete name into the next text page.
   if(!place(fallback,ax,ay,boxes,b,g.curves)){return false;}
   legend.push_back(fallback+": "+text);
  }
  pending.push_back({b,ax,ay});return true;
 };
 for(size_t i=0;i<g.marks.size();++i)if(!label(g.marks[i].label,g.marks[i].at,"E"+std::to_string(i+1)))return {"!LAYOUT_ERROR"};
 for(size_t i=0;i<g.curves.size();++i)if(!label(g.curves[i].label,g.curves[i].anchor,"C"+std::to_string(i+1)))return {"!LAYOUT_ERROR"};
 for(auto&p:pending){int tx=std::max(p.b.x,std::min(p.b.x+p.b.w,p.ax)),ty=std::max(p.b.y,std::min(p.b.y+p.b.h,p.ay));if(std::abs(tx-p.ax)+std::abs(ty-p.ay)>6)line(c,p.ax,p.ay,tx,ty);}
 for(auto&p:pending){white(c,p.b);NoteText::draw(c,p.b.text,p.b.x,p.b.y+f.ascent,f);}
 return legend;
}
struct Probe {void drawPixel(int,int,int){}};
inline bool readable(const Graph&g){Probe p;auto result=draw(p,g);return result.empty()||result[0]!="!LAYOUT_ERROR";}
} // namespace NoteGraph
