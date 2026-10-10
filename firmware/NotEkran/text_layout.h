#pragma once
#include <string>
#include <vector>
// Deliberate ASCII fallback for the built-in GFX font, never split UTF-8 bytes.
inline std::string normalizeText(const std::string &in){
 std::string out;
 for(size_t i=0;i<in.size();){
  unsigned char c=in[i];
  if(c<128){if(c=='\n'||c>=32)out+=char(c);else if(c=='\t')out+=' ';++i;continue;}
  const std::pair<std::string,std::string> table[]={
   {"ç","c"},{"Ç","C"},{"ğ","g"},{"Ğ","G"},{"ı","i"},{"İ","I"},{"ö","o"},{"Ö","O"},{"ş","s"},{"Ş","S"},{"ü","u"},{"Ü","U"},{"ß","ss"},{"é","e"},{"€","EUR"},{"×","x"},{"÷","/"},{"−","-"},{"–","-"},{"—","-"},{"’","'"},{"“","\""},{"”","\""},{"…","..."}};
  bool matched=false;for(const auto &p:table){if(in.compare(i,p.first.size(),p.first)==0){out+=p.second;i+=p.first.size();matched=true;break;}}
  if(matched)continue;
  ++i;while(i<in.size()&&((unsigned char)in[i]&0xc0)==0x80)++i;out+='?';
 }
 return out;
}
inline std::vector<std::string> wrapText(const std::string &text,size_t width){
 std::vector<std::string> lines;if(!width)return lines;
 size_t start=0;
 do{
  size_t end=text.find('\n',start);if(end==std::string::npos)end=text.size();
  std::string rest=text.substr(start,end-start);
  while(rest.size()>width){size_t cut=rest.rfind(' ',width);if(cut==std::string::npos||cut==0)cut=width;lines.push_back(rest.substr(0,cut));rest.erase(0,cut);while(!rest.empty()&&rest[0]==' ')rest.erase(0,1);}
  lines.push_back(rest);if(end==text.size())break;start=end+1;
 }while(start<=text.size());
 return lines;
}
