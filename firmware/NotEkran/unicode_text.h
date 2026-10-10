#pragma once
#include <string>
#include <vector>
#include <stdio.h>
#include "unicode_font_data.h"

namespace NoteText {
inline const NoteFont::Font &font(int size) { return size==1?NoteFont::font16:NoteFont::font20; }
inline const NoteFont::Glyph *glyph(const NoteFont::Font &f,uint32_t cp) {
 size_t lo=0,hi=f.count;
 while(lo<hi){size_t mid=(lo+hi)/2;if(f.glyphs[mid].code<cp)lo=mid+1;else hi=mid;}
 return lo<f.count&&f.glyphs[lo].code==cp?&f.glyphs[lo]:nullptr;
}
inline std::string encode(uint32_t cp) {
 std::string s;
 if(cp<0x80)s+=char(cp);
 else if(cp<0x800){s+=char(0xc0|(cp>>6));s+=char(0x80|(cp&63));}
 else if(cp<0x10000){s+=char(0xe0|(cp>>12));s+=char(0x80|((cp>>6)&63));s+=char(0x80|(cp&63));}
 else{s+=char(0xf0|(cp>>18));s+=char(0x80|((cp>>12)&63));s+=char(0x80|((cp>>6)&63));s+=char(0x80|(cp&63));}
 return s;
}
// Strict decoding: reject truncated, overlong, surrogate and out-of-range input.
inline uint32_t decode(const std::string &s,size_t &i) {
 unsigned char c=s[i++];if(c<0x80)return c;
 int n;uint32_t cp,min;
 if(c>=0xc2&&c<=0xdf){n=1;cp=c&31;min=0x80;}
 else if(c>=0xe0&&c<=0xef){n=2;cp=c&15;min=0x800;}
 else if(c>=0xf0&&c<=0xf4){n=3;cp=c&7;min=0x10000;}
 else return 0xfffd;
 for(int j=0;j<n;++j){if(i==s.size()||((unsigned char)s[i]&0xc0)!=0x80)return 0xfffd;cp=(cp<<6)|((unsigned char)s[i++]&63);}
 return cp<min||cp>0x10ffff||(cp>=0xd800&&cp<=0xdfff)?0xfffd:cp;
}
inline std::string normalize(const std::string &s) {
 std::vector<uint32_t> points;
 for(size_t i=0;i<s.size();){uint32_t cp=decode(s,i);
  if(cp=='\r'){if(i<s.size()&&s[i]=='\n')++i;cp='\n';}
  if(cp=='\t'||cp==0xa0||cp==0x202f)cp=' ';
  if(cp<32&&cp!='\n')continue;
  if(cp==0x200b||cp==0xfeff||cp==0x200c||cp==0x200d)continue;
  if(!points.empty()&&cp>=0x300&&cp<=0x36f){bool found=false;
   for(const auto &c:NoteFont::compositions)if(c.base==points.back()&&c.mark==cp){points.back()=c.composed;found=true;break;}
   if(found)continue;
  }
  points.push_back(cp);
 }
 std::string out;
 for(auto cp:points){
  if(cp=='\n'||glyph(NoteFont::font20,cp))out+=encode(cp);
  else {char b[20];snprintf(b,sizeof(b),"[U+%04lX]",(unsigned long)cp);out+=b;}
 }
 return out;
}
inline int width(const std::string &s,const NoteFont::Font &f) {
 int x=0,extent=0;for(size_t i=0;i<s.size();){auto g=glyph(f,decode(s,i));if(g){int ink=x+g->left+g->width;if(ink>extent)extent=ink;x+=g->advance;}}return x>extent?x:extent;
}
inline std::vector<std::string> wrap(const std::string &text,int pixels,const NoteFont::Font &f) {
 std::vector<std::string> lines;if(pixels<=0)return lines;
 size_t start=0;
 do{
  size_t end=text.find('\n',start);if(end==std::string::npos)end=text.size();
  if(start==end)lines.emplace_back();
  while(start<end){
   size_t pos=start,lastSpace=std::string::npos;int x=0;
   while(pos<end){size_t next=pos;auto cp=decode(text,next);auto g=glyph(f,cp);int advance=g?g->advance:0;
    int ink=g?x+g->left+g->width:x;
    if((x+advance>pixels||ink>pixels)&&pos>start)break;
    x+=advance;if(cp==' ')lastSpace=pos;pos=next;
   }
   if(pos<end&&lastSpace!=std::string::npos&&lastSpace>start){lines.push_back(text.substr(start,lastSpace-start));start=lastSpace+1;}
   else {lines.push_back(text.substr(start,pos-start));start=pos;}
   while(start<end&&text[start]==' ')++start;
  }
  if(end==text.size())break;
  start=end+1;
 }while(start<=text.size());
 return lines;
}
template<class Canvas> inline void draw(Canvas &canvas,const std::string &s,int x,int baseline,const NoteFont::Font &f) {
 for(size_t i=0;i<s.size();){auto g=glyph(f,decode(s,i));if(!g)continue;
  for(int y=0;y<g->height;++y)for(int col=0;col<g->width;++col){size_t bit=y*g->width+col;
   if(f.bitmap[g->offset+bit/8]&(0x80>>(bit%8)))canvas.drawPixel(x+g->left+col,baseline+g->top+y,0);
  }
  x+=g->advance;
 }
}
} // namespace NoteText
