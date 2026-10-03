(function(){
"use strict";
const UNITS={1:["01","제국주의 질서와 일제의 식민 통치 정책","10~19쪽"],2:["02","3·1 운동과 대한민국 임시 정부","20~29쪽"],3:["03","민족 운동의 전개와 분화","30~45쪽"],4:["04","사회·문화의 변화와 대중 운동","46~55쪽"],5:["05","독립 국가 건설 노력","56~61쪽"]};
const CAT={r:"일제 정책·탄압",b:"국내 민족 운동",g:"국외 무장·의열",p:"대한민국 임시 정부",o:"사회·문화",w:"국제 정세"};
const KIND={mc:"카드 객관식",wr:"카드 주관식",src:"사료",tl:"연표 순서",ess:"서술형",ox:"O/X",rev:"설명 고르기",pair:"먼저 일어난 사건"};
const LVNAME=["다시 보기","1단계","2단계","3단계","외움"];
const INTERVAL={1:1,2:2,3:3};
const DEFAULT_EXAM="2026-10-12";
const LSKEY="ilje-cards-v1";
const SUFFIX=["전투","대첩","운동","사건","정책","계획","사업","회의","의거","선언","회담","협정","학살","참변"];

const cards=CARDS.map(c=>({id:c[0],u:c[1],cat:c[2],g:c[3],q:c[4],a:c[5],note:c[6],alts:c[7]?c[7].split("|"):[],x:c[8]?c[8].split("|"):[]}));
const pageOf=c=>{const m=c.note.match(/(\d+)(?:,\s*\d+)*쪽/);return m?+m[1]:999;};
cards.forEach((c,i)=>{c.pg=pageOf(c);c.ord=i;});
cards.sort((a,b)=>a.u-b.u||a.pg-b.pg||a.ord-b.ord);
const byId=Object.fromEntries(cards.map(c=>[c.id,c]));
const firstPage=t=>{const m=String(t).match(/(\d+)(?:[,~]\s*\d+)*쪽/);return m?+m[1]:999;};
const srcs=SOURCES.map(s=>({id:s[0],u:s[1],cat:s[2],q:s[3],text:s[4],a:s[5],x:s[6].split("|"),cite:s[7],pg:firstPage(s[7])}));
const srcById=Object.fromEntries(srcs.map(s=>[s.id,s]));
const events=EVENTS.map((e,i)=>({i,label:e[0],y:e[1],m:e[2],u:e[3],pg:e[4]}));
const essays=ESSAYS.map(e=>({id:e[0],u:e[1],q:e[2],model:e[3],kws:e[4].split(";").map(g=>g.split("|")),pg:e[5],pn:firstPage(e[5])}));
const essById=Object.fromEntries(essays.map(e=>[e.id,e]));
const TOTAL=cards.length;

/* 학습 순서: 교과서 순서 20장씩 묶어 새 묶음 1회 → 앞 묶음 2회 → 그 앞 묶음 3회 */
const BATCH=20;
const batches=[];for(let i=0;i<cards.length;i+=BATCH)batches.push(cards.slice(i,i+BATCH));
const LADDER=[];
for(let n=1;n<=batches.length+2;n++)for(let r=1;r<=3;r++){const b=n-r+1;if(b>=1&&b<=batches.length)LADDER.push({b,r});}

/* 날짜 */
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse=s=>{const p=s.split("-").map(Number);return new Date(p[0],p[1]-1,p[2],12);};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return ymd(d);};
const diffDays=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const today=()=>ymd(new Date());
const md=s=>{const p=s.split("-");return (+p[1])+"/"+(+p[2]);};

/* 상태 */
function fresh(exam){return {v:1,exam:exam||DEFAULT_EXAM,cards:{},streak:{last:"",n:0},days:{},src:{},ess:{},ustat:{},kstat:{},mocks:[],utest:{},total:0,updatedAt:0,ladder:{i:0}};}
function normalize(o){
  if(o.ladder===undefined&&o.cards)o.ladder={i:inferLadder(o.cards)};
  const f=fresh();for(const k in f)if(o[k]===undefined)o[k]=f[k];return o;
}
/* 학습 순서가 생기기 전 기록: 앞에서부터 다 본 묶음 수로 위치를 정한다 */
function inferLadder(cs){
  let k=0;while(k<batches.length&&batches[k].every(c=>(cs[c.id]||{}).s))k++;
  return k?LADDER.findIndex(x=>x.b===k&&x.r===1)+1:0;
}
let S=fresh();
try{const raw=localStorage.getItem(LSKEY);if(raw){const o=JSON.parse(raw);if(o&&o.v===1)S=normalize(o);}}catch(e){}

const st=id=>S.cards[id];
function levelOf(id){const s=st(id);return s&&s.s?s.l:-1;}
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const pick=(a,n)=>shuffle(a.slice()).slice(0,n);
const esc=s=>String(s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const norm=s=>String(s).normalize("NFC").toLowerCase().replace(/[\s·ㆍ・.,\-–~'"‘’“”『』「」()\[\]%:]/g,"");
const pct=(c,a)=>a?Math.round(c/a*100):0;

/* 저장: 이 기기 + 계정 */
let remote=null,writing=false,again=false,rTimer=null;
function save(){
  S.updatedAt=Date.now();
  try{localStorage.setItem(LSKEY,JSON.stringify(S));}catch(e){}
  if(remote){clearTimeout(rTimer);rTimer=setTimeout(push,1500);}
}
async function push(){
  if(!remote)return;
  if(writing){again=true;return;}
  writing=true;
  try{await remote.set(JSON.parse(JSON.stringify(S)));setSync(true);}
  catch(e){const c=e&&e.code;if(c==="unavailable")setTimeout(push,4000+Math.random()*2000);else{remote=null;setSync(false);}}
  writing=false;
  if(again){again=false;push();}
}
function setSync(on){
  const el=document.getElementById("sync");if(!el)return;
  el.classList.toggle("on",!!on);
  el.querySelector("span").textContent=on?"계정에 저장 중 (기기 간 공유)":"이 기기에만 저장";
}
function adopt(snap){
  if(!snap||!snap.exists)return;
  const r=snap.data();if(!r||r.v!==1)return;
  const ru=r.updatedAt||0,lu=S.updatedAt||0;
  if(ru>lu){
    if(session)return;
    S=normalize(JSON.parse(JSON.stringify(r)));
    try{localStorage.setItem(LSKEY,JSON.stringify(S));}catch(e){}
    syncTotal();render();
  }else if(ru<lu)push();
}
async function initRemote(){
  if(!(window.claude&&typeof window.claude.use==="function"))return;
  try{
    const db=await window.claude.use("db");const user=await window.claude.use("user");
    if(!db||!user)return;
    const uid=await user.id();if(!uid)return;
    const ref=db.doc("data/users/"+uid+"/progress");
    const snap=await ref.get();
    remote=ref;setSync(true);
    if(snap.exists)adopt(snap);else if(S.updatedAt)push();
  }catch(e){remote=null;setSync(false);}
}
document.addEventListener("visibilitychange",async()=>{
  if(document.visibilityState==="visible"&&remote&&!session){try{adopt(await remote.get());}catch(e){}}
});

/* 하루 계획 */
const daysLeft=()=>diffDays(today(),S.exam);
const unseen=()=>cards.filter(c=>levelOf(c.id)<0);
function planNew(already){
  const left=daysLeft(),un=unseen().length;
  if(!un)return already;
  return already+Math.ceil(un/(left>0?Math.max(1,left-2):1));
}
function dayRec(){
  const t=today();let d=S.days[t];
  if(!d){d={p:planNew(0),n:0,a:0,c:0};S.days[t]=d;}
  return d;
}
function syncTotal(){if(S.total!==TOTAL){const d=dayRec();if(!d.n)d.p=planNew(0);S.total=TOTAL;}}
function dueList(){const t=today();return cards.filter(c=>{const s=st(c.id);return s&&s.s&&s.l<4&&(s.l===0||(s.d&&s.d<=t));});}
const newLeft=()=>Math.min(Math.max(0,dayRec().p-dayRec().n),unseen().length);
function sched(n){
  const t=today();let d=addDays(t,n);
  if(S.exam&&d>=S.exam){const b=addDays(S.exam,-1);d=b>t?b:addDays(t,1);}
  return d;
}
function streakNow(){const t=today(),l=S.streak.last;return (l===t||l===addDays(t,-1))?S.streak.n:0;}
function touchStreak(){const t=today();if(S.streak.last!==t){S.streak.n=(S.streak.last===addDays(t,-1))?S.streak.n+1:1;S.streak.last=t;}}
function stat(u,kind,score){
  const d=dayRec();d.a++;d.c+=score;
  if(u){const x=S.ustat[u]||(S.ustat[u]=[0,0]);x[0]++;x[1]+=score;}
  const k=S.kstat[kind]||(S.kstat[kind]=[0,0]);k[0]++;k[1]+=score;
  touchStreak();
}

/* 배운 범위: 본 카드 중 가장 뒤 쪽까지 */
function frontier(){let m=0;cards.forEach(c=>{if(levelOf(c.id)>=0&&c.pg<999&&c.pg>m)m=c.pg;});return m;}
function scope(){const f=frontier();return {f,src:srcs.filter(s=>s.pg<=f),ev:events.filter(e=>e.pg<=f),ess:essays.filter(e=>e.pn<=f)};}
function canTl(evs){if(evs.length<4)return false;const ys=new Set(evs.map(e=>e.y));return ys.size>=4;}

/* 문제 만들기 */
function cardItem(c,mode){return {k:"card",id:c.id,mode:mode||modeFor(c.id)};}
function modeFor(id){const l=levelOf(id);return l<0?"learn":(l===0?"mc":"write");}
function makeOpts(c){
  const ds=[];
  if(c.g==="연도"){const y=+c.a;shuffle([-4,-3,-2,-1,1,2,3,4]).slice(0,3).forEach(k=>ds.push(String(y+k)));}
  else{
    const seen=new Set([norm(c.a)]);
    const add=v=>{const k=norm(v);if(ds.length<3&&!seen.has(k)){seen.add(k);ds.push(v);}};
    shuffle(c.x.slice()).forEach(add);
    shuffle(cards.filter(o=>o.g===c.g).map(o=>o.a)).forEach(add);
    shuffle(cards.filter(o=>o.u===c.u).map(o=>o.a)).forEach(add);
  }
  return shuffle([c.a].concat(ds));
}
function grade(c,input){
  const n=norm(input);if(!n)return false;
  const ts=[c.a].concat(c.alts).map(norm);
  if(ts.includes(n))return true;
  return ts.some(t=>n.length>=2&&t.startsWith(n)&&SUFFIX.includes(t.slice(n.length)));
}
const evKey=e=>e.y*100+e.m;
function compatible(a,b){return a.y!==b.y||(a.m&&b.m&&a.m!==b.m);}
function tlItem(evs){
  const pool=shuffle((evs||events).slice());
  const first=pool[0],chosen=[first];
  const near=pool.filter(e=>e!==first&&Math.abs(e.y-first.y)<=10);
  for(const e of near.concat(pool)){if(chosen.length>=4)break;if(!chosen.includes(e)&&chosen.every(c=>compatible(c,e)))chosen.push(e);}
  return {k:"tl",ev:shuffle(chosen.map(e=>e.i)),order:[]};
}
function srcScore(s){const r=S.src[s.id];return r?(r.r/(r.t||1))+r.t*0.01:-1;}
function srcItems(n,u,pool){
  let list=(pool||srcs).filter(s=>!u||s.u===u);
  list=shuffle(list).sort((a,b)=>srcScore(a)-srcScore(b)).slice(0,n);
  return shuffle(list).map(s=>({k:"src",id:s.id,opts:shuffle([s.a].concat(s.x))}));
}
function essItems(n,pool){
  const sc=e=>{const r=S.ess[e.id];return r?r.best*10+r.n:-1;};
  return shuffle((pool||essays).slice()).sort((a,b)=>sc(a)-sc(b)).slice(0,n).map(e=>({k:"ess",id:e.id}));
}
function kwHits(e,text){const n=norm(text);return e.kws.map(g=>g.some(w=>n.includes(norm(w))));}

/* 문제 은행: 같은 사실로 여러 형태의 문제 만들기 */
const revOK=c=>c.g!=="연도"&&c.g!=="수치"&&/(은|는)\?$/.test(c.q);
const descOf=c=>c.q.replace(/(은|는)\?$/,"");
function revItem(c){
  const an=norm(c.a);const seen=new Set([an]);const ds=[];
  const pool=shuffle(cards.filter(o=>o.g===c.g&&revOK(o))).concat(shuffle(cards.filter(o=>o.u===c.u&&revOK(o))));
  for(const o of pool){const k=norm(o.a);if(ds.length<3&&!seen.has(k)){seen.add(k);ds.push(descOf(o));}}
  return {k:"rev",id:c.id,ans:descOf(c),opts:shuffle([descOf(c)].concat(ds))};
}
function oxItem(c){
  const truth=Math.random()<.5;
  const shown=truth?c.a:makeOpts(c).find(o=>norm(o)!==norm(c.a));
  return {k:"ox",id:c.id,shown,truth};
}
function pairItem(evs){
  const pool=shuffle((evs||events).slice());const a=pool[0];
  const b=pool.find(e=>e!==a&&compatible(a,e));
  const first=evKey(a)<evKey(b)?a:b;
  return {k:"pair",ev:[a.i,b.i],ans:first.label,opts:shuffle([a.label,b.label])};
}
function bankItems(n,full){
  const sc=scope();const useAll=full||!sc.f;
  const cs=cards.filter(c=>useAll||c.pg<=sc.f);
  const ss=useAll?srcs:sc.src,ev=useAll||!canTl(sc.ev)?events:sc.ev;
  const out=[];
  for(let i=0;i<n;i++){
    const r=Math.random(),c=cs[Math.floor(Math.random()*cs.length)];
    if(r<.35)out.push(oxItem(c));
    else if(r<.6){const rc=shuffle(cs.filter(revOK))[0];out.push(rc?revItem(rc):oxItem(c));}
    else if(r<.75)out.push(cardItem(c,"mc"));
    else if(r<.9&&ss.length){const s=ss[Math.floor(Math.random()*ss.length)];out.push({k:"src",id:s.id,opts:shuffle([s.a].concat(s.x))});}
    else out.push(pairItem(ev));
  }
  return out;
}
function startBank(full){begin("drill",bankItems(20,full),{bank:true,full:!!full});}
function applyGen(item,ok){
  const u=item.k==="pair"?0:byId[item.id].u;
  stat(u,item.k,ok?1:0);
  if(!ok&&item.k!=="pair"){const s=st(item.id);if(s&&s.s)s.w=(s.w||0)+1;addWrong({k:"card",id:item.id});}
}
const ansOf=it=>it.k==="card"?byId[it.id].a:it.k==="src"?srcById[it.id].a:it.ans;

/* 세션 */
let session=null,view="today",resetAsk=false,fbAt=0,scrollCur=false;
function begin(kind,items,opt){
  if(!items.length)return;
  session=Object.assign({kind,items,i:0,answered:0,score:0,wrong:[],fb:null,done:false,start:Date.now()},opt||{});
  if(session.mock){session.ans=[];session.sel=null;}
  render();
}
function startToday(){
  const rev=shuffle(dueList()).map(c=>cardItem(c));
  const news=unseen().slice(0,newLeft()).map(c=>cardItem(c,"learn"));
  begin("today",rev.concat(news));
}
function deepPlan(){
  const sc=scope();const tl=canTl(sc.ev)?2:0;const es=sc.ess.length?1:0;
  const ns=Math.min(sc.src.length,4+(2-tl)+(1-es));
  return {sc,ns,tl,es,ok:ns+tl+es>=3};
}
function startDeep(full){
  if(full){begin("deep",srcItems(4).concat([tlItem(),tlItem()]).concat(essItems(1)),{full:true});return;}
  const d=deepPlan();if(!d.ok)return startDeep(true);
  const items=srcItems(d.ns,0,d.sc.src);
  for(let i=0;i<d.tl;i++)items.push(tlItem(d.sc.ev));
  begin("deep",items.concat(essItems(d.es,d.sc.ess)));
}
function startMock(){
  const items=[];
  for(let u=1;u<=5;u++){
    const pool=shuffle(cards.filter(c=>c.u===u));
    items.push(cardItem(pool[0],"mc"),cardItem(pool[1],Math.random()<.5?"write":"mc"));
  }
  const su=[1,2,3,4,5,1+Math.floor(Math.random()*5)];
  const usedS=new Set();
  su.forEach(u=>{const c=shuffle(srcs.filter(s=>s.u===u&&!usedS.has(s.id)))[0];if(c){usedS.add(c.id);items.push({k:"src",id:c.id,opts:shuffle([c.a].concat(c.x))});}});
  items.sort((a,b)=>unitOf(a)-unitOf(b));
  for(let i=0;i<4;i++)items.push(tlItem());
  begin("mock",items,{mock:true});
}
function unitOf(it){return it.k==="card"?byId[it.id].u:it.k==="src"?srcById[it.id].u:it.k==="ess"?essById[it.id].u:9;}
function requeue(id){
  const it=session.items;
  for(let k=session.i+1;k<it.length;k++)if(it[k].k==="card"&&it[k].id===id)return;
  it.splice(Math.min(it.length,session.i+4),0,{k:"card",id,mode:"mc"});
}
function addWrong(w){if(!session.wrong.some(x=>x.k===w.k&&x.id===w.id))session.wrong.push(w);}

/* 채점 반영 */
function applyCard(item,ok){
  const id=item.id,c=byId[id],wasNew=levelOf(id)<0;
  const s=S.cards[id]||(S.cards[id]={l:0,d:null,w:0,s:true});
  s.s=true;s.t=(s.t||0)+1;if(ok)s.r=(s.r||0)+1;
  stat(c.u,item.mode==="mc"?"mc":"wr",ok?1:0);
  if(ok){
    if(item.mode==="mc"){if(s.l<1){s.l=1;s.d=sched(1);}}
    else if(s.l<4){s.l=s.l+1;s.d=s.l>=4?null:sched(INTERVAL[s.l]);}
    if(session.ladder&&session.ladder.r===3&&item.mode==="write"){s.l=4;s.d=null;}
  }else{
    s.w=(s.w||0)+1;s.l=0;s.d=null;
    addWrong({k:"card",id});
    if(!session.mock&&!session.test)requeue(id);
    if(session.test&&wasNew)s.s=false;
  }
}
function applyMockCard(item,ok){
  const id=item.id,c=byId[id];
  const s=S.cards[id];
  stat(c.u,item.mode==="mc"?"mc":"wr",ok?1:0);
  if(s&&s.s){s.t=(s.t||0)+1;if(ok)s.r=(s.r||0)+1;}
  if(!ok){
    if(s&&s.s){s.w=(s.w||0)+1;s.l=0;s.d=null;}
    else S.cards[id]={l:0,d:null,w:1,s:false};
    addWrong({k:"card",id});
  }
}
function applySrc(id,ok){
  const s=srcById[id];const r=S.src[id]||(S.src[id]={t:0,r:0,w:0});
  r.t++;if(ok)r.r++;else{r.w++;addWrong({k:"src",id});}
  stat(s.u,"src",ok?1:0);
}
function applyTl(ok){stat(0,"tl",ok?1:0);if(!ok)addWrong({k:"tl",id:"tl"+session.i});}
function applyEss(id,rating){
  const e=essById[id];const r=S.ess[id]||(S.ess[id]={n:0,best:0});
  r.n++;const v=rating==="full"?2:rating==="part"?1:0;if(v>r.best)r.best=v;
  stat(e.u,"ess",v/2);
}
function commit(item,ok,extra){
  session.answered++;session.score+=ok===true?1:(typeof ok==="number"?ok:0);
  if(item.k==="card")(session.mock?applyMockCard:applyCard)(item,ok);
  else if(item.k==="src")applySrc(item.id,ok);
  else if(item.k==="tl")applyTl(ok);
  else if(item.k==="ess")applyEss(item.id,extra);
  else applyGen(item,ok);
  if(session.mock)session.ans[session.i]={ok,given:extra};
  save();
}
function learned(){
  const it=session.items[session.i];
  if(levelOf(it.id)<0){const prev=S.cards[it.id];S.cards[it.id]={l:0,d:null,w:prev?prev.w||0:0,s:true};dayRec().n++;touchStreak();save();}
  requeue(it.id);
  advance();
}
function advance(){
  session.fb=null;session.sel=null;session.i++;
  if(session.i>=session.items.length)finish();
  render();
}
function finish(){
  session.done=true;
  if(session.ladder&&S.ladder.i===session.ladder.i){S.ladder.i++;save();}
  if(session.unitTest){const sc=pct(session.score,session.answered);S.utest[session.unitTest]=Math.max(S.utest[session.unitTest]||0,sc);save();}
  if(session.kind==="deep")dayRec().x=1;
  if(session.mock){
    const byU={},byK={};
    session.items.forEach((it,i)=>{
      const a=session.ans[i]||{ok:false};const u=unitOf(it);const k=it.k==="card"?(it.mode==="mc"?"mc":"wr"):it.k;
      if(u<9){byU[u]=byU[u]||[0,0];byU[u][0]++;if(a.ok)byU[u][1]++;}
      byK[k]=byK[k]||[0,0];byK[k][0]++;if(a.ok)byK[k][1]++;
    });
    session.result={d:today(),score:Math.round(session.score/session.items.length*100),n:session.items.length,c:session.score,sec:Math.round((Date.now()-session.start)/1000),byU,byK};
    S.mocks.push(session.result);if(S.mocks.length>30)S.mocks.shift();
    save();
  }
}
function next(){
  if(!session||!session.fb||Date.now()-fbAt<200)return;
  const it=session.items[session.i],fb=session.fb;
  if(it.k==="ess")commit(it,fb.rating==="full"?true:fb.rating==="part"?0.5:false,fb.rating);
  else commit(it,fb.ok);
  advance();
}
function mockNext(){
  const it=session.items[session.i];let ok=false,given="";
  if(it.k==="card"&&it.mode==="mc"){if(session.sel==null)return;given=it.opts[session.sel];ok=given===byId[it.id].a;}
  else if(it.k==="card"){const el=document.getElementById("wi");given=el?el.value.trim():"";ok=grade(byId[it.id],given);}
  else if(it.k==="src"){if(session.sel==null)return;given=it.opts[session.sel];ok=given===srcById[it.id].a;}
  else if(it.k==="tl"){if(it.order.length<it.ev.length)return;ok=tlCorrect(it);given=it.order.slice();}
  commit(it,ok,given);
  advance();
}
function tlSorted(it){return it.ev.slice().sort((a,b)=>evKey(events[a])-evKey(events[b]));}
function tlCorrect(it){const s=tlSorted(it);return it.order.every((v,i)=>v===s[i]);}

/* 그리기: 공통 */
const app=document.getElementById("app");
function counts(list){const k={un:0,l0:0,l1:0,l2:0,l3:0,l4:0};list.forEach(c=>{const l=levelOf(c.id);if(l<0)k.un++;else k["l"+l]++;});return k;}
function barHTML(k,total){
  const seg=(n,v)=>n?`<span style="width:${(n/total*100).toFixed(2)}%;background:var(--${v})"></span>`:"";
  return `<div class="bar" role="img" aria-label="외움 ${k.l4}, 복습 중 ${k.l1+k.l2+k.l3}, 다시 보기 ${k.l0}, 안 본 카드 ${k.un}">${seg(k.l4,"l4")}${seg(k.l3,"l3")}${seg(k.l2,"l2")}${seg(k.l1,"l1")}${seg(k.l0,"no")}</div>`;
}
const legendHTML=`<div class="legend"><span><i style="background:var(--l4)"></i>외움</span><span><i style="background:var(--l3)"></i>3단계</span><span><i style="background:var(--l2)"></i>2단계</span><span><i style="background:var(--l1)"></i>1단계</span><span><i style="background:var(--no)"></i>다시 보기</span><span><i style="background:var(--l0)"></i>안 본 카드</span></div>`;
function lvChip(id){const l=levelOf(id);return l<0?`<span class="lv">안 봄</span>`:`<span class="lv l${l}">${LVNAME[l]}</span>`;}
function evText(e){return e.y+(e.m?"."+e.m:"");}

function render(){
  hideTip();
  if(session){app.innerHTML=session.done?(session.mock?mockResultHTML():doneHTML()):studyHTML();focusStudy();return;}
  app.innerHTML=tabsHTML()+({today:todayHTML,path:pathHTML,practice:practiceHTML,wrong:wrongHTML,stats:statsHTML}[view])();
  if(sheet&&view==="path")requestAnimationFrame(()=>{const x=document.getElementById("sheetx");if(x)x.focus({preventScroll:true});});
  if(view==="path"&&!sheet&&scrollCur){scrollCur=false;requestAnimationFrame(()=>{const c=document.querySelector(".node.cur");if(c)c.scrollIntoView({block:"center"});});}
}
function tabsHTML(){
  const t=(v,l)=>`<button role="tab" aria-selected="${view===v}" data-act="tab" data-v="${v}">${l}</button>`;
  const w=cards.filter(c=>(st(c.id)||{}).w>0).length+srcs.filter(s=>(S.src[s.id]||{}).w>0).length;
  return `<div class="tabs" role="tablist">${t("today","오늘")}${t("path","경로")}${t("practice","연습")}${t("wrong","오답"+(w?" "+w:""))}${t("stats","기록")}</div>`;
}

/* 학습 경로 */
const NODE_OFF=[0,56,84,56,0,-56,-84,-56];
const PATH=(()=>{
  const out=[];let n=0;
  for(let u=1;u<=5;u++){
    const list=cards.filter(c=>c.u===u),k=Math.ceil(list.length/8),size=Math.ceil(list.length/k);
    out.push({type:"unit",u});
    for(let i=0;i<k;i++){
      const cs=list.slice(i*size,(i+1)*size);if(!cs.length)continue;
      const pgs=cs.map(c=>c.pg).filter(p=>p<999);
      out.push({type:"lesson",id:"L"+u+"-"+(i+1),u,no:++n,ids:cs.map(c=>c.id),pg:pgs.length?(Math.min(...pgs)===Math.max(...pgs)?Math.min(...pgs)+"쪽":Math.min(...pgs)+"~"+Math.max(...pgs)+"쪽"):""});
    }
    out.push({type:"src",id:"S"+u,u});
    out.push({type:"utest",id:"T"+u,u});
  }
  out.push({type:"mock",id:"M"});
  return out;
})();
const nodeById=Object.fromEntries(PATH.filter(p=>p.id).map(p=>[p.id,p]));
function lessonInfo(L){
  const ls=L.ids.map(levelOf),n=ls.length,seen=ls.filter(l=>l>=0).length,mast=ls.filter(l=>l>=4).length;
  const prog=ls.reduce((s,l)=>s+(l<0?0:l+1),0)/(5*n);
  const stars=seen<n?0:mast===n?3:ls.every(l=>l>=2)?2:1;
  return {n,seen,mast,prog,stars,done:seen===n};
}
function currentLessonId(){const L=PATH.find(p=>p.type==="lesson"&&!lessonInfo(p).done);return L?L.id:null;}
function nodeState(p){
  if(p.type==="lesson"){const i=lessonInfo(p);return {prog:i.prog,done:i.done,started:i.seen>0,stars:i.stars};}
  if(p.type==="src"){const l=srcs.filter(s=>s.u===p.u),t=l.filter(s=>(S.src[s.id]||{}).t>0).length,r=l.filter(s=>(S.src[s.id]||{}).r>0).length;return {prog:r/l.length,done:t===l.length,started:t>0,stars:0};}
  if(p.type==="utest"){const b=S.utest[p.u];return {prog:(b||0)/100,done:b!=null,started:b!=null,stars:b>=90?3:b>=70?2:b!=null?1:0,best:b};}
  const m=S.mocks.length?S.mocks[S.mocks.length-1].score:null;return {prog:(m||0)/100,done:m!=null,started:m!=null,stars:0,best:m};
}
function ring(prog,cls){
  const r=36,c=2*Math.PI*r;
  return `<svg class="ring" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="${r}" class="rbg"/><circle cx="42" cy="42" r="${r}" class="rfg ${cls}" ${prog>0?"":"stroke-opacity=\"0\""} stroke-dasharray="${(c*Math.min(1,prog)).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/></svg>`;
}
let sheet=null;
function pathHTML(){
  const cur=currentLessonId();let ahead=false,idx=0;
  const body=PATH.map(p=>{
    if(p.type==="unit"){
      const list=cards.filter(c=>c.u===p.u),k=counts(list);idx=0;
      return `<div class="ubanner"><div class="un">${UNITS[p.u][0]} 단원 · ${UNITS[p.u][2]}</div><div class="ut">${esc(UNITS[p.u][1])}</div>
        <div class="up"><span style="width:${((list.length-k.un)/list.length*100).toFixed(1)}%"></span></div><div class="uc">본 카드 ${list.length-k.un} / ${list.length} · 외움 ${k.l4}</div></div>`;
    }
    const s=nodeState(p),isCur=p.id===cur;
    if(isCur)ahead=true;
    const off=NODE_OFF[idx++%NODE_OFF.length];
    const cls=s.done?"done":isCur?"cur":s.started?"part":(ahead&&p.type==="lesson")?"ahead":"todo";
    const icon=p.type==="lesson"?p.no:p.type==="src"?"사료":p.type==="utest"?"점검":"모의";
    const label=p.type==="lesson"?`레슨 ${p.no}`:p.type==="src"?"단원 사료":p.type==="utest"?"단원 점검":"모의고사";
    const sub=p.type==="lesson"?p.pg:(s.best!=null?s.best+"점":"");
    const stars=p.type==="lesson"||p.type==="utest"?`<span class="stars" aria-label="별 ${s.stars}개">${[1,2,3].map(i=>`<i class="${i<=s.stars?"on":""}"></i>`).join("")}</span>`:"";
    return `<div class="pnode" style="--off:${off}px">${isCur?`<div class="bubble">여기부터</div>`:""}
      <button class="node ${cls} ${p.type}" data-act="node" data-v="${p.id}" aria-label="${label} ${sub} ${s.done?"완료":isCur?"진행할 차례":""}">${ring(s.prog,cls)}<span class="ni">${icon}</span></button>
      <div class="nl">${label}${sub?` · ${sub}`:""}</div>${stars}</div>`;
  }).join("");
  return `<div class="path">${body}</div>${sheet?sheetHTML():""}`;
}
function sheetHTML(){
  const p=nodeById[sheet];if(!p)return "";
  const s=nodeState(p),cur=currentLessonId();
  let title="",meta="",note="",btns="",list="";
  if(p.type==="lesson"){
    const i=lessonInfo(p),curIdx=PATH.indexOf(nodeById[cur]),isAhead=cur&&PATH.indexOf(p)>curIdx;
    title=`레슨 ${p.no} · ${UNITS[p.u][0]} 단원`;
    meta=`카드 ${i.n}장 · ${p.pg} · 본 카드 ${i.seen} · 외움 ${i.mast}`;
    if(i.done){
      note="다 배운 레슨이에요. 다시 풀면 복습 단계가 올라가요.";
      btns=`<button class="btn wide" data-act="lredo" data-v="${p.id}">다시 하기 (주관식)</button><button class="btn ghost wide" data-act="lmc" data-v="${p.id}">객관식으로 가볍게 복습</button>`;
    }else{
      note=isAhead?"아직 차례가 아닌 레슨이에요. 미리 배우면 그만큼 다음 날 분량이 줄어요.":i.seen?"배우던 레슨이에요. 남은 카드부터 이어서 해요.":"이번 차례 레슨이에요.";
      btns=`<button class="btn wide" data-act="llearn" data-v="${p.id}">${isAhead?"미리 배우기":i.seen?"이어서 배우기":"배우기"} (${i.n-i.seen}장)</button>`;
      if(!i.seen)btns+=`<button class="btn ghost wide" data-act="lskip" data-v="${p.id}">아는 내용이면 시험 보고 건너뛰기</button>`;
    }
    list=`<details class="mt"><summary>카드 미리 보기</summary><ul class="clist">${p.ids.map(id=>{const c=byId[id];return `<li>${lvChip(id)}<span class="q">${esc(c.q)}</span><span class="a c${c.cat}">${esc(c.a)}</span></li>`;}).join("")}</ul></details>`;
  }else if(p.type==="src"){
    const l=srcs.filter(x=>x.u===p.u);
    title=`${UNITS[p.u][0]} 단원 사료`;meta=`교과서 사료 ${l.length}개 · 맞힌 사료 ${l.filter(x=>(S.src[x.id]||{}).r>0).length}개`;
    note="사료 구절을 보고 어떤 사건·법령·단체인지 맞혀요.";
    btns=`<button class="btn wide" data-act="nsrc" data-v="${p.u}">사료 ${l.length}문제 풀기</button>`;
  }else if(p.type==="utest"){
    title=`${UNITS[p.u][0]} 단원 점검`;meta=s.best!=null?`최고 점수 ${s.best}점`:"아직 안 봤어요";
    note="이 단원 카드 10문제와 사료 2문제. 레슨을 다 안 끝냈어도 미리 볼 수 있어요. 90점 이상이면 별 3개.";
    btns=`<button class="btn wide" data-act="ntest" data-v="${p.u}">${s.best!=null?"다시 보기":"점검 시작"}</button>`;
  }else{
    title="모의고사";meta=s.best!=null?`지난 점수 ${s.best}점 · ${S.mocks.length}회 응시`:"아직 안 봤어요";
    note="전 단원 20문항, 정답은 끝난 뒤 공개.";
    btns=`<button class="btn wide" data-act="mock">모의고사 시작</button>`;
  }
  return `<div class="sheet-bg" data-act="sheetclose"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sh-top"><div><div class="sh-t">${esc(title)}</div><div class="muted">${esc(meta)}</div></div><button class="btn ghost small" data-act="sheetclose" id="sheetx">닫기</button></div>
    <p class="muted m0">${esc(note)}</p><div class="sh-btns">${btns}</div>${list}</div>`;
}
function unitTestItems(u){
  const cs=pick(cards.filter(c=>c.u===u),10).map(c=>cardItem(c,levelOf(c.id)>=1&&Math.random()<.5?"write":"mc"));
  const ss=pick(srcs.filter(s=>s.u===u),2).map(s=>({k:"src",id:s.id,opts:shuffle([s.a].concat(s.x))}));
  return shuffle(cs.concat(ss));
}

/* 다음 단계 */
function weakestUnit(){
  const rows=Object.keys(UNITS).map(u=>({u:+u,x:S.ustat[u]||[0,0]})).filter(r=>r.x[0]>=5&&cards.some(c=>c.u===r.u&&levelOf(c.id)>=0));
  rows.sort((a,b)=>a.x[1]/a.x[0]-b.x[1]/b.x[0]);return rows[0]||null;
}
function nextStep(){
  const day=dayRec(),wr=cards.filter(c=>(st(c.id)||{}).w>0&&levelOf(c.id)<4).length,wu=weakestUnit();
  const dp=deepPlan();
  const lx=ladderStep();
  const main=lx?{act:"ladder",t:stepName(lx),d:STEP_DESC[lx.r]}
    :(!day.x&&dp.ok)?{act:"deep",t:"심화 세트",d:`배운 범위(${dp.sc.f}쪽까지)에서 사료·연표·서술형, 약 10분`}
    :{act:"mock",t:"모의고사",d:"20문항 · 실전처럼 정답은 끝나고 공개"};
  const more=[];
  more.push(`<button class="btn ghost small" data-act="bank">문제 은행 20문제</button>`);
  if(wr)more.push(`<button class="btn ghost small" data-act="drill" data-v="wrong">오답 ${Math.min(30,wr)}장 다시</button>`);
  if(wu)more.push(`<button class="btn ghost small" data-act="drill" data-v="urev" data-u="${wu.u}">약한 단원(${UNITS[wu.u][0]}) 복습</button>`);
  if(main.act!=="mock")more.push(`<button class="btn ghost small" data-act="mock">모의고사</button>`);
  if(main.act!=="deep"&&dp.ok)more.push(`<button class="btn ghost small" data-act="deep">${day.x?"심화 세트 한 번 더":"심화 세트"}</button>`);
  return {main,more};
}
/* 학습 순서 */
const ladderStep=()=>LADDER[S.ladder.i]||null;
const stepName=x=>`${x.b}일차 ${x.r}회`;
const STEP_DESC={1:"새 카드 · 답을 보고 외운 뒤 객관식으로 확인",2:"주관식으로 두 번째 복습",3:"주관식으로 마지막 복습 · 맞히면 '외움'"};
function batchPages(b){const ps=batches[b-1].map(c=>c.pg).filter(p=>p<999);if(!ps.length)return "";const a=Math.min(...ps),z=Math.max(...ps);return a===z?a+"쪽":a+"~"+z+"쪽";}
function startLadder(){
  const x=ladderStep();if(!x)return;
  const list=batches[x.b-1];
  const items=x.r===1?list.map(c=>cardItem(c,levelOf(c.id)<0?"learn":"mc"))
    :shuffle(list.map(c=>cardItem(c,levelOf(c.id)<0?"learn":"write")));
  begin("ladder",items,{ladder:{i:S.ladder.i,b:x.b,r:x.r}});
}
let skipAsk=false;
function ladderBoxHTML(){
  const x=ladderStep(),i=S.ladder.i,N=LADDER.length,day=dayRec();
  const todayLine=`<p class="muted mt">오늘 푼 문제 ${day.a}개${day.a?` · 정답률 ${pct(day.c,day.a)}%`:""} · 연속 ${streakNow()}일</p>`;
  if(!x)return `<div class="box"><h2>1. 학습 순서 <span class="lv l4">완료</span></h2>
    <p class="muted">${batches.length}일차까지 모두 3회씩 마쳤어요. 모의고사와 오답 복습으로 마무리하세요.</p>
    <div class="row"><button class="btn" data-act="mock">모의고사</button><button class="btn ghost" data-act="drill" data-v="wrong">오답 다시</button></div>${todayLine}</div>`;
  const n=batches[x.b-1].length,mins=Math.max(1,Math.round(n*(x.r===1?30:15)/60));
  const up=LADDER.slice(i+1,i+4).map(t=>`<span class="nw">${stepName(t)}</span>`).join(" → ");
  const skip=skipAsk
    ?`<div class="confirm mt2"><span>${stepName(x)}을 건너뛸까요?</span><button class="btn small" data-act="ladderskipyes">건너뛰기</button><button class="btn ghost small" data-act="ladderskipno">취소</button></div>`
    :`<button class="linkbtn" data-act="ladderskip">이 단계 건너뛰기</button>`;
  return `<div class="box"><h2>1. 학습 순서 <span class="muted">${i+1} / ${N}단계</span></h2>
    <div class="ladnow"><b>${stepName(x)}</b> <span class="muted">카드 ${n}장 · ${batchPages(x.b)}</span></div>
    <p class="muted">${STEP_DESC[x.r]}</p>
    <button class="btn wide" data-act="ladder">${stepName(x)} 시작 · 약 ${mins}분</button>
    ${up?`<p class="muted mt">다음: ${up}</p>`:""}${todayLine}
    <details class="mt"><summary>전체 순서 보기</summary><ol class="ladlist">${LADDER.map((t,j)=>`<li class="${j<i?"done":j===i?"cur":""}">${stepName(t)}</li>`).join("")}</ol></details>
    ${skip}</div>`;
}

/* 오늘 */
function todayHTML(){
  const left=daysLeft();
  const dd=left>0?"D-"+left:left===0?"D-DAY":"시험 끝";
  const k=counts(cards),day=dayRec();
  const lastMock=S.mocks.length?S.mocks[S.mocks.length-1]:null;
  const mockTip=(left>=1&&left<=3)
    ?`<div class="box tip"><h2>시험 직전 점검</h2><p class="muted">모의고사로 실전처럼 풀어 보고, 약한 단원을 마지막으로 복습하세요.${lastMock?` 지난 점수 ${lastMock.score}점.`:""}</p><button class="btn" data-act="mock">모의고사 보기</button></div>`:"";
  const dp=deepPlan();
  const deepBox=`<div class="box"><h2>2. 심화 세트 ${day.x?'<span class="lv l4">완료</span>':""}</h2>
    ${dp.ok?`<p class="muted">배운 범위(교과서 ${dp.sc.f}쪽까지)에서만 나와요. 사료 ${dp.ns}${dp.tl?`, 연표 순서 ${dp.tl}`:""}${dp.es?`, 서술형 ${dp.es}`:""}문제.</p>
    <button class="btn ghost wide" data-act="deep">${day.x?"한 세트 더 풀기":"심화 세트 시작 · 약 10분"}</button>`
    :`<p class="muted">아직 배운 카드가 없어서 범위를 정할 수 없어요. 전체 범위에서 풀 수도 있어요.</p>
    <button class="btn ghost wide" data-act="deepfull">전체 범위로 풀기</button>`}
    ${dp.ok?`<button class="linkbtn" data-act="deepfull">전체 범위로 풀기</button>`:""}</div>`;
  return `<div class="panel">
  <div class="box dday"><div><div class="lab">시험까지</div><div class="big">${dd}</div></div>
    <label for="exam">시험일 <input type="date" id="exam" value="${esc(S.exam)}"></label></div>
  ${mockTip}
  ${ladderBoxHTML()}
  ${deepBox}
  <div class="box"><h2>전체 진행</h2>${barHTML(k,TOTAL)}${legendHTML}
    <p class="muted mt">외운 카드 <b>${k.l4}</b> / ${TOTAL}장 · 아직 안 본 카드 ${k.un}장</p></div>
  <details class="box"><summary>진행 방식</summary>
    <p class="muted mt">카드를 교과서 순서대로 ${BATCH}장씩 묶어(1일차, 2일차 …) 계단식으로 공부해요. 1일차 1회 → 2일차 1회 → 1일차 2회 → 3일차 1회 → 2일차 2회 → 1일차 3회 … 처럼 새 묶음을 배운 뒤 앞 묶음을 다시 봐요. 날짜와 상관없이 한 단계를 끝내면 바로 다음 단계로 이어 갈 수 있어요. 1회는 답을 보고 외운 뒤 객관식으로 확인하고, 2회·3회는 주관식이에요. 3회째에 맞힌 카드는 '외움'이 됩니다. 틀린 카드는 그 자리에서 객관식으로 다시 나오고 오답 목록에 남아요.</p></details>
  </div>`;
}

/* 연습 */
function practiceHTML(){
  const seenAll=cards.filter(c=>levelOf(c.id)>=0).length;
  const lastMock=S.mocks.length?S.mocks[S.mocks.length-1]:null;
  const units=Object.keys(UNITS).map(Number).map(u=>{
    const list=cards.filter(c=>c.u===u),k=counts(list),[no,name,pg]=UNITS[u];
    const seen=list.length-k.un,ns=srcs.filter(s=>s.u===u).length;
    return `<div class="unit"><div class="top"><span class="t">${no} ${esc(name)}</span><span class="c">${pg}</span></div>
      ${barHTML(k,list.length)}
      <span class="c">외움 ${k.l4} · 공부 중 ${k.l0+k.l1+k.l2+k.l3} · 안 봄 ${k.un} / ${list.length}장</span>
      <div class="row"><button class="btn small" data-act="drill" data-v="unew" data-u="${u}" ${k.un?"":"disabled"}>새 카드 ${Math.min(10,k.un)||10}장 미리 배우기</button>
      <button class="btn ghost small" data-act="drill" data-v="urev" data-u="${u}" ${seen?"":"disabled"}>본 카드 ${Math.min(20,seen)||20}장 복습</button>
      <button class="btn ghost small" data-act="usrc" data-u="${u}">사료 ${Math.min(6,ns)}문제</button></div>
      <details><summary>카드 목록 보기</summary><ul class="clist">${list.map(c=>`<li>${lvChip(c.id)}<span class="q">${esc(c.q)}</span><span class="a c${c.cat}">${esc(c.a)}</span></li>`).join("")}</ul></details>
    </div>`;
  }).join("");
  const reset=resetAsk
    ?`<div class="confirm"><span>진행 기록을 모두 지울까요? 되돌릴 수 없어요.</span><button class="btn small" data-act="resetyes">지우기</button><button class="btn ghost small" data-act="resetno">취소</button></div>`
    :`<button class="btn ghost small" data-act="resetask">진행 기록 초기화</button>`;
  const row=(t,d,act,label,dis)=>`<div class="prow"><div><div class="t">${t}</div><div class="muted">${d}</div></div><button class="btn small" data-act="${act}" ${dis?"disabled":""}>${label}</button></div>`;
  return `<div class="panel">
    <div class="box"><h2>모의고사</h2>
      <p class="muted">단원별 카드 10문제, 사료 6문제, 연표 순서 4문제, 모두 20문항(문항당 5점). 실전처럼 정답은 끝난 뒤에 한꺼번에 보여 줘요.${lastMock?` 지난 점수 <b>${lastMock.score}점</b>.`:""}</p>
      <button class="btn wide" data-act="mock">모의고사 시작 · 약 15분</button></div>
    <div class="box"><h2>유형별 연습</h2>
      ${row("사료 보고 맞히기",`배운 범위의 사료 중 덜 맞힌 것부터 8문제`,"psrc","시작")}
      ${row("연표 순서 맞추기","배운 범위의 사건 4개를 일어난 순서대로, 5문제","ptl","시작")}
      ${row("서술형 연습","배운 범위에서 3문제, 핵심어 체크로 스스로 채점","pess","시작")}
      ${row("문제 은행 (계속 풀기)","O/X·설명 고르기·객관식·사료·먼저 일어난 사건을 섞어 20문제씩, 배운 범위에서","bank","시작")}
      ${row("카드 섞어서 풀기","이미 본 카드 중 무작위 20장","pmix","시작",!seenAll)}
    </div>
    <div class="box"><h2>단원별</h2>${units}</div>
    <div class="box"><h2>내 기록 관리</h2>
      <p class="muted">기록은 자동으로 저장돼요(로그인한 Claude에서는 계정, 그 밖에는 이 기기의 브라우저). 파일로 저장해 두면 다른 기기로 옮기거나 백업할 수 있어요. 다른 사람이 이 앱을 써도 기록은 각자 따로 저장됩니다.</p>
      ${importAsk?importConfirmHTML():`<div class="row"><button class="btn small" data-act="export" ${dlState===false?"hidden":""}>기록 파일로 저장</button>
      <label class="btn ghost small filebtn">기록 파일 불러오기<input type="file" id="impf" accept=".json,application/json"></label></div>
      ${ioMsg?`<p class="muted mt" role="status">${esc(ioMsg)}</p>`:""}
      <details class="mt"><summary>파일 저장이 안 될 때: 기록 코드로 옮기기</summary>
        <p class="muted mt">아래 코드를 복사해 메모 등에 보관했다가, 다른 기기에서 붙여 넣으면 기록을 옮길 수 있어요.</p>
        <div class="row"><button class="btn ghost small" data-act="copycode">기록 코드 복사</button></div>
        <textarea id="codein" rows="3" placeholder="기록 코드를 여기에 붙여 넣으세요" aria-label="기록 코드"></textarea>
        <div class="row"><button class="btn ghost small" data-act="pastecode">붙여 넣은 코드로 불러오기</button></div>
      </details>`}
    </div>
    <div class="box"><h2>설정</h2>${reset}</div>
  </div>`;
}

/* 기록 파일 */
let importAsk=null,ioMsg="",dlState=null;
function exportText(){return JSON.stringify({app:"ilje-cards",exported:new Date().toISOString(),state:S});}
function parseImport(text){
  try{const o=JSON.parse(text);const st=o&&o.app==="ilje-cards"?o.state:o;
    if(!st||st.v!==1||typeof st.cards!=="object")return null;return normalize(st);}catch(e){return null;}
}
function importConfirmHTML(){
  const st=importAsk;const seen=Object.values(st.cards).filter(c=>c.s).length,mast=Object.values(st.cards).filter(c=>c.s&&c.l>=4).length;
  const days=Object.keys(st.days||{}).filter(d=>st.days[d].a>0).sort();
  return `<div class="confirm col"><span>불러올 기록: 공부한 날 ${days.length}일${days.length?` (마지막 ${md(days[days.length-1])})`:""} · 본 카드 ${seen}장 · 외운 카드 ${mast}장 · 모의고사 ${st.mocks.length}회. 지금 기록을 이 기록으로 바꿀까요?</span>
    <div class="row"><button class="btn small" data-act="importyes">이 기록으로 바꾸기</button><button class="btn ghost small" data-act="importno">취소</button></div></div>`;
}
async function doExport(){
  ioMsg="";
  try{
    const inClaude=!!(window.claude&&window.claude.use);
    if(!inClaude){
      const blob=new Blob([exportText()],{type:"application/json"});const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`한국사카드_기록_${today()}.json`;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);ioMsg="기록 파일을 내려받았어요.";render();return;
    }
    const dl=await window.claude.use("downloads");
    if(!dl){dlState=false;ioMsg="이 화면에서는 파일 저장을 쓸 수 없어요. 아래 '기록 코드'를 이용해 주세요.";render();return;}
    const r=await dl.save({filename:`한국사카드_기록_${today()}.json`,data:exportText()});
    ioMsg=r.status==="saved"?"기록 파일을 저장했어요.":"기록 파일을 보냈어요.";
  }catch(e){
    const c=e&&e.code;
    ioMsg=c==="declined"?"저장을 취소했어요.":c==="rate_limited"?"저장 창이 이미 열려 있어요. 잠시 뒤 다시 눌러 주세요.":"이 화면에서는 파일 저장을 쓸 수 없어요. 아래 '기록 코드'를 이용해 주세요.";
    if(c&&c!=="declined"&&c!=="rate_limited")dlState=false;
  }
  render();
}

/* 오답 */
function wrongHTML(){
  const list=cards.filter(c=>(st(c.id)||{}).w>0).sort((a,b)=>st(b.id).w-st(a.id).w||levelOf(a.id)-levelOf(b.id));
  const sl=srcs.filter(s=>(S.src[s.id]||{}).w>0).sort((a,b)=>S.src[b.id].w-S.src[a.id].w);
  if(!list.length&&!sl.length)return `<div class="box empty">아직 틀린 문제가 없어요.</div>`;
  const cardBox=list.length?`<div class="box"><h2>카드 오답 ${list.length}</h2>
    <p class="muted">많이 틀린 카드부터. 외움 단계가 되어도 목록에 남아요.</p>
    <button class="btn wide" data-act="drill" data-v="wrong">많이 틀린 순서로 ${Math.min(30,list.length)}장 풀기</button>
    <ul class="clist">${list.map(c=>`<li><span class="lv wr">틀림 ${st(c.id).w}</span><span class="q">${esc(c.q)}</span><span class="a"><span class="c${c.cat}">${esc(c.a)}</span> ${lvChip(c.id)}</span><span class="q muted">${esc(c.note)}</span></li>`).join("")}</ul></div>`:"";
  const srcBox=sl.length?`<div class="box"><h2>사료 오답 ${sl.length}</h2>
    <button class="btn wide" data-act="wsrc">틀린 사료 다시 풀기</button>
    <ul class="clist">${sl.map(s=>`<li><span class="lv wr">틀림 ${S.src[s.id].w}</span><span class="q">「${esc(s.text)}」</span><span class="a c${s.cat}">${esc(s.a)}</span><span class="q muted">${esc(s.cite)}</span></li>`).join("")}</ul></div>`:"";
  return `<div class="panel">${cardBox}${srcBox}</div>`;
}

/* 기록 */
function statsHTML(){
  const keys=Object.keys(S.days).filter(d=>S.days[d].a>0).sort();
  const totA=keys.reduce((s,d)=>s+S.days[d].a,0),totC=keys.reduce((s,d)=>s+S.days[d].c,0);
  const k=counts(cards);
  if(!totA&&!S.mocks.length)return `<div class="box empty">아직 기록이 없어요. 오늘 탭에서 학습을 시작하면 여기에 쌓여요.</div>`;
  const first=keys[0]||today();
  let from=addDays(today(),-13);if(first>from)from=first;
  const range=[];for(let d=from;d<=today();d=addDays(d,1))range.push(d);
  const rows=range.map(d=>({d,a:(S.days[d]||{}).a||0,c:(S.days[d]||{}).c||0}));
  const tiles=`<div class="tiles">
    <div><b>${totA}</b><span>푼 문제</span></div><div><b>${pct(totC,totA)}%</b><span>전체 정답률</span></div>
    <div><b>${TOTAL-k.un}</b><span>배운 카드</span></div><div><b>${k.l4}</b><span>외운 카드 (3회 완료)</span></div></div>
    <p class="muted mt">연속 학습일 ${streakNow()}일 · 외운 카드는 3회째 주관식에서 맞힌 카드예요.</p>`;
  const unitRows=Object.keys(UNITS).map(u=>{const x=S.ustat[u]||[0,0];return {label:UNITS[u][0]+" "+UNITS[u][1],a:x[0],c:x[1]};});
  const kindRows=Object.keys(KIND).map(kk=>{const x=S.kstat[kk]||[0,0];return {label:KIND[kk],a:x[0],c:x[1]};});
  const weakU=unitRows.filter(r=>r.a>=5).sort((a,b)=>a.c/a.a-b.c/b.a)[0];
  const weak=cards.filter(c=>(st(c.id)||{}).w>0).sort((a,b)=>st(b.id).w-st(a.id).w).slice(0,8);
  const mocks=S.mocks.slice(-8);
  return `<div class="panel">
    <div class="box">${tiles}</div>
    <div class="box"><h2>날짜별 푼 문제</h2>${dayBars(rows)}</div>
    <div class="box"><h2>날짜별 정답률</h2>${accLine(rows.filter(r=>r.a>0))}</div>
    <div class="box"><h2>단원별 정답률</h2>${weakU?`<p class="muted">가장 약한 단원: <b>${esc(weakU.label)}</b> (${pct(weakU.c,weakU.a)}%)</p>`:`<p class="muted">단원마다 5문제 이상 풀면 약한 단원을 알려 드려요.</p>`}${hbars(unitRows)}</div>
    <div class="box"><h2>유형별 정답률</h2>${hbars(kindRows)}</div>
    <div class="box"><h2>모의고사 기록</h2>${mocks.length?hbars(mocks.map((m,i)=>({label:`${md(m.d)} · ${S.mocks.length-mocks.length+i+1}회`,a:m.n,c:m.c,txt:`${m.score}점 · ${Math.round(m.sec/60)}분`}))):`<p class="muted m0">아직 본 모의고사가 없어요.</p>`}</div>
    <div class="box"><h2>자주 틀리는 카드</h2>${weak.length?`<ul class="clist">${weak.map(c=>`<li><span class="lv wr">틀림 ${st(c.id).w}</span><span class="q">${esc(c.q)}</span><span class="a c${c.cat}">${esc(c.a)}</span></li>`).join("")}</ul>`:`<p class="muted m0">아직 없어요.</p>`}</div>
    <details class="box"><summary>날짜별 기록 표로 보기</summary><div class="tblwrap"><table><thead><tr><th>날짜</th><th>푼 문제</th><th>정답률</th><th>새 카드</th></tr></thead><tbody>${keys.slice().reverse().map(d=>`<tr><td>${md(d)}</td><td>${S.days[d].a}</td><td>${pct(S.days[d].c,S.days[d].a)}%</td><td>${S.days[d].n||0}</td></tr>`).join("")}</tbody></table></div></details>
  </div>`;
}
function chartW(){return Math.max(300,Math.min(640,(app.clientWidth||400)-34));}
function dayBars(rows){
  const W=chartW(),H=170,L=34,R=8,T=14,B=24,cw=(W-L-R)/rows.length,bw=Math.min(28,cw*0.62);
  const max=Math.max(10,...rows.map(r=>r.a));const top=Math.ceil(max/10)*10;
  const y=v=>T+(H-T-B)*(1-v/top);
  const grid=[0,top/2,top].map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L-6}" y="${y(v)+4}" class="ax" text-anchor="end">${v}</text>`).join("");
  const step=Math.ceil(rows.length/7);
  const bars=rows.map((r,i)=>{
    const cx=L+cw*i+cw/2,h=(H-T-B)*(r.a/top);
    const tip=`${md(r.d)} · ${r.a}문제${r.a?` · 정답률 ${pct(r.c,r.a)}%`:""}`;
    const isT=r.d===today();
    const mark=r.a?`<path d="${roundTop(cx-bw/2,y(r.a),bw,h,4)}" class="bm${isT?" now":""}"/>`:"";
    const lab=(isT||(i%step===0&&rows.length-1-i>=step))?`<text x="${cx}" y="${H-6}" class="ax" text-anchor="middle">${isT?"오늘":md(r.d)}</text>`:"";
    const val=(isT&&r.a)?`<text x="${cx}" y="${y(r.a)-5}" class="vl" text-anchor="middle">${r.a}</text>`:"";
    return `${mark}${val}${lab}<rect x="${L+cw*i}" y="${T}" width="${cw}" height="${H-T-B}" class="hit" data-tip="${esc(tip)}"/>`;
  }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="날짜별 푼 문제 수">${grid}${bars}</svg></div>`;
}
function roundTop(x,y,w,h,r){r=Math.min(r,h,w/2);return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`;}
function accLine(rows){
  if(!rows.length)return `<p class="muted m0">아직 기록이 없어요.</p>`;
  const W=chartW(),H=170,L=34,R=36,T=14,B=24,n=rows.length;
  const x=i=>n===1?(L+W-R)/2:L+(W-L-R)*i/(n-1),y=v=>T+(H-T-B)*(1-v/100);
  const grid=[0,50,100].map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L-6}" y="${y(v)+4}" class="ax" text-anchor="end">${v}%</text>`).join("");
  const pts=rows.map((r,i)=>[x(i),y(pct(r.c,r.a))]);
  const line=n>1?`<path d="M${pts.map(p=>p.join(",")).join("L")}" class="ln"/>`:"";
  const step=Math.ceil(n/7);
  const dots=rows.map((r,i)=>{
    const last=i===n-1;
    return `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="${last?5:3.5}" class="dt${last?" now":""}"/>${last?`<text x="${pts[i][0]+8}" y="${pts[i][1]+4}" class="vl">${pct(r.c,r.a)}%</text>`:""}${(last||(i%step===0&&n-1-i>=step))?`<text x="${pts[i][0]}" y="${H-6}" class="ax" text-anchor="middle">${md(r.d)}</text>`:""}<rect x="${pts[i][0]-14}" y="${T}" width="28" height="${H-T-B}" class="hit" data-tip="${esc(`${md(r.d)} · 정답률 ${pct(r.c,r.a)}% (${r.a}문제)`)}"/>`;
  }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="날짜별 정답률">${grid}${line}${dots}</svg></div>`;
}
function hbars(rows){
  return `<div class="hb">${rows.map(r=>{
    const p=pct(r.c,r.a);
    return `<div class="hbr" data-tip="${esc(`${r.label} · ${r.a?p+"%":"기록 없음"} (${fmt(r.c)}/${r.a})`)}"><span class="hl">${esc(r.label)}</span><span class="ht"><span style="width:${r.a?Math.max(p,1):0}%"></span></span><span class="hv">${r.txt?esc(r.txt):(r.a?`${p}% · ${r.a}문제`:"—")}</span></div>`;
  }).join("")}</div>`;
}
const fmt=v=>Math.round(v*10)/10;

let rsT=null;window.addEventListener("resize",()=>{if(view==="stats"&&!session){clearTimeout(rsT);rsT=setTimeout(render,200);}});
/* 툴팁 */
const tip=document.createElement("div");tip.className="tip-pop";tip.hidden=true;document.body.appendChild(tip);
function showTip(el,x,y){tip.textContent=el.dataset.tip;tip.hidden=false;const w=tip.offsetWidth;tip.style.left=Math.max(8,Math.min(window.innerWidth-w-8,x-w/2))+"px";tip.style.top=(y-tip.offsetHeight-12+window.scrollY)+"px";}
function hideTip(){tip.hidden=true;}
app.addEventListener("pointermove",e=>{const t=e.target.closest("[data-tip]");if(t&&e.pointerType==="mouse")showTip(t,e.clientX,e.clientY);else if(e.pointerType==="mouse")hideTip();});
app.addEventListener("pointerleave",hideTip);

/* 그리기: 학습 화면 */
function studyHTML(){
  const it=session.items[session.i],fb=session.fb,total=session.items.length;
  const pc=(session.i/total*100).toFixed(1);
  let chips="",q="",body="";
  const unitChip=u=>`<span class="chip">${UNITS[u][0]} 단원</span>`;
  if(it.k==="card"){
    const c=byId[it.id];
    const ml=it.mode==="learn"?"새 카드 · 외우기":it.mode==="mc"?"객관식":"주관식";
    chips=`<span class="chip c${c.cat}"><i></i>${CAT[c.cat]}</span>${unitChip(c.u)}<span class="chip mode">${ml}</span>`;
    q=`<p class="q">${esc(c.q)}</p>`;
    if(it.mode==="learn"){
      body=`<div class="ans c${c.cat}">${esc(c.a)}</div><div class="note">${esc(c.note)}</div>
        <div class="acts"><button class="btn" data-act="learned" id="focusme">외웠어요, 문제로 확인</button></div>`;
    }else if(it.mode==="mc"){
      if(!it.opts)it.opts=makeOpts(c);
      body=optsHTML(it.opts,c.a,fb)+(fb?verdictHTML(c.a,c.cat,c.note,fb):"");
    }else{
      body=writeHTML(fb)+(fb?verdictHTML(c.a,c.cat,c.note,fb):(session.mock?"":`<div class="acts"><button class="btn ghost small" data-act="giveup">모르겠어요</button></div>`));
    }
  }else if(it.k==="src"){
    const s=srcById[it.id];
    chips=`<span class="chip c${s.cat}"><i></i>${CAT[s.cat]}</span>${unitChip(s.u)}<span class="chip mode">사료</span>`;
    q=`<blockquote class="srcq">${esc(s.text)}</blockquote><p class="q sm">${esc(s.q)}</p>`;
    body=optsHTML(it.opts,s.a,fb)+(fb?verdictHTML(s.a,s.cat,s.cite,fb):"");
  }else if(it.k==="tl"){
    chips=`<span class="chip mode">연표 순서</span>`;
    q=`<p class="q">먼저 일어난 사건부터 차례로 누르세요.</p>`;
    const sorted=tlSorted(it);
    body=`<div class="tl">${it.ev.map(ix=>{
      const e=events[ix],pos=it.order.indexOf(ix);
      let cls="";if(fb)cls=(sorted[pos]===ix)?"ok":"no";
      return `<button class="tlb ${pos>=0?"on":""} ${cls}" data-act="tlpick" data-v="${ix}" ${fb?"disabled":""}><span class="n">${pos>=0?pos+1:""}</span><span>${esc(e.label)}</span>${fb?`<span class="yr">${evText(e)}</span>`:""}</button>`;
    }).join("")}</div>`;
    if(fb){
      body+=`<div class="verdict ${fb.ok?"ok":"no"}"><div class="h">${fb.ok?"정답!":"순서가 달라요"}</div><ol class="ord">${sorted.map(ix=>`<li>${esc(events[ix].label)} <span class="muted">${evText(events[ix])}</span></li>`).join("")}</ol></div><div class="acts"><button class="btn" data-act="next" id="focusme">다음</button></div>`;
    }else if(!session.mock){
      body+=`<div class="acts"><button class="btn ghost small" data-act="tlreset" ${it.order.length?"":"disabled"}>다시 고르기</button><button class="btn" data-act="tlcheck" ${it.order.length===it.ev.length?"":"disabled"}>확인</button></div>`;
    }else{
      body+=`<div class="acts"><button class="btn ghost small" data-act="tlreset" ${it.order.length?"":"disabled"}>다시 고르기</button></div>`;
    }
  }else if(it.k==="rev"){
    const c=byId[it.id];
    chips=`<span class="chip c${c.cat}"><i></i>${CAT[c.cat]}</span>${unitChip(c.u)}<span class="chip mode">설명 고르기</span>`;
    q=`<p class="q">‘${esc(c.a)}’에 해당하는 설명은?</p>`;
    body=optsHTML(it.opts,it.ans,fb)+(fb?verdictHTML(c.a,c.cat,c.note,fb):"");
  }else if(it.k==="ox"){
    const c=byId[it.id];
    chips=`<span class="chip c${c.cat}"><i></i>${CAT[c.cat]}</span>${unitChip(c.u)}<span class="chip mode">O/X</span>`;
    q=`<p class="q">${esc(c.q)}</p><div class="oxprop">→ ${esc(it.shown)}</div><p class="muted m0">이 답이 맞으면 O, 틀리면 X</p>`;
    const b=(val,lab)=>{let cls="";if(fb){if(val===it.truth)cls="ok";else if(val===fb.said)cls="no";}return `<button class="opt ox ${cls}" data-act="ox" data-v="${val?1:0}" ${fb?"disabled":""}>${lab}</button>`;};
    body=`<div class="oxrow">${b(true,"O")}${b(false,"X")}</div>`+(fb?verdictHTML(c.a,c.cat,c.note,fb):"");
  }else if(it.k==="pair"){
    chips=`<span class="chip mode">먼저 일어난 사건</span>`;
    q=`<p class="q">둘 중 먼저 일어난 사건은?</p>`;
    const [a,b2]=it.ev.map(i=>events[i]);
    body=optsHTML(it.opts,it.ans,fb)+(fb?`<div class="verdict ${fb.ok?"ok":"no"}"><div class="h">${fb.ok?"정답!":"아쉬워요"}</div><div>${esc(a.label)} <b>${evText(a)}</b></div><div>${esc(b2.label)} <b>${evText(b2)}</b></div></div><div class="acts"><button class="btn" data-act="next" id="focusme">다음</button></div>`:"");
  }else if(it.k==="ess"){
    const e=essById[it.id];
    chips=`${unitChip(e.u)}<span class="chip mode">서술형</span><span class="chip">${esc(e.pg)}</span>`;
    q=`<p class="q">${esc(e.q)}</p>`;
    if(!fb){
      body=`<textarea id="ei" rows="5" placeholder="생각나는 대로 써 보세요. 핵심어가 들어가면 자동으로 표시돼요." aria-label="서술형 답안">${esc(it.draft||"")}</textarea>
        <div class="acts"><button class="btn ghost small" data-act="essreveal" data-v="skip">모르겠어요</button><button class="btn" data-act="essreveal">다 썼어요, 답 확인</button></div>`;
    }else{
      const hits=kwHits(e,fb.input||"");
      body=`${fb.input?`<div class="mine"><div class="muted">내 답</div>${esc(fb.input)}</div>`:""}
        <div class="model"><div class="muted">모범 답안</div>${esc(e.model)}</div>
        <div><div class="muted">핵심어 ${hits.filter(Boolean).length} / ${hits.length}</div><ul class="kw">${e.kws.map((g,i)=>`<li class="${hits[i]?"hit":""}">${hits[i]?"✓":"○"} ${esc(g[0])}</li>`).join("")}</ul></div>
        ${fb.rating?"":`<p class="muted m0">내 답을 스스로 채점해 주세요.</p>`}
        <div class="acts">${["again","part","full"].map(r=>`<button class="btn ${fb.rating===r?"":"ghost"} small" data-act="rate" data-v="${r}" ${fb.rating?"disabled":""}>${{again:"다시 공부",part:"일부 맞음",full:"다 맞음"}[r]}</button>`).join("")}${fb.rating?`<button class="btn" data-act="next" id="focusme">다음</button>`:""}</div>`;
    }
  }
  const mockBar=session.mock?`<button class="btn" data-act="mocknext" id="focusme" ${mockReady(it)?"":"disabled"}>${session.i===total-1?"제출하고 채점":"다음 문제"}</button>`:"";
  return `<div class="study">
    <div class="stop"><button class="btn ghost small" data-act="quit">${session.mock?"그만두기":"그만하기"}</button><div class="prog"><span style="width:${pc}%"></span></div><span class="cnt">${session.i+1} / ${total}</span></div>
    <div class="qcard">${session.mock?`<div class="muted mockh">모의고사 · 정답은 끝나고 공개</div>`:""}<div class="chips">${chips}</div>${q}${body}${mockBar?`<div class="acts">${mockBar}</div>`:""}</div></div>`;
}
function mockReady(it){
  if(it.k==="tl")return it.order.length===it.ev.length;
  if(it.k==="card"&&it.mode==="write")return true;
  return session.sel!=null;
}
function optsHTML(opts,ans,fb){
  return `<div class="opts">${opts.map((o,i)=>{
    let cls="";
    if(fb){if(o===ans)cls="ok";else if(i===fb.pick)cls="no";}
    else if(session.mock&&session.sel===i)cls="sel";
    return `<button class="opt ${cls}" data-act="pick" data-v="${i}" ${fb?"disabled":""}><span class="k">${i+1}</span>${esc(o)}</button>`;
  }).join("")}</div>`;
}
function writeHTML(fb){
  return `<form class="write" id="wf" autocomplete="off"><input id="wi" type="text" placeholder="답을 입력하세요" aria-label="답 입력" value="${fb?esc(fb.input):""}" ${fb?"disabled":""}>${fb||session.mock?"":`<button class="btn" type="submit">확인</button>`}</form>`;
}
function verdictHTML(a,cat,note,fb){
  const head=fb.ok?(fb.override?"맞은 것으로 처리했어요":"정답!"):"아쉬워요";
  const mine=(!fb.ok&&fb.input)?`<div>내 답: ${esc(fb.input)}</div>`:"";
  const over=(!fb.ok&&fb.input)?`<button class="btn ghost small" data-act="override">내 답도 맞아요</button>`:"";
  return `<div class="verdict ${fb.ok?"ok":"no"}"><div class="h">${head}</div><div>정답: <b class="c${cat}">${esc(a)}</b></div>${mine}<div class="note">${esc(note)}</div></div>
    <div class="acts">${over}<button class="btn" data-act="next" id="focusme">다음</button></div>`;
}
function wrongListHTML(){
  const ws=session.wrong.filter(w=>w.k!=="tl");
  if(!ws.length)return "";
  return `<ul class="clist left">${ws.map(w=>{
    if(w.k==="card"){const x=byId[w.id];return `<li><span class="lv wr">카드</span><span class="q">${esc(x.q)}</span><span class="a c${x.cat}">${esc(x.a)}</span></li>`;}
    const s=srcById[w.id];return `<li><span class="lv wr">사료</span><span class="q">「${esc(s.text)}」</span><span class="a c${s.cat}">${esc(s.a)}</span></li>`;
  }).join("")}</ul>`;
}
function doneHTML(){
  const a=session.answered,c=session.score;
  const cw=session.wrong.some(w=>w.k==="card");
  const nx=(session.ladder||session.kind==="deep"||session.ahead)?nextStep().main:null;
  return `<div class="box done">
    <div class="muted">${session.test?"건너뛰기 테스트 끝":session.unitTest?UNITS[session.unitTest][0]+" 단원 점검 끝":session.lesson?"레슨 끝":session.ladder?stepName(session.ladder)+" 끝":session.kind==="today"?"오늘 카드 학습 끝":session.kind==="deep"?"심화 세트 끝":"연습 끝"}</div>
    <div class="big">${fmt(c)} / ${a}</div>
    <div class="muted">${a?"정답률 "+pct(c,a)+"%":"푼 문제가 없어요"}</div>
    ${session.test?`<p class="muted">${pct(session.score,session.answered)>=80?"건너뛰기 성공! 맞힌 카드는 바로 복습 단계로 넘어갔어요.":"맞힌 카드는 복습 단계로 넘어갔어요. 틀린 카드는 이 레슨에서 처음부터 배우게 돼요."}</p>`:""}
    ${wrongListHTML()}
    <div class="row center">${session.bank?`<button class="btn ghost" data-act="bank" data-v="${session.full?1:0}">20문제 더</button>`:""}${session.lesson?`<button class="btn ghost" data-act="backpath">경로로 돌아가기</button>`:""}${cw?`<button class="btn ghost" data-act="drill" data-v="again">틀린 카드만 다시</button>`:""}${nx?`<button class="btn ghost" data-act="home">처음으로</button><button class="btn" data-act="${nx.act}" id="focusme">다음: ${esc(nx.t)}</button>`:`<button class="btn" data-act="home" id="focusme">처음으로</button>`}</div>
  </div>`;
}
function mockResultHTML(){
  const r=session.result;
  const uRows=Object.keys(UNITS).map(u=>{const x=r.byU[u]||[0,0];return {label:UNITS[u][0]+" "+UNITS[u][1],a:x[0],c:x[1]};});
  const kRows=Object.keys(KIND).filter(k=>r.byK[k]).map(k=>({label:KIND[k],a:r.byK[k][0],c:r.byK[k][1]}));
  const weakU=uRows.filter(x=>x.a).sort((a,b)=>a.c/a.a-b.c/b.a)[0];
  const review=session.items.map((it,i)=>{
    const a=session.ans[i]||{};if(a.ok)return "";
    let q="",ans="";
    if(it.k==="card"){const c=byId[it.id];q=esc(c.q);ans=`<b class="c${c.cat}">${esc(c.a)}</b>`;}
    else if(it.k==="src"){const s=srcById[it.id];q="「"+esc(s.text)+"」 "+esc(s.q);ans=`<b class="c${s.cat}">${esc(s.a)}</b> <span class="muted">${esc(s.cite)}</span>`;}
    else{q="연표 순서";ans=tlSorted(it).map(ix=>esc(events[ix].label)+" "+evText(events[ix])).join(" → ");}
    const given=Array.isArray(a.given)?a.given.map(ix=>esc(events[ix].label)).join(" → "):esc(a.given||"(빈칸)");
    return `<li><span class="lv wr">${i+1}번</span><span class="q">${q}</span><span class="q">내 답: ${given}</span><span class="a">정답: ${ans}</span></li>`;
  }).join("");
  return `<div class="panel"><div class="box done">
    <div class="muted">모의고사 결과 · ${Math.floor(r.sec/60)}분 ${r.sec%60}초</div>
    <div class="big">${r.score}점</div>
    <div class="muted">${r.n}문항 중 ${r.c}문항 정답${weakU&&weakU.c<weakU.a?` · 약한 단원 <b>${esc(weakU.label)}</b>`:""}</div></div>
    <div class="box"><h2>단원별</h2>${hbars(uRows)}</div>
    <div class="box"><h2>유형별</h2>${hbars(kRows)}</div>
    ${review?`<div class="box"><h2>틀린 문항 다시 보기</h2><p class="muted">틀린 카드는 복습 목록으로 돌아갔어요.</p><ul class="clist">${review}</ul></div>`:""}
    <div class="row center"><button class="btn" data-act="home" id="focusme">처음으로</button></div></div>`;
}
function focusStudy(){
  requestAnimationFrame(()=>{
    const it=session&&!session.done&&session.items[session.i];
    if(it&&!session.fb){
      if(it.k==="card"&&it.mode==="write"){const w=document.getElementById("wi");if(w){w.focus();return;}}
      if(it.k==="ess"){return;}
    }
    const f=document.getElementById("focusme");if(f&&!f.disabled)f.focus({preventScroll:true});
  });
}
function setFb(fb){session.fb=fb;fbAt=Date.now();render();}

/* 입력 */
app.addEventListener("click",e=>{
  const b=e.target.closest("[data-act]");
  if(!b){const t=e.target.closest("[data-tip]");if(t){const r=t.getBoundingClientRect();showTip(t,r.left+r.width/2,r.top+8);}else hideTip();return;}
  if(b.disabled)return;
  const act=b.dataset.act,v=b.dataset.v;
  const it=session&&!session.done?session.items[session.i]:null;
  if(act==="tab"){view=v;resetAsk=false;sheet=null;if(v==="path")scrollCur=true;render();if(v!=="path")window.scrollTo(0,0);}
  else if(act==="node"){sheet=v;render();}
  else if(act==="sheetclose"){sheet=null;render();}
  else if(act==="backpath"){session=null;view="path";sheet=null;scrollCur=true;render();}
  else if(act==="llearn"||act==="lredo"||act==="lmc"||act==="lskip"){
    const L=nodeById[v];sheet=null;
    const list=L.ids.map(id=>byId[id]);
    let items;
    if(act==="llearn")items=list.filter(c=>levelOf(c.id)<0).map(c=>cardItem(c,"learn")).concat(list.filter(c=>{const s=st(c.id);return s&&s.s&&s.l<4&&(s.l===0||(s.d&&s.d<=today()));}).map(c=>cardItem(c)));
    else if(act==="lredo")items=shuffle(list.map(c=>cardItem(c,levelOf(c.id)>=1?"write":"mc")));
    else items=shuffle(list.map(c=>cardItem(c,"mc")));
    begin("drill",items,{lesson:L.id,test:act==="lskip"});
  }
  else if(act==="nsrc"){sheet=null;begin("drill",srcItems(99,+v),{lesson:"S"+v});}
  else if(act==="ntest"){sheet=null;begin("drill",unitTestItems(+v),{lesson:"T"+v,unitTest:+v});}
  else if(act==="start")startToday();
  else if(act==="ladder"){session=null;sheet=null;skipAsk=false;startLadder();}
  else if(act==="ladderskip"){skipAsk=true;render();}
  else if(act==="ladderskipno"){skipAsk=false;render();}
  else if(act==="ladderskipyes"){skipAsk=false;if(ladderStep()){S.ladder.i++;save();}render();}
  else if(act==="deep"){session=null;startDeep();}
  else if(act==="deepfull"){session=null;startDeep(true);}
  else if(act==="bank"){session=null;startBank(+(v||0));}
  else if(act==="mock"){sheet=null;startMock();}
  else if(act==="ahead"){session=null;begin("drill",unseen().slice(0,10).map(c=>cardItem(c,"learn")),{ahead:true});}
  else if(act==="learned")learned();
  else if(act==="pick"&&it&&!session.fb){
    const i=+v;
    if(session.mock){session.sel=i;render();return;}
    setFb({ok:it.opts[i]===ansOf(it),pick:i});
  }
  else if(act==="ox"&&it&&!session.fb){const said=v==="1";setFb({ok:said===it.truth,said});}
  else if(act==="giveup"&&it&&!session.fb)setFb({ok:false,input:""});
  else if(act==="override"&&session&&session.fb){session.fb.ok=true;session.fb.override=true;render();}
  else if(act==="next")next();
  else if(act==="mocknext")mockNext();
  else if(act==="tlpick"&&it&&!session.fb){
    const ix=+v,p=it.order.indexOf(ix);
    if(p>=0)it.order.splice(p,1);else it.order.push(ix);
    render();
  }
  else if(act==="tlreset"&&it){it.order=[];render();}
  else if(act==="tlcheck"&&it&&!session.fb)setFb({ok:tlCorrect(it)});
  else if(act==="essreveal"&&it){
    const t=v==="skip"?"":(document.getElementById("ei")||{}).value||"";
    setFb({input:t.trim()});
  }
  else if(act==="rate"&&session&&session.fb){session.fb.rating=v;render();}
  else if(act==="quit"||act==="home"){session=null;render();}
  else if(act==="psrc"){const sc=scope();begin("drill",srcItems(8,0,sc.src.length?sc.src:srcs));}
  else if(act==="usrc")begin("drill",srcItems(6,+b.dataset.u));
  else if(act==="wsrc")begin("drill",srcs.filter(s=>(S.src[s.id]||{}).w>0).sort((a,b)=>S.src[b.id].w-S.src[a.id].w).slice(0,15).map(s=>({k:"src",id:s.id,opts:shuffle([s.a].concat(s.x))})));
  else if(act==="ptl"){const sc=scope(),ev=canTl(sc.ev)?sc.ev:events;begin("drill",[1,2,3,4,5].map(()=>tlItem(ev)));}
  else if(act==="pess"){const sc=scope();begin("drill",essItems(3,sc.ess.length?sc.ess:essays));}
  else if(act==="pmix")begin("drill",pick(cards.filter(c=>levelOf(c.id)>=0),20).map(c=>cardItem(c)));
  else if(act==="drill"){
    let list=[];
    if(v==="wrong")list=cards.filter(c=>(st(c.id)||{}).w>0).sort((a,b)=>st(b.id).w-st(a.id).w).slice(0,30);
    else if(v==="unew")list=unseen().filter(c=>c.u===+b.dataset.u).slice(0,10);
    else if(v==="urev")list=pick(cards.filter(c=>c.u===+b.dataset.u&&levelOf(c.id)>=0),20);
    else if(v==="again"&&session)list=session.wrong.filter(w=>w.k==="card").map(w=>byId[w.id]);
    session=null;begin("drill",list.map(c=>cardItem(c)));
    if(!session)render();
  }
  else if(act==="export")doExport();
  else if(act==="importyes"&&importAsk){const keepExam=importAsk.exam;S=importAsk;S.exam=keepExam||S.exam;S.total=0;syncTotal();importAsk=null;ioMsg="기록을 불러왔어요.";save();render();}
  else if(act==="importno"){importAsk=null;ioMsg="";render();}
  else if(act==="copycode"){
    const t=exportText();const done=()=>{ioMsg="기록 코드를 복사했어요.";render();};
    try{navigator.clipboard.writeText(t).then(done,()=>{const ta=document.getElementById("codein");if(ta){ta.value=t;ta.select();}ioMsg="자동 복사가 막혀 있어요. 입력칸에 코드를 넣어 두었으니 직접 복사해 주세요.";const m=document.querySelector('[role=status]');if(m)m.textContent=ioMsg;});}catch(e){}
  }
  else if(act==="pastecode"){const ta=document.getElementById("codein");const st=ta&&parseImport(ta.value.trim());if(st){importAsk=st;ioMsg="";}else ioMsg="기록 코드를 읽을 수 없어요. 처음부터 끝까지 빠짐없이 붙여 넣었는지 확인해 주세요.";render();}
  else if(act==="resetask"){resetAsk=true;render();}
  else if(act==="resetno"){resetAsk=false;render();}
  else if(act==="resetyes"){S=fresh(S.exam);S.total=TOTAL;resetAsk=false;save();render();}
});
app.addEventListener("input",e=>{if(e.target.id==="ei"&&session){const it=session.items[session.i];if(it)it.draft=e.target.value;}});
app.addEventListener("submit",e=>{
  if(e.target.id!=="wf")return;
  e.preventDefault();
  if(!session)return;
  if(session.mock){mockNext();return;}
  if(session.fb)return;
  const val=document.getElementById("wi").value.trim();if(!val)return;
  const it=session.items[session.i];
  setFb({ok:grade(byId[it.id],val),input:val});
});
app.addEventListener("change",e=>{
  if(e.target.id==="impf"&&e.target.files&&e.target.files[0]){
    const f=e.target.files[0],fr=new FileReader();
    fr.onload=()=>{const st=parseImport(String(fr.result));if(st){importAsk=st;ioMsg="";}else ioMsg="이 파일은 이 앱의 기록 파일이 아니에요.";render();};
    fr.onerror=()=>{ioMsg="파일을 읽지 못했어요.";render();};
    fr.readAsText(f);return;
  }
  if(e.target.id!=="exam"||!e.target.value)return;
  S.exam=e.target.value;const d=dayRec();d.p=planNew(d.n);
  save();render();
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&sheet&&!session){sheet=null;render();return;}
  if(!session||session.done||session.fb)return;
  const it=session.items[session.i];
  if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
  if(it.k==="ox"&&/^[12oOxX]$/.test(e.key)){const said=/^[1oO]$/.test(e.key);setFb({ok:said===it.truth,said});return;}
  if((it.k==="src"||it.k==="rev"||it.k==="pair"||(it.k==="card"&&it.mode==="mc"))&&/^[1-4]$/.test(e.key)){
    const i=+e.key-1;if(!it.opts||i>=it.opts.length)return;
    if(session.mock){session.sel=i;render();return;}
    setFb({ok:it.opts[i]===ansOf(it),pick:i});
  }
});

syncTotal();
render();
initRemote();
})();
