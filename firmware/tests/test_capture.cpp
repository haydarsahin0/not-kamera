#include "../NotCamera/capture_policy.h"
#include <cassert>
#include <iostream>
#include <vector>
using namespace NoteCapture;
std::vector<uint8_t> paper(int variant){
 std::vector<uint8_t> image(200*150,230);
 for(int row=0;row<9;++row){int y=20+row*12;for(int word=0;word<8;++word){int x=18+word*20;
  int len=5+((row*7+word*3+variant*(row+word+1))%13);
  for(int yy=y;yy<y+3;++yy)for(int xx=x;xx<x+len;++xx)image[yy*200+xx]=25;
 }}return image;
}
int main(){
 Limits l;auto image=paper(0);auto f=inspect(image.data(),200,150);assert(usable(f,l));
 std::vector<uint8_t> dark(30000,4),blank(30000,230),blur(30000,170);
 assert(!usable(inspect(dark.data(),200,150),l));assert(!usable(inspect(blank.data(),200,150),l));assert(!usable(inspect(blur.data(),200,150),l));
 assert(!inspect(nullptr,200,150).valid);
 auto other=paper(8);auto g=inspect(other.data(),200,150);assert(usable(g,l));
 assert(distance(f.signature,g.signature)>l.duplicateMax);
 auto lighter=image;for(auto& v:lighter)v=std::min(255,int(v)+15);
 auto lit=inspect(lighter.data(),200,150);assert(distance(f.signature,lit.signature)<1);
 Signature shifted=f.signature;for(int y=0;y<SH;++y)for(int x=1;x<SW;++x)shifted[y*SW+x]=f.signature[y*SW+x-1];
 assert(distance(f.signature,shifted)<1);
 Policy p;assert(!p.observe(f,0,l,false));assert(!p.observe(f,1199,l,false));assert(p.observe(f,1200,l,false));
 p.started(1200);assert(!p.observe(g,2000,l,true));p.delivered(f.signature);
 assert(!p.observe(f,200000,l,false));assert(!p.observe(f,202000,l,false));
 assert(!p.observe(inspect(dark.data(),200,150),500000,l,false));
 assert(!p.observe(g,500500,l,false));assert(p.observe(g,501700,l,false));
 p.started(501700);p.delivered(g.signature);assert(!p.observe(g,520000,l,false));assert(!p.observe(g,522000,l,false));
 p.recent.clear();assert(p.observe(g,524000,l,false));
 Policy rollover;assert(!rollover.observe(f,UINT32_MAX-599,l,false));assert(rollover.observe(f,600,l,false));
 Recent ring;for(int i=0;i<9;++i){Signature s{};s.fill(i*25);ring.add(s);}Signature zero{};assert(!ring.contains(zero,1));assert(ring.count==8);
 assert(uploadReply(202,true)==ReplyKind::Accepted);assert(uploadReply(202,false)==ReplyKind::Invalid);
 for(int code:{-1,408,409,425,429,500,503})assert(uploadReply(code,false)==ReplyKind::Retry);
 assert(uploadReply(401,false)==ReplyKind::Blocked);assert(uploadReply(413,false)==ReplyKind::Invalid);
 assert(retryDelay(1)==10000&&retryDelay(10)==40000);
 assert(uuid("12345678-1234-4234-8234-123456789abc"));assert(!uuid("123"));assert(!uuid("12345678-1234-4234-8234-123456789abg"));
 std::cout<<"PASS image gates, different content, light/translation tolerance, covered/reopen after 5 minutes, cooldown, busy/ack, repeat memory, rollover, idempotent reply policy\n";
}
