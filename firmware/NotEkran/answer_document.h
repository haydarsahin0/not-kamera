#pragma once
#include <cJSON.h>
#include "graph_view.h"

namespace NoteAnswer {
constexpr const char* FORMAT="not-ekran-answer-v1";
struct Page {bool graphic=false;std::vector<std::string> lines;NoteGraph::Graph graph;};
struct Document {std::vector<Page> pages;};
inline void addText(Document&d,const std::string&s,int size){
 if(s.empty())return;
 auto lines=NoteText::wrap(NoteText::normalize(s),192,NoteText::font(size));size_t rows=160/NoteText::font(size).lineHeight;
 for(size_t i=0;i<lines.size();i+=rows){Page p;p.lines.assign(lines.begin()+i,lines.begin()+std::min(lines.size(),i+rows));d.pages.push_back(std::move(p));}
}
inline const cJSON* field(const cJSON*o,const char*n){return cJSON_GetObjectItemCaseSensitive(o,n);}
inline bool text(const cJSON*o,const char*n,std::string&out,size_t cap){auto v=field(o,n);if(!cJSON_IsString(v)||!v->valuestring||std::string(v->valuestring).size()>cap)return false;out=NoteText::normalize(v->valuestring);return true;}
inline bool coord(const cJSON*v,float&out){if(!cJSON_IsNumber(v)||!std::isfinite(v->valuedouble)||v->valuedouble<0||v->valuedouble>100)return false;out=v->valuedouble;return true;}
inline bool point(const cJSON*v,NoteGraph::Point&out){return cJSON_IsObject(v)&&coord(field(v,"x"),out.x)&&coord(field(v,"y"),out.y);}
inline bool list(const cJSON*v,int min,int max){return cJSON_IsArray(v)&&cJSON_GetArraySize(v)>=min&&cJSON_GetArraySize(v)<=max;}
inline bool label(const cJSON*o,const char*n,std::string&s,int pixels){return text(o,n,s,48)&&!s.empty()&&NoteText::width(s,NoteFont::font16)<=pixels;}
inline bool graph(const cJSON*v,NoteGraph::Graph&g){
 if(!cJSON_IsObject(v)||!text(v,"title",g.title,160)||!label(v,"x_label",g.xLabel,90)||!label(v,"y_label",g.yLabel,90))return false;
 auto curves=field(v,"curves"),marks=field(v,"points"),arrows=field(v,"arrows"),xt=field(v,"x_ticks"),yt=field(v,"y_ticks");
 if(!list(curves,1,3)||!list(marks,0,3)||!list(arrows,0,3)||!list(xt,0,3)||!list(yt,0,3))return false;
 const cJSON*i;
 cJSON_ArrayForEach(i,curves){NoteGraph::Curve c;auto pts=field(i,"points"),dash=field(i,"dashed");if(!label(i,"label",c.label,64)||!point(field(i,"label_at"),c.anchor)||!cJSON_IsBool(dash)||!list(pts,2,24))return false;c.dashed=cJSON_IsTrue(dash);const cJSON*p;cJSON_ArrayForEach(p,pts){NoteGraph::Point a;if(!point(p,a))return false;c.points.push_back(a);}g.curves.push_back(std::move(c));}
 cJSON_ArrayForEach(i,marks){NoteGraph::Mark m;if(!label(i,"label",m.label,64)||!point(field(i,"at"),m.at))return false;g.marks.push_back(std::move(m));}
 cJSON_ArrayForEach(i,arrows){NoteGraph::Arrow a;if(!point(field(i,"from"),a.from)||!point(field(i,"to"),a.to))return false;g.arrows.push_back(a);}
 for(int axis=0;axis<2;++axis){auto ticks=axis?yt:xt;auto&dest=axis?g.yTicks:g.xTicks;cJSON_ArrayForEach(i,ticks){NoteGraph::Tick t;if(!label(i,"label",t.label,axis?26:42)||!coord(field(i,"value"),t.value))return false;
   for(auto&old:dest){if(std::abs(old.value-t.value)<(axis?22:34))return false;}
   dest.push_back(t);}}
 return NoteGraph::readable(g);
}
// Parse completely before swapping the active reader state. Malformed/oversized
// structured answers are never displayed as JSON or acknowledged as delivered.
inline bool parse(const std::string&s,int size,Document&out){
 if(s.empty()||s.size()>65536)return false;
 Document next;
 size_t begin=s.find_first_not_of(" \n\r\t");
 if(begin==std::string::npos)return false;
 if(s[begin]!='{'){addText(next,s,size);out=std::move(next);return true;}
 const char*end=nullptr;cJSON*root=cJSON_ParseWithOpts(s.c_str(),&end,true);
 if(!root){addText(next,s,size);out=std::move(next);return true;}
 auto fmt=field(root,"format");if(!cJSON_IsString(fmt)||std::string(fmt->valuestring)!=FORMAT){cJSON_Delete(root);addText(next,s,size);out=std::move(next);return true;}
 auto sections=field(root,"sections");bool ok=list(sections,1,24);int count=0;const cJSON*section;
 if(ok)cJSON_ArrayForEach(section,sections){std::string task,body;auto graphs=field(section,"graphs");if(!text(section,"task",task,160)||!text(section,"text",body,65536)||!list(graphs,0,4)){ok=false;break;}
  addText(next,task+(body.empty()?"":"\n"+body),size);const cJSON*v;
  cJSON_ArrayForEach(v,graphs){if(++count>12){ok=false;break;}Page p;p.graphic=true;if(!graph(v,p.graph)){ok=false;break;}
   addText(next,task+"\n"+p.graph.title,size);NoteGraph::Probe probe;auto legend=NoteGraph::draw(probe,p.graph);next.pages.push_back(std::move(p));
   std::string key;for(auto&entry:legend)key+=entry+"\n";addText(next,key,size);
  }if(!ok)break;
 }
 cJSON_Delete(root);if(!ok||next.pages.empty()||next.pages.size()>10000)return false;out=std::move(next);return true;
}
} // namespace NoteAnswer
