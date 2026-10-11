#include <cassert>
#include <fstream>
#include <iostream>
#include "../NotEkran/answer_document.h"
struct Raster {
 unsigned char pixels[40000];int ink=0;
 Raster(){std::fill(pixels,pixels+40000,255);}
 void drawPixel(int x,int y,int color){assert(x>=0&&x<200&&y>=0&&y<200);pixels[y*200+x]=color?255:0;if(!color)++ink;}
 void save(const std::string&path){std::ofstream out(path,std::ios::binary);out<<"P5\n200 200\n255\n";out.write((char*)pixels,40000);}
};
int main(int argc,char**argv){
 assert(argc==2);std::ifstream in(argv[1]);std::string json((std::istreambuf_iterator<char>(in)),{});NoteAnswer::Document doc;
 assert(NoteAnswer::parse(json,2,doc));int graphs=0;
 for(const auto&p:doc.pages)if(p.graphic){
  Raster raster;auto legend=NoteGraph::draw(raster,p.graph);assert(legend.empty()||legend[0]!="!LAYOUT_ERROR");assert(raster.ink>400);
  NoteText::draw(raster,NoteAnswer::heading(p),4,20,NoteFont::font16);
  raster.save("/tmp/not-layout-"+std::to_string(++graphs)+".pgm");
  assert(p.graph.curves.size()==3);assert(p.graph.marks.size()==2);assert(p.graph.arrows.size()==1);
  assert(p.graph.xTicks.size()==1&&p.graph.yTicks.size()==1);
 }
 assert(graphs==3);assert(doc.pages.size()>size_t(graphs));
 std::cout<<"PASS existing firmware parser, all 3 adapted drawings, bounded native Unicode raster and pagination\n";
}
