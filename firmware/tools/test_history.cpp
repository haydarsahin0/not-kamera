#include <cassert>
#include <fstream>
#include <iostream>
#include <map>
#include "../NotEkran/reader_history.h"
#include "../NotEkran/answer_document.h"

struct Memory:NoteHistory::Files {
 std::map<std::string,std::string> disk;int writes=0;std::string fail,tear;
 bool read(const std::string&p,std::string&out,size_t cap)override{auto i=disk.find(p);if(i==disk.end()||i->second.size()>cap)return false;out=i->second;return true;}
 bool atomicWrite(const std::string&p,const std::string&bytes)override{
  ++writes;if(p==fail)return false;
  if(p==tear){disk[p+".tmp"]=bytes.substr(0,bytes.size()/2);return false;}
  disk[p]=bytes;return true;
 }
 bool remove(const std::string&p)override{return disk.erase(p)>0;}
 std::vector<std::string> names()override{std::vector<std::string>out;for(auto&v:disk)out.push_back(v.first);return out;}
};
std::string key(int n){std::string k(64,'0');k[63]="0123456789abcdef"[n%16];k[62]="0123456789abcdef"[(n/16)%16];return k;}
std::string id(int n){std::string s(36,'0');s.back()=char('a'+n);return s;}
struct Raster {
 unsigned char pixels[40000];Raster(){std::fill(pixels,pixels+40000,255);}
 void drawPixel(int x,int y,int c){assert(x>=0&&x<200&&y>=0&&y<200);pixels[y*200+x]=c?255:0;}
 void save(const std::string&path){std::ofstream out(path,std::ios::binary);out<<"P5\n200 200\n255\n";out.write((char*)pixels,40000);}
};
int main(int argc,char**argv){
 assert(argc==2);Memory fs;NoteHistory::Reader reader(fs);assert(reader.begin());
 NoteHistory::Source a{"Größe, π, ΔY.\nAufgabe 1",2,false},b{"Aufgabe 2b",1,false};
 assert(reader.add(key(1),a,"Aufgabe 1",id(1),8));assert(!reader.delivered(id(1)));
 assert(reader.checkpoint(key(1),5,true));assert(reader.delivered(id(1)));
 int writes=fs.writes;assert(reader.checkpoint(key(1),5,true));assert(fs.writes==writes);
 assert(reader.add(key(2),b,"Aufgabe 2b",id(2),4));assert(reader.checkpoint(key(2),2,true));
 assert(reader.checkpoint(key(1),5));
 NoteHistory::Reader boot(fs);assert(boot.begin());assert(boot.current()->key==key(1)&&boot.current()->page==5);assert(boot.delivered(id(2)));
 NoteHistory::Source restored;assert(boot.load(key(1),restored));assert(restored.text==a.text&&restored.size==2&&!restored.structured);
 assert(boot.add(key(1),a,"Aufgabe 1",id(3),8));assert(boot.current()->page==5);assert(!boot.delivered(id(3)));assert(boot.checkpoint(key(1),5,true));
 // Interrupted source and index writes preserve prior selection on reboot.
 for(const std::string&path:{"/a"+key(3),std::string("/reader")}){
  fs.tear=path;assert(!boot.add(key(3),b,"Third",id(4),4));NoteHistory::Reader after(fs);assert(after.begin());assert(after.current()->key==key(1)&&after.current()->page==5);fs.tear="";
 }
 fs.fail="/reader";assert(!boot.checkpoint(key(1),6,true));assert(boot.current()->page==5);fs.fail="";
 assert(!boot.add(key(1),b,"Collision",id(5),4));assert(!boot.checkpoint(key(1),8));
 // Corrupt one source: retain other answers. Corrupt index: refuse to overwrite.
 Memory damaged=fs;damaged.disk["/a"+key(1)][18]^=1;NoteHistory::Reader salvage(damaged);assert(salvage.begin());assert(salvage.current()->key==key(2));
 damaged=fs;damaged.disk["/reader"][9]^=1;NoteHistory::Reader reject(damaged);assert(!reject.begin());
 damaged=fs;damaged.disk["/reader"]=std::string(20000,'x');NoteHistory::Reader oversized(damaged);assert(!oversized.begin());
 Memory many;NoteHistory::Reader ring(many);assert(ring.begin());
 for(int i=0;i<20;++i)assert(ring.add(key(i),a,"Task",id(i),8));
 assert(ring.entries().size()==12);assert(!ring.load(key(0),restored));assert(ring.load(key(19),restored));
 assert(ring.erase(key(19)));NoteHistory::Reader again(many);assert(again.begin());assert(again.entries().size()==11&&again.current()->key==key(18));
 NoteHistory::Source large{std::string(65536,'x'),2,true};assert(ring.add(key(30),large,"Max",id(21),2000));assert(ring.load(key(30),restored)&&restored.text==large.text);
 large.text+='x';assert(!ring.add(key(31),large,"Over",id(22),2000));
 // Every page, including graphs/legends, uses its own question's page count.
 std::ifstream in(argv[1]);std::string json((std::istreambuf_iterator<char>(in)),{});NoteAnswer::Document doc;assert(NoteAnswer::parse(json,2,doc));
 std::string last;size_t n=0,count=0;int graph=0;
 for(auto&p:doc.pages){
  if(p.task!=last){if(n)assert(n==count);last=p.task;n=0;count=p.taskPages;}
  assert(!p.task.empty()&&p.taskPage==++n&&p.taskPages==count);
  std::string counter=std::to_string(p.taskPage)+"/"+std::to_string(p.taskPages);
  assert(NoteText::width(NoteAnswer::heading(p),NoteFont::font16)+NoteText::width(counter,NoteFont::font16)+12<=192);
  Raster r;NoteText::draw(r,NoteAnswer::heading(p),4,16,NoteFont::font16);NoteText::draw(r,counter,196-NoteText::width(counter,NoteFont::font16),16,NoteFont::font16);
  if(p.graphic){NoteGraph::draw(r,p.graph);r.save("/tmp/not-history-graph-"+std::to_string(++graph)+".pgm");}
  else for(size_t i=0;i<p.lines.size();++i)NoteText::draw(r,p.lines[i],4,21+NoteFont::font18.ascent+i*NoteFont::font18.lineHeight,NoteFont::font18);
 }
 assert(n==count&&graph==3);
 NoteAnswer::Page longTitle;longTitle.task=std::string(100,'W')+"größe";longTitle.taskPage=9999;longTitle.taskPages=10000;
 assert(NoteText::width(NoteAnswer::heading(longTitle),NoteFont::font16)+NoteText::width("9999/10000",NoteFont::font16)+12<=192);
 std::cout<<"PASS offline resume, per-answer cursor, physical-render dedupe, atomic-write faults, corruption, 12-record retention, 64KiB, Unicode question/graph headings\n";
}
