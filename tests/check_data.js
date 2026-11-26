// 데이터 무결성 검사: node tests/check_data.js        (1학기)
//                     node tests/check_data.js sem2   (2학기)
const fs=require("fs"),path=require("path"),vm=require("vm");
const ed=process.argv[2]||"";
const SRC=path.join(__dirname,"..","src");
const files=ed?fs.readdirSync(path.join(SRC,ed)).filter(f=>f.endsWith(".js")).sort().map(f=>path.join(SRC,ed,f))
              :["data.js","data2.js"].map(f=>path.join(SRC,f));
const code=files.map(f=>fs.readFileSync(f,"utf8")).join("\n")+
  "\n;({CARDS,SOURCES,EVENTS,ESSAYS,EDITION:typeof EDITION!=='undefined'?EDITION:null})";
const {CARDS,SOURCES,EVENTS,ESSAYS,EDITION}=vm.runInNewContext(code,{});
let bad=0;const fail=m=>{console.log("✗",m);bad++;};
const units=EDITION?new Set(Object.keys(EDITION.units).map(Number)):null;
const cats=EDITION?new Set(Object.keys(EDITION.cats)):null;
const okU=(u,id)=>{if(units&&!units.has(u))fail("없는 단원 "+id);};
const okC=(c,id)=>{if(cats&&!cats.has(c))fail("없는 색 "+id);};
const ids=new Set();const groups={};
for(const c of CARDS){if(c.length!==9)fail("카드 길이 "+c[0]);if(ids.has(c[0]))fail("중복 id "+c[0]);ids.add(c[0]);okU(c[1],c[0]);okC(c[2],c[0]);(groups[c[3]]=groups[c[3]]||new Set()).add(c[5]);if(!/\d+쪽/.test(c[6]))fail("쪽수 없음 "+c[0]);if(c[3]==="연도"&&!/^\d{4}$/.test(c[5]))fail("연도 답 형식 "+c[0]);}
for(const c of CARDS){if(c[3]==="연도")continue;const pool=new Set([...groups[c[3]]].filter(a=>a!==c[5]));c[8].split("|").filter(Boolean).forEach(x=>pool.add(x));if(pool.size<3)fail("오답 보기 부족 "+c[0]);}
const sids=new Set();
for(const s of SOURCES){if(s.length!==8)fail("사료 길이 "+s[0]);if(sids.has(s[0]))fail("중복 사료 id "+s[0]);sids.add(s[0]);okU(s[1],s[0]);okC(s[2],s[0]);const x=s[6].split("|");if(x.length!==3)fail("사료 보기 수 "+s[0]);if(x.includes(s[5]))fail("사료 보기에 정답 "+s[0]);if(new Set(x).size!==3)fail("사료 보기 중복 "+s[0]);if(!/\d+쪽/.test(s[7]))fail("사료 쪽수 "+s[0]);}
for(const e of EVENTS){if(e.length!==5)fail("연표 길이 "+e[0]);okU(e[3],e[0]);if(!(e[2]>=0&&e[2]<=12))fail("연표 월 "+e[0]);}
const eids=new Set();
for(const e of ESSAYS){if(e.length!==6)fail("서술형 길이 "+e[0]);if(eids.has(e[0]))fail("중복 서술형 id "+e[0]);eids.add(e[0]);okU(e[1],e[0]);if(!/\d+쪽/.test(e[5]))fail("서술형 쪽수 "+e[0]);}
console.log(`카드 ${CARDS.length} · 사료 ${SOURCES.length} · 연표 ${EVENTS.length} · 서술형 ${ESSAYS.length}`);
console.log(bad?`문제 ${bad}개`:"모두 통과");process.exit(bad?1:0);
