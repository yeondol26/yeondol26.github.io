// 데이터 무결성 검사: node tests/check_data.js
const fs=require("fs"),path=require("path");
const src=f=>fs.readFileSync(path.join(__dirname,"..","src",f),"utf8").replace(/const (CARDS|SOURCES|EVENTS|ESSAYS)/g,"global.$1");
eval(src("data.js")+src("data2.js"));
let bad=0;const fail=m=>{console.log("✗",m);bad++;};
const ids=new Set();const groups={};
for(const c of CARDS){if(c.length!==9)fail("카드 길이 "+c[0]);if(ids.has(c[0]))fail("중복 id "+c[0]);ids.add(c[0]);(groups[c[3]]=groups[c[3]]||new Set()).add(c[5]);if(!/\d+쪽/.test(c[6]))fail("쪽수 없음 "+c[0]);}
for(const c of CARDS){if(c[3]==="연도")continue;const pool=new Set([...groups[c[3]]].filter(a=>a!==c[5]));c[8].split("|").filter(Boolean).forEach(x=>pool.add(x));if(pool.size<3)fail("오답 보기 부족 "+c[0]);}
for(const s of SOURCES){if(s.length!==8)fail("사료 길이 "+s[0]);const x=s[6].split("|");if(x.length!==3)fail("사료 보기 수 "+s[0]);if(x.includes(s[5]))fail("사료 보기에 정답 "+s[0]);if(!/\d+쪽/.test(s[7]))fail("사료 쪽수 "+s[0]);}
for(const e of EVENTS)if(e.length!==5)fail("연표 길이 "+e[0]);
for(const e of ESSAYS)if(e.length!==6)fail("서술형 길이 "+e[0]);
console.log(`카드 ${CARDS.length} · 사료 ${SOURCES.length} · 연표 ${EVENTS.length} · 서술형 ${ESSAYS.length}`);
console.log(bad?`문제 ${bad}개`:"모두 통과");process.exit(bad?1:0);
