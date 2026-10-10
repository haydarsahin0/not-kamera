#include "../NotEkran/text_layout.h"
#include <cassert>
#include <iostream>
int main(){
 assert(normalizeText("Çağrı: şüphe, İŞ, ı, ö, Ü; Größe 25€") == "Cagri: suphe, IS, i, o, U; Grosse 25EUR");
 auto a=wrapText("01234567890123456789",16);assert(a.size()==2&&a[0].size()==16&&a[1]=="6789");
 auto b=wrapText("one two three\n\nfour",7);assert((b==std::vector<std::string>{"one two","three","","four"}));
 auto c=wrapText(std::string(6000,'X'),16);assert(c.size()==375);size_t n=0;for(auto &s:c){assert(s.size()<=16);n+=s.size();}assert(n==6000);
 assert(normalizeText("A🙂B") == "A?B");
 std::cout << "Layout: UTF-8 fallback, newlines, wrapping, 6000-byte limit passed\n";
}
