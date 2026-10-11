// Unsupported notation stays intact; never truncate a decimal/fraction exponent.
const upper={"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾","a":"ᵃ","b":"ᵇ","c":"ᶜ","d":"ᵈ","e":"ᵉ","f":"ᶠ","g":"ᵍ","h":"ʰ","i":"ⁱ","j":"ʲ","k":"ᵏ","l":"ˡ","m":"ᵐ","n":"ⁿ","o":"ᵒ","p":"ᵖ","r":"ʳ","s":"ˢ","t":"ᵗ","u":"ᵘ","v":"ᵛ","w":"ʷ","x":"ˣ","y":"ʸ","z":"ᶻ"};
const lower={"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉","+":"₊","-":"₋","=":"₌","(":"₍",")":"₎","a":"ₐ","e":"ₑ","o":"ₒ","x":"ₓ","h":"ₕ","k":"ₖ","l":"ₗ","m":"ₘ","n":"ₙ","p":"ₚ","s":"ₛ","t":"ₜ","i":"ᵢ","j":"ⱼ","r":"ᵣ","u":"ᵤ","v":"ᵥ"};
const base=c=>!!c&&/[A-Za-z0-9α-ωΑ-Ω]/u.test(c);
export function mathText(s){
 if(typeof s!=='string')return s;
 let out='';
 for(let i=0;i<s.length;){
  const marker=s[i];if(marker!=='^'&&marker!=='_'){out+=s[i++];continue;}let left=i;while(left>0&&base(s[left-1]))left--;
  if(!(marker==='^'&&(s[left-1]==='^'||(s[left-1]==='-'&&s[left-2]==='^')))&&((i>left&&i-left<=3)||(marker==='^'&&/^[)\]]$/.test(s[i-1]||'')))){
   const map=marker==='^'?upper:lower;let start=i+1,end=start,after=start;
   const close=s[start]==='{'?'}':s[start]==='('?')':null;
   if(close){start++;end=s.indexOf(close,start);after=end+1;}
   else {if(s[end]==='+'||s[end]==='-')end++;while(/[0-9]/.test(s[end]||'!'))end++;if(end===start&&map[s[end]])end++;after=end;}
   const raw=s.slice(start,end),chars=[...raw];
   if(end>start&&raw.length<=32&&chars.every(c=>map[c])&&/[0-9a-z]/.test(raw)&&!base(s[after])&&s[after]!=='.'&&(marker!=='^'||s[after]!=='^')){
    out+=chars.map(c=>map[c]).join('');i=after;continue;
   }
   if(close){if(end<0){out+=s.slice(i);break;}out+=s.slice(i,after);i=after;continue;}
  }
  out+=s[i++];
 }
 return out;
}
