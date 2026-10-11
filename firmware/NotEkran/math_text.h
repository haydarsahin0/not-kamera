#pragma once
#include <string>
#include <stdint.h>
namespace NoteMath {
inline bool base(unsigned char c){return (c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9');}
inline const char *script(char c,bool upper){
 static const char* supers[]={"⁰","¹","²","³","⁴","⁵","⁶","⁷","⁸","⁹"};
 static const char* subs[]={"₀","₁","₂","₃","₄","₅","₆","₇","₈","₉"};
 if(c>='0'&&c<='9')return upper?supers[c-'0']:subs[c-'0'];
 if(c=='+')return upper?"⁺":"₊";if(c=='-')return upper?"⁻":"₋";
 if(c=='=')return upper?"⁼":"₌";if(c=='(')return upper?"⁽":"₍";if(c==')')return upper?"⁾":"₎";
 switch(c){
 case 'a':return upper?"ᵃ":"ₐ";
 case 'b':return upper?"ᵇ":nullptr;
 case 'c':return upper?"ᶜ":nullptr;
 case 'd':return upper?"ᵈ":nullptr;
 case 'e':return upper?"ᵉ":"ₑ";
 case 'f':return upper?"ᶠ":nullptr;
 case 'g':return upper?"ᵍ":nullptr;
 case 'h':return upper?"ʰ":"ₕ";
 case 'i':return upper?"ⁱ":"ᵢ";
 case 'j':return upper?"ʲ":"ⱼ";
 case 'k':return upper?"ᵏ":"ₖ";
 case 'l':return upper?"ˡ":"ₗ";
 case 'm':return upper?"ᵐ":"ₘ";
 case 'n':return upper?"ⁿ":"ₙ";
 case 'o':return upper?"ᵒ":"ₒ";
 case 'p':return upper?"ᵖ":"ₚ";
 case 'r':return upper?"ʳ":"ᵣ";
 case 's':return upper?"ˢ":"ₛ";
 case 't':return upper?"ᵗ":"ₜ";
 case 'u':return upper?"ᵘ":"ᵤ";
 case 'v':return upper?"ᵛ":"ᵥ";
 case 'w':return upper?"ʷ":nullptr;
 case 'x':return upper?"ˣ":"ₓ";
 case 'y':return upper?"ʸ":nullptr;
 case 'z':return upper?"ᶻ":nullptr;
 default:return nullptr;
 }
}
inline std::string format(const std::string &s){
 std::string out;out.reserve(s.size());
 for(size_t i=0;i<s.size();){
  char marker=s[i];if(marker!='^'&&marker!='_'){out+=s[i++];continue;}size_t left=i;while(left>0&&base(s[left-1]))--left;
  bool greek=i>=2&&(unsigned char)s[i-2]>=0xce&&(unsigned char)s[i-2]<=0xcf&&((unsigned char)s[i-1]&0xc0)==0x80;
  if(!(marker=='^'&&((left>0&&s[left-1]=='^')||(left>1&&s[left-1]=='-'&&s[left-2]=='^')))&&((i>left&&i-left<=3)||greek||(marker=='^'&&i>0&&(s[i-1]==')'||s[i-1]==']')))){
   bool upper=marker=='^';size_t start=i+1,end=start,after=start;
   char close=start<s.size()?(s[start]=='{'?'}':s[start]=='('?')':0):0;
   if(close){++start;end=s.find(close,start);after=end==std::string::npos?end:end+1;}
   else {if(end<s.size()&&(s[end]=='+'||s[end]=='-'))++end;while(end<s.size()&&s[end]>='0'&&s[end]<='9')++end;if(end==start&&end<s.size()&&script(s[end],upper))++end;after=end;}
   if(end!=std::string::npos&&end>start&&end-start<=32&&(after==s.size()||(!base(s[after])&&s[after]!='.'&&(marker!='^'||s[after]!='^')))){
    std::string converted;bool valid=true,operand=false;
    for(size_t j=start;j<end;++j){const char *v=script(s[j],upper);if(!v){valid=false;break;}converted+=v;if(base(s[j]))operand=true;}
    if(valid&&operand){out+=converted;i=after;continue;}
   }
   if(close){if(end==std::string::npos){out+=s.substr(i);break;}out+=s.substr(i,after-i);i=after;continue;}
  }
  out+=s[i++];
 }
 return out;
}
}
