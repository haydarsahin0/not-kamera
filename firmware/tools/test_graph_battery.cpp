#include <cassert>
#include <iostream>
#include <fstream>
#include "../NotEkran/answer_document.h"
#include "../NotEkran/battery_view.h"
#include "../NotEkran/screen_visibility.h"
#include "../NotEkran/page_rotation.h"
struct Raster {
 unsigned char pixels[40000];int ink=0;
 Raster(){std::fill(pixels,pixels+40000,255);}
 void drawPixel(int x,int y,int c){assert(x>=0&&x<200&&y>=0&&y<200);pixels[y*200+x]=c?255:0;if(!c)++ink;}
 void save(const std::string&path){std::ofstream o(path,std::ios::binary);o<<"P5\n200 200\n255\n";o.write((char*)pixels,40000);}
};
int main(int argc,char**argv){
 assert(argc==2);std::ifstream in(argv[1]);std::string json((std::istreambuf_iterator<char>(in)),{});NoteAnswer::Document doc;
 assert(NoteAnswer::parse(json,2,doc));int graphs=0;
 for(auto&p:doc.pages)if(p.graphic){Raster r;auto legend=NoteGraph::draw(r,p.graph);assert(legend.empty()||legend[0]!="!LAYOUT_ERROR");assert(r.ink>400);r.save("/tmp/not-graph-"+std::to_string(++graphs)+".pgm");}
 assert(graphs==3);assert(doc.pages.size()>size_t(graphs));
 auto prior=doc.pages.size();assert(!NoteAnswer::parse("{\"format\":\"not-ekran-answer-v1\",\"sections\":[]}",2,doc));assert(doc.pages.size()==prior);
 std::string bad=json;auto pos=bad.find("IS₀");assert(pos!=std::string::npos);bad.replace(pos,std::string("IS₀").size(),"WWWWWWWWWWWWWW");assert(!NoteAnswer::parse(bad,2,doc));assert(doc.pages.size()==prior);
 assert(NoteAnswer::parse("Aufgabe 1)\nGröße, π, ΔY",2,doc));assert(!doc.pages[0].graphic);
 assert(!NoteAnswer::parse(std::string(65537,'x'),2,doc));
 std::string text="";for(int i=0;i<1800;++i)text+="Größe, π, ΔY. ";assert(NoteAnswer::parse(text,2,doc));std::string restored;for(auto&p:doc.pages)for(auto&s:p.lines)restored+=s+" ";assert(restored.find("Größe")!=std::string::npos);assert(restored.find("ΔY")!=std::string::npos);
 int last=-1;for(int mv=2500;mv<=4350;++mv){int p=NoteBattery::percent(mv);assert(p>=last&&p>=0&&p<=100);last=p;}
 assert(NoteBattery::percent(0)==-1);assert(NoteBattery::percent(4400)==-1);assert(NoteBattery::percent(3000)==0);assert(NoteBattery::percent(4120)==100);
 for(int mv:{0,3000,3500,3800,4120}){Raster r;NoteBattery::draw(r,mv);assert(r.ink>400);r.save("/tmp/not-battery-"+std::to_string(mv)+".pgm");}
 ScreenVisibility v;v.toggle();assert(v.frame(true)==ScreenFrame::Standby);v.painted(ScreenFrame::Standby);assert(v.frame(true)==ScreenFrame::None);v.refreshStandby();assert(v.frame(false)==ScreenFrame::Standby);assert(!v.canReceiveAnswer());v.painted(ScreenFrame::Standby);v.toggle();assert(v.frame(false)==ScreenFrame::Content);assert(!v.canReceiveAnswer());v.painted(ScreenFrame::Content);assert(v.canReceiveAnswer());
 PageRotation rotation;rotation.shown(1000);assert(rotation.due(51000,true,doc.pages.size(),false));rotation.pause();assert(!rotation.due(99000,false,doc.pages.size(),false));rotation.shown(100000);assert(!rotation.due(149999,true,doc.pages.size(),false));assert(rotation.due(150000,true,doc.pages.size(),false));
 std::cout<<"PASS graph/Unicode raster bounds, transactional answer pagination, legacy delivery, voltage estimate, standby refresh/restore, page rotation\n";
}
