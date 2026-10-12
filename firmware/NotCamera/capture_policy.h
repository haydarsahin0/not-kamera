#pragma once
#include <stdint.h>
#include <stddef.h>
#include <array>
#include <algorithm>
#include <cmath>
#include <limits>

// Image heuristics, not OCR or a page-number detector. Every threshold must be
// checked on the actual lens/light conditions before relying on automatic use.
namespace NoteCapture {
constexpr int SW=32, SH=24;
using Signature=std::array<uint8_t,SW*SH>;
struct Limits {
 float meanMin=70, lightMin=.50f, inkMin=.006f, inkMax=.48f, edgeMin=2.0f;
 float motionMax=22, duplicateMax=8;
 uint32_t interval=15000, stableFor=1200;
};
struct Frame {
 Signature signature{};
 float mean=0, light=0, ink=0, edge=0, spread=0, score=0;
 bool valid=false;
};
inline Frame inspect(const uint8_t* gray,int width,int height) {
 Frame f;if(!gray||width<SW+4||height<SH+4)return f;
 // Ignore a narrow border, without assuming the entire A4 sheet is present.
 int x0=width/12,x1=width-x0,y0=height/12,y1=height-y0;
 unsigned histogram[256]={};size_t count=0;double sum=0,edges=0;size_t edgeCount=0;
 for(int y=y0;y<y1;++y)for(int x=x0;x<x1;++x){
  int p=gray[y*width+x];++histogram[p];sum+=p;++count;
  if(x>x0){edges+=std::abs(p-int(gray[y*width+x-1]));++edgeCount;}
  if(y>y0){edges+=std::abs(p-int(gray[(y-1)*width+x]));++edgeCount;}
 }
 auto percentile=[&](float q){unsigned n=0;for(int i=0;i<256;++i){n+=histogram[i];if(n>=count*q)return i;}return 255;};
 int low=percentile(.02f),high=percentile(.98f),range=std::max(1,high-low);
 unsigned lit=0,ink=0;int inkThreshold=high-std::max(25,int(range*.45f));
 for(int i=0;i<256;++i){if(i>=115)lit+=histogram[i];if(i<inkThreshold)ink+=histogram[i];}
 f.mean=sum/count;f.light=float(lit)/count;f.ink=float(ink)/count;
 f.edge=edgeCount?edges/edgeCount:0;f.spread=high-low;
 for(int sy=0;sy<SH;++sy)for(int sx=0;sx<SW;++sx){
  int ax=x0+sx*(x1-x0)/SW,bx=x0+(sx+1)*(x1-x0)/SW;
  int ay=y0+sy*(y1-y0)/SH,by=y0+(sy+1)*(y1-y0)/SH;
  unsigned total=0,n=0;for(int y=ay;y<by;++y)for(int x=ax;x<bx;++x){total+=gray[y*width+x];++n;}
  float value=n?float(total)/n:0;
  f.signature[sy*SW+sx]=uint8_t(std::clamp((value-low)*255/range,0.f,255.f));
 }
 f.valid=true;f.score=f.edge*std::sqrt(std::max(0.f,f.spread));return f;
}
inline bool usable(const Frame& f,const Limits& l){
 return f.valid&&f.mean>=l.meanMin&&f.light>=l.lightMin&&f.ink>=l.inkMin&&f.ink<=l.inkMax&&f.edge>=l.edgeMin&&f.spread>=35;
}
inline float distance(const Signature& a,const Signature& b){
 // Tolerate one thumbnail-cell translation. Rotation/perspective are not solved.
 float best=std::numeric_limits<float>::max();
 for(int dy=-1;dy<=1;++dy)for(int dx=-1;dx<=1;++dx){
  unsigned sum=0,n=0;for(int y=1;y<SH-1;++y)for(int x=1;x<SW-1;++x){sum+=std::abs(int(a[y*SW+x])-int(b[(y+dy)*SW+x+dx]));++n;}
  best=std::min(best,float(sum)/n);
 }return best;
}
struct Recent {
 static constexpr size_t capacity=8;
 std::array<Signature,capacity> items{};unsigned count=0,next=0;
 bool contains(const Signature& s,float tolerance)const {
  for(unsigned n=0;n<count;++n)if(distance(s,items[n])<=tolerance)return true;
  return false;
 }
 void add(const Signature& s){items[next]=s;next=(next+1)%capacity;count=std::min<unsigned>(count+1,capacity);}
 void clear(){count=next=0;}
};
class Policy {
 bool seen=false,cooldown=false;Signature previous{};uint32_t stableAt=0,lastCapture=0;
 public:
 Recent recent;
 void resetMotion(){seen=false;}
 bool observe(const Frame& f,uint32_t now,const Limits& limits,bool busy){
  if(busy||!usable(f,limits)){seen=false;return false;}
  if(!seen||distance(previous,f.signature)>limits.motionMax){stableAt=now;seen=true;}
  previous=f.signature;
  return uint32_t(now-stableAt)>=limits.stableFor&&(!cooldown||uint32_t(now-lastCapture)>=limits.interval)&&!recent.contains(f.signature,limits.duplicateMax);
 }
 void started(uint32_t now){lastCapture=now;cooldown=true;seen=false;}
 void delivered(const Signature& signature){recent.add(signature);seen=false;}
};
enum class ReplyKind { Accepted, Retry, Blocked, Invalid };
inline ReplyKind uploadReply(int code,bool validId){
 if(code==200||code==202)return validId?ReplyKind::Accepted:ReplyKind::Invalid;
 if(code==401||code==403)return ReplyKind::Blocked;
 if(code<0||code==408||code==409||code==425||code==429||code>=500)return ReplyKind::Retry;
 return ReplyKind::Invalid;
}
inline uint32_t retryDelay(unsigned attempts){return std::min<uint32_t>(60000,5000u<<std::min<unsigned>(attempts,3));}
inline bool uuid(const char* p){
 if(!p)return false;
 for(int i=0;i<36;++i){char c=p[i];if(!c)return false;
  if(i==8||i==13||i==18||i==23){if(c!='-')return false;}
  else if(!((c>='0'&&c<='9')||(c>='a'&&c<='f')||(c>='A'&&c<='F')))return false;
 }return p[36]==0;
}
}
