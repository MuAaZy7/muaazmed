(async function(){
"use strict";
await window.MED_MASTER_READY;
const root=document.getElementById("cp-app");
const STORE="muaazmed-blind-clusters-v2";
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tidy=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();
const papers=window.MED_PAPER_GROUPS?.papers||[];
const second=papers.find(x=>x.paper==="Paper 2");
const paper2Names=new Set((second?.subjects||[]).flatMap(s=>s.conditions.map(tidy)));
const maps={16:["Anaphylaxis","Anaphylactic Shock"],35:["HIV/AIDS","Oral Candidiasis"],2:["Sepsis"],17:["Sepsis"],12:["Cardiac Arrhythmia"],32:["Congestive Cardiac Failure"],1:["Ischaemic Heart Disease"],13:["Pulmonary Embolism"],3:["Shock"],26:["Asthma"],33:["Chronic Obstructive Pulmonary Disease (COPD)"],11:["Pneumonia"],7:["Tuberculosis"],5:["Acute Kidney Injury"],34:["Nephritic syndrome","Nephrotic syndrome"],23:["Renal Calculi"],19:["Liver Cirrhosis","Ascites"],14:["Liver Cirrhosis"],6:["Upper GI Bleed","Peptic Ulcer Disease"],20:["Aplastic Anaemia"],10:["Iron Deficiency Anaemia"],27:["Stroke"]};
const raw=[...(window.MED_BANK||[]),...(window.MED_EXTRA||[]),...(window.MED_INTEGRATED_CASES||[]),...(window.MED_P2_EXTREME||[]),...(window.MED_MASTER_HARD||[]),...(window.MED_P2_KAKAMED||[])];
const names=c=>Array.isArray(c.core)?c.core:(c.core?[c.core]:(maps[c.id]||[]));
function siteFor(p){
 const allowed=new Set((papers.find(x=>x.paper===p)?.subjects||[]).flatMap(s=>s.conditions.map(tidy))),seen=new Set();
 return raw.filter(c=>{if(seen.has(String(c.id))||(p==="Paper 1"&&c.paper2Only)||(!(p==="Paper 2"&&c.masterHard)&&!names(c).some(n=>allowed.has(tidy(n)))))return false;seen.add(String(c.id));return true;}).map(c=>({...c,id:"site-"+c.id,core:names(c),questions:(c.questions||[]).filter(q=>q&&q.q&&q.answer&&(q.options?.length===4&&/^[ABCD]$/.test(q.answer)||!q.options?.length)).map((q,i)=>({...q,number:q.number||i+1,type:q.options?.length===4?"SBA":"VSAQ",answer:String(q.answer),accepted:q.accepted||[],explain:q.explain||q.point||"Review the expected answer."}))})).filter(c=>c.scenario&&c.questions.length);
}
const p2=siteFor("Paper 2"),sprint=p2.filter(c=>c.sprint);
const groups=(papers.find(x=>x.paper==="Paper 2")?.subjects||[]).map(s=>({name:s.name,cases:[]}));
for(const c of sprint){const g=groups.find(g=>papers.find(p=>p.paper==="Paper 2").subjects.find(s=>s.name===g.name).conditions.some(n=>c.core.includes(n)));if(g)g.cases.push(c);}
const mixed=[];while(groups.some(g=>g.cases.length)){for(const g of groups){if(g.cases.length)mixed.push(g.cases.shift());}}
const mockIds={mockA:new Set(mixed.slice(0,15).map(c=>c.id)),mockB:new Set(mixed.slice(15,30).map(c=>c.id))};
const pool={"Paper 1":[...siteFor("Paper 1"),...(window.MED_PDF_PAPER1||[]).filter(c=>c.questions?.length)],"Paper 2":[...sprint,...p2.filter(c=>!c.sprint)],...Object.fromEntries((window.MED_EYE1_PAPERS||[]).map((cases,i)=>["EYE1 Paper "+(i+1),cases]))};
const IEYA2="IEYA2 Practice";
const studentCases=window.MED_IEYA2_STUDENT||[];
if(studentCases.length)pool[IEYA2]=studentCases;
let db={active:"Paper 2",randomize:false,sessions:{},showAll:false,subject:"All",condition:"All",bank:"hard",revealed:{},view:"landing"};
try{const x=JSON.parse(localStorage.getItem(STORE)||"null");if(x&&typeof x==="object")db={...db,...x,sessions:x.sessions||{},revealed:x.revealed||{}};}catch(_){}
const params=new URLSearchParams(location.search),requestedPaper=params.get("paper");
if(requestedPaper&&pool[requestedPaper]&&(requestedPaper!==db.active||requestedPaper===IEYA2)){db.active=requestedPaper;db.subject="All";db.condition="All";db.view="landing";}
if(!pool[db.active])db.active="Paper 2";
const requestedCondition=params.get("condition");if(requestedCondition){db.condition=requestedCondition;db.subject="All";db.bank="all";db.view="landing";}
const requestedBank=params.get("bank");if(["focused","expanded","sprint","hard","easy","master","extreme","kakamed","all","mockA","mockB"].includes(requestedBank)){db.bank=requestedBank;db.subject="All";db.condition=requestedCondition||"All";db.view="landing";}
const requestedId=params.get("cluster");
function subjects(){if(db.active===IEYA2)return ["Renal","GIT","MSK","Haem/Onc"].map(name=>({name,conditions:[...new Set(studentCases.filter(c=>c.sourceSubjects.includes(name)).flatMap(c=>c.core))]}));const list=papers.find(p=>p.paper===db.active)?.subjects||[];return db.active==="Paper 2"&&window.MED_MASTER_HARD?.length?[...list,{name:"Crossover",conditions:["Pulmonary Embolism"]}]:list;}
function conditions(){return [...new Set(subjects().filter(s=>db.subject==="All"||s.name===db.subject).flatMap(s=>s.conditions))].sort();}
function filtered(){
 let list=pool[db.active].map((c,i)=>({c,i}));
 if(db.active==="Paper 2"){
   if(db.bank==="master")list=list.filter(x=>x.c.masterHard);
   if(db.bank==="kakamed")list=list.filter(x=>x.c.kakamed);
   if(db.bank==="easy")list=list.filter(x=>!x.c.masterHard&&!x.c.extreme&&!x.c.expansion&&!/challenge|hard|advanced|expert|extreme/i.test(String(x.c.difficulty||"")));
   if(db.bank==="sprint")list=list.filter(x=>x.c.sprint);
   if(db.bank==="expanded")list=list.filter(x=>x.c.expansion);
   if(db.bank==="extreme")list=list.filter(x=>x.c.extreme);
   if(db.bank==="hard")list=list.filter(x=>x.c.masterHard||x.c.extreme||x.c.expansion||(!x.c.sprint&&/challenge|hard|advanced|expert|extreme/i.test(String(x.c.difficulty||"")))).sort((a,b)=>Number(!!b.c.masterHard)-Number(!!a.c.masterHard)||Number(!!b.c.extreme)-Number(!!a.c.extreme));
   if(db.bank==="focused")list=list.filter(x=>x.c.sprint||x.c.expansion).sort((a,b)=>{const ai=a.c.sprint?Number(a.c.id.replace("site-",""))-5000:Number(a.c.id.replace("site-",""))-6000;const bi=b.c.sprint?Number(b.c.id.replace("site-",""))-5000:Number(b.c.id.replace("site-",""))-6000;return ai-bi||Number(!!a.c.expansion)-Number(!!b.c.expansion);});
   if(db.bank==="mockA"||db.bank==="mockB")list=list.filter(x=>mockIds[db.bank].has(x.c.id)).sort((a,b)=>mixed.indexOf(a.c)-mixed.indexOf(b.c));
 }
 if(db.active===IEYA2)return list.filter(({c})=>(db.subject==="All"||c.sourceSubjects.includes(db.subject))&&(db.condition==="All"||c.core.some(n=>tidy(n)===tidy(db.condition))));
 const allowed=conditions().map(tidy);
 return list.filter(({c})=>{if(c.kakamed&&db.subject!=="All"&&db.subject!==c.module)return false;const tags=(Array.isArray(c.core)?c.core:[]).map(tidy);if(db.condition!=="All")return tags.includes(tidy(db.condition));if(db.subject!=="All")return tags.some(t=>allowed.includes(t))||(!tags.length&&(c.module===db.subject||c.subject===db.subject));return true;});
}
function titleOf(c){return (Array.isArray(c.core)&&c.core.length?c.core.join(" / "):c.title)||c.module||c.subject||"Condition not tagged in source";}
function choiceSelect(id,values,selected){return '<select id="'+id+'" style="padding:8px;max-width:100%;border:1px solid #c9d7e9;border-radius:8px;background:white">'+values.map(([v,label])=>'<option value="'+esc(v)+'" '+(v===selected?"selected":"")+'>'+esc(label)+'</option>').join("")+'</select>';}
function save(){try{localStorage.setItem(STORE,JSON.stringify(db));}catch(_){}} 
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function sessionKey(){return [db.active,db.active==="Paper 2"?db.bank:"all",db.subject,db.condition].join("|");}
function session(){const x=db.sessions[sessionKey()];return x&&Array.isArray(x.order)&&x.order.length?x:null;}
function makeSession(randomize=db.randomize){const order=filtered().map(x=>x.i);if(!order.length){db.view="landing";render();return;}if(randomize)shuffle(order);db.sessions[sessionKey()]={order,pos:0,q:0,answers:{},finished:false,created:Date.now(),randomize};db.randomize=randomize;save();render();}
function current(s){const c=pool[db.active][s.order[s.pos]];return {c,q:c?.questions[s.q],key:c?c.id+":"+(s.q):""};}
function score(s){const a=Object.values(s.answers||{});return {answered:a.length,correct:a.filter(x=>x.correct).length};}
function totalFor(p){return pool[p].reduce((n,c)=>n+c.questions.length,0);}
function statCard(p){const s=session(),count=filtered().length,done=s?score(s):{answered:0,correct:0};return '<div class="cp-stat"><strong>'+count+'</strong><span>Case clusters</span></div><div class="cp-stat"><strong>'+filtered().reduce((n,x)=>n+x.c.questions.length,0)+'</strong><span>Practice questions</span></div><div class="cp-stat"><strong>'+done.answered+'</strong><span>Answered this session</span></div><div class="cp-stat"><strong>'+(done.answered?Math.round(done.correct/done.answered*100)+"%":"—")+'</strong><span>Session accuracy</span></div>';}
function landing(){
 const p=db.active,s=session(),cases=filtered(),visible=db.showAll?cases:cases.slice(0,42);
 const paperTabs=Object.keys(pool).map(name=>'<button data-act="paper" data-paper="'+esc(name)+'" class="'+(p===name?"selected":"")+'>'+esc(name)+'</button>').join("");
 const paperDescription=p==="Paper 2"&&db.bank==="kakamed"?"P2 KakaMed · Zain Kaka: 36 Renal and GIT clusters, 288 questions. Estimated difficulty 3/5 (applied) to 4/5 (hard), compared with foundational and extreme banks; not student performance data.":p===IEYA2?"Student-authored GEMP1 Paper 2 practice by Mariam Baruffwala (2026): 19 clusters, 135 questions. Filter by block and core; source answer keys and explanations retained. Not an official exam.":p.startsWith("EYE1 Paper")?"Complete uploaded GEMP1 EYE1 practice PDF: 16 case clusters, 120 questions, BCMH/CVS/RESP, original short-answer targets and explanations.":p==="Paper 1"?"Original site cases plus uploaded Paper 1 practice questions. Uploaded cases without condition tags remain under All.":"Choose the new 117-cluster master bank, Hard clinical reasoning, or foundational practice. Core conditions are visible when choosing a case; the case itself remains blind.";
 root.innerHTML='<div class="cp-hero"><a class="cp-back" href="index.html#practice">← All practice questions</a><div class="cp-overline">GEMP1 · EXAM PREP</div><h1>Case cluster study mode</h1><p>Work through complete clinical cases without being told the diagnosis. Choose a paper, answer each SBA or VSAQ, and get instant feedback before moving on.</p></div>'+
 '<div class="cp-tabs" role="group" aria-label="Select practice paper">'+paperTabs+'</div>'+
 '<div class="cp-stats">'+statCard(p)+'</div>'+
 '<section class="cp-config"><div><h2>'+esc(p)+' · Case clusters</h2><p>'+esc(paperDescription)+'</p><div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:15px">'+(p==="Paper 2"?'<label>Question set '+choiceSelect("cp-bank",[["hard","Hard · clinical reasoning"],["master","Master bank · 117 clusters"],["extreme","Extreme · 49 clusters"],["kakamed","P2 KakaMed · Zain Kaka · 36 clusters"],["easy","Easy / foundational"],["focused","Focused bank"],["expanded","Applied cases"],["sprint","Quick sprint"],["all","Full archive"],["mockA","Mock A · study"],["mockB","Mock B · study"]],db.bank)+'</label>':"")+(subjects().length?'<label>Subject '+choiceSelect("cp-subject",[["All","All subjects"],...subjects().map(s=>[s.name,s.name])],db.subject)+'</label><label>Core condition '+choiceSelect("cp-condition",[["All","All conditions"],...conditions().map(n=>[n,n])],db.condition)+'</label>':"")+'</div><p>'+cases.length+' matching clusters · '+cases.reduce((n,x)=>n+x.c.questions.length,0)+' questions</p><label class="cp-toggle"><input type="checkbox" id="cp-shuffle" '+(db.randomize?"checked":"")+'> Randomise cluster order</label></div><div class="cp-actions"><button class="cp-primary" data-act="start">Start continuous study →</button>'+(s?'<button class="cp-secondary" data-act="continue">Continue session ('+score(s).answered+' answered)</button>':"")+'</div></section>'+
 '<div class="cp-list-head"><h2>Choose any cluster</h2><span>Core condition shown here · diagnosis hidden during practice</span></div>'+
 '<div class="cp-grid">'+visible.map(({c,i},j)=>'<article class="cp-cluster"><span class="cp-cluster-number">CLUSTER '+String(j+1).padStart(2,"0")+'</span><strong>'+esc(titleOf(c))+'</strong><small>'+c.questions.length+' questions · SBA + short answers'+(p===IEYA2?" · Student practice":c.kakamed?" · KakaMed / "+c.difficultyRating+"/5 "+(c.difficultyRating===4?"Hard":"Applied"):c.masterHard?" · Master bank / Hard":c.extreme?" · Extreme":c.sprint?" · Sprint":c.expansion?" · Applied":/challenge|hard|advanced|expert/i.test(String(c.difficulty||""))?" · Hard":" · Easy / core")+'</small><div class="cp-actions"><button class="cp-primary" data-act="open" data-idx="'+i+'">Practise →</button></div></article>').join("")+'</div>'+
 (cases.length>visible.length?'<button class="cp-secondary cp-more" data-act="more">Show all '+cases.length+' clusters</button>':"")+
 '<p class="cp-note">Study-paper groupings are for revision, not a guarantee of Wits examination allocation. All questions are educational practice, not official Wits past-paper questions. Progress is saved on this device.</p>';
}
function answerRecord(value){const s=session();if(!s||s.finished)return;const {q,key}=current(s);if(!q||Object.hasOwn(s.answers,key))return;const given=String(value||"").trim();if(!given)return;const target=tidy(q.answer);const aliases=[q.answer,...(q.accepted||[])].map(tidy);const correct=q.type==="SBA"?given===q.answer:aliases.includes(tidy(given));s.answers[key]={given,correct,time:Date.now()};save();render();}
function skipCase(){const s=session();if(!s||s.finished)return;if(s.pos>=s.order.length-1){s.finished=true;}else{s.pos++;s.q=0;}save();render();}
function next(delta,skip=false){const s=session();if(!s||s.finished)return;const item=current(s);if(!item.q)return;if(delta>0&&!skip&&!Object.hasOwn(s.answers,item.key))return;let pos=s.pos,q=s.q+delta;if(q>=pool[db.active][s.order[pos]].questions.length){pos++;q=0;}if(q<0){pos--;if(pos>=0)q=pool[db.active][s.order[pos]].questions.length-1;}if(pos<0)return;if(pos>=s.order.length){s.finished=true;save();render();return;}s.pos=pos;s.q=q;save();render();}
let scoreUploading=false;
async function publishStudyScore(){
 const s=session(),a=s?score(s):null,bank=db.bank;
 if(!s||!s.finished||db.active!=="Paper 2"||!["mockA","mockB"].includes(bank)||a.answered!==120||s.order.reduce((n,i)=>n+pool[db.active][i].questions.length,0)!==120||scoreUploading)return;
 const el=document.getElementById("cp-board-status"),cfg=window.MED_BACKEND||{};
 if(!cfg.url||!(cfg.publishableKey||cfg.anonKey)){if(el)el.textContent="Leaderboard backend not connected.";return;}
 scoreUploading=true;try{
  const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");const api=createClient(cfg.url,cfg.publishableKey||cfg.anonKey);
  const {data}=await api.auth.getSession();if(!data.session)throw Error("Sign in to save your completed mock.");
  const m=await api.rpc("member_status");if(m.error||!m.data?.active)throw Error("Active membership required.");
  if(s.uploadOwner&&s.uploadOwner!==data.session.user.id)throw Error("This mock was saved under another account.");
  s.uploadOwner=data.session.user.id;s.attemptId=s.attemptId||crypto.randomUUID();save();
  const {error}=await api.from("study_results").insert({user_id:data.session.user.id,attempt_id:s.attemptId,paper:bank==="mockA"?"A":"B",correct:a.correct,answered:a.answered});
  if(error&&error.code!=="23505")throw error;if(el)el.textContent="Completed mock saved. Leaderboard display depends on your opt-in setting.";
 }catch(e){if(el)el.textContent=e.message||"Unable to save mock.";}finally{scoreUploading=false;}
}
function review(){
 const s=session(),a=score(s),missed=[];for(const idx of s.order){const c=pool[db.active][idx];c.questions.forEach((q,i)=>{const x=s.answers[c.id+":"+i];if(x&&!x.correct)missed.push({c,idx,q,i,x});});}
 root.innerHTML='<div class="cp-hero"><a href="#" class="cp-back" data-act="home">← Back to clusters</a><div class="cp-overline">'+esc(db.active)+'</div><h1>Practice complete</h1><p>Review the explanations or start a fresh shuffled run. Unanswered questions (including skipped questions and clusters) are not scored.</p></div><div class="cp-stats"><div class="cp-stat"><strong>'+a.correct+'</strong><span>Correct</span></div><div class="cp-stat"><strong>'+a.answered+'</strong><span>Answered</span></div><div class="cp-stat"><strong>'+Math.round(a.correct/Math.max(1,a.answered)*100)+'%</strong><span>Accuracy</span></div><div class="cp-stat"><strong>'+missed.length+'</strong><span>Incorrect · to revise</span></div><div class="cp-stat"><strong>'+(s.order.reduce((n,i)=>n+pool[db.active][i].questions.length,0)-a.answered)+'</strong><span>Unanswered / skipped</span></div></div><div class="cp-actions"><button class="cp-primary" data-act="start" data-random="yes">Practise again · shuffled</button><button class="cp-secondary" data-act="home">Back to clusters</button></div>'+
 '<section class="cp-review"><h2>Questions to revisit</h2>'+(missed.length?missed.map(x=>'<article><strong>'+esc(x.q.q)+'</strong><p>Your answer: '+esc(x.x.given)+'</p><p>Correct answer: <b>'+esc(correctLabel(x.q))+'</b></p><p>'+esc(x.q.explain)+'</p></article>').join(""):'<p>No incorrect answers in this session.</p>')+'</section>'+((db.active==="Paper 2"&&["mockA","mockB"].includes(db.bank))?'<p id="cp-board-status" role="status">'+(a.answered===120?"Saving completed mock…":"Only complete 120-question mock attempts count on the leaderboard.")+'</p><a class="cp-secondary" href="/leaderboard.html">Community leaderboard ↗</a>':"");
 publishStudyScore();
}
function correctLabel(q){return q.type==="SBA"&&q.options?' '+q.answer+". "+q.options["ABCD".indexOf(q.answer)]:q.answer;}
function play(){
 const s=session();if(!s){landing();return;}if(s.finished){review();return;}
 const {c,q,key}=current(s);if(!c||!q){landing();return;}const a=s.answers[key],t=score(s),totalCases=s.order.length;
 const caseQuestions=c.questions.length,atLast=s.pos===s.order.length-1&&s.q===caseQuestions-1;
 const currLabel='Cluster '+String(s.pos+1).padStart(2,"0")+' of '+totalCases;
 const choices=q.type==="SBA"?(q.options||[]).map((opt,i)=>{const letter="ABCD"[i],isRight=letter===q.answer,isWrong=a&&letter===a.given&&!isRight;return '<button data-act="choose" data-value="'+letter+'" class="cp-choice '+(a&&isRight?"correct":isWrong?"incorrect":"")+'" '+(a?"disabled":"")+'><span class="cp-letter">'+letter+'</span><span>'+esc(opt)+'</span>'+(a&&isRight?'<b class="cp-answer-mark">✓</b>':isWrong?'<b class="cp-answer-mark">✕</b>':"")+'</button>';}).join(""):'<form id="cp-vsaq-form"><label for="cp-vsaq">Your answer (usually 1–3 words)</label><input id="cp-vsaq" autocomplete="off" placeholder="Type your answer" '+(a?"disabled":"")+' value="'+(a?esc(a.given):"")+'"><button class="cp-primary" type="submit" '+(a?"disabled":"")+'>Check answer</button></form>';
 const eachOption=a&&q.type==="SBA"&&q.options&&Array.isArray(q.whyOptions)?'<section class="cp-option-feedback"><h3>Option-by-option review</h3>'+q.options.map((opt,i)=>{const letter="ABCD"[i],isRight=letter===q.answer,reason=(Array.isArray(q.whyOptions)&&q.whyOptions[i])||(!isRight?"No separate distractor rationale was provided in this source.":(q.explain||"This is the best-supported answer."));return '<div class="cp-option-note '+(isRight?"is-right":"is-wrong")+'"><b>'+letter+'. '+esc(opt)+' — '+(isRight?"Correct":"Incorrect")+'</b><p>'+esc(reason)+'</p></div>';}).join("")+'</section>':"";
 const fb=a?'<div class="cp-feedback '+(a.correct?"correct":"incorrect")+'" role="status" aria-live="polite"><span class="cp-feedback-status">'+(a.correct?"✓ Correct":"✕ Not quite")+'</span><div class="cp-solution"><small>CORRECT ANSWER</small><strong>'+esc(correctLabel(q))+'</strong></div><h3>Why this is the answer</h3><p>'+esc(q.explain||"")+'</p>'+eachOption+(a.given&&!a.correct&&q.whyOptions&&q.type==="SBA"&&q.whyOptions["ABCD".indexOf(a.given)]?'<p><b>Your chosen option:</b> '+esc(q.whyOptions["ABCD".indexOf(a.given)])+'</p>':"")+(q.point?'<p class="cp-takeaway"><b>Key point:</b> '+esc(q.point)+'</p>':"")+(q.type==="VSAQ"&&!a.correct?'<button class="cp-secondary cp-self" data-act="selfmark">My equivalent answer is correct</button>':"")+'</div>':"";
 root.innerHTML='<div class="cp-play"><div class="cp-play-top"><button class="cp-back" data-act="home">← Clusters</button><span class="cp-pill">'+esc(db.active)+(c.kakamed?' · KakaMed · '+c.difficultyRating+'/5':'')+'</span><label class="cp-jump-label">Jump to case <select id="cp-jump" aria-label="Jump to cluster">'+s.order.map((_,i)=>'<option value="'+i+'" '+(i===s.pos?"selected":"")+'>Case '+(i+1)+'</option>').join("")+'</select></label><span class="cp-saving">✓ Saved on this device</span></div>'+
 '<div class="cp-progress"><div><b>'+currLabel+'</b><span>Question '+(s.q+1)+' of '+caseQuestions+' · '+t.answered+' attempted · '+t.correct+' correct</span></div><div class="cp-progress-bar"><span style="width:'+Math.round((s.pos+s.q/caseQuestions)/totalCases*100)+'%"></span></div></div>'+
 '<article class="cp-case"><div class="cp-case-kicker">CLINICAL SCENARIO</div><button class="cp-secondary" data-act="reveal" data-id="'+esc(c.id)+'">'+(db.revealed[c.id]?"Hide condition":"Reveal condition")+'</button>'+(db.revealed[c.id]?'<p><b>'+esc(titleOf(c))+'</b></p>':"")+'<div class="cp-scenario">'+esc(c.scenario||"")+(c.labContext?'<div style="white-space:pre-line;margin-top:12px;font-size:.9em"><b>Investigations</b>\n'+esc(c.labContext)+'</div>':"")+'</div><div class="cp-qkicker">QUESTION '+(s.q+1)+' · '+(q.type==="VSAQ"?"VERY SHORT ANSWER":q.isData?"DATA INTERPRETATION":"SINGLE BEST ANSWER")+'</div>'+(q.context?'<div class="cp-scenario" style="white-space:pre-line">'+esc(q.context)+'</div>':"")+'<h2>'+esc(q.q)+'</h2><div class="cp-options">'+choices+'</div>'+fb+
 '<div class="cp-next"><button class="cp-secondary" data-act="prev" aria-keyshortcuts="P ArrowLeft" '+(s.pos===0&&s.q===0?"disabled":"")+'>← Previous</button><button class="cp-secondary" data-act="skip-question" aria-keyshortcuts="S">Skip question</button><button class="cp-secondary" data-act="skip" aria-keyshortcuts="K">Skip cluster ↷</button><button class="cp-primary" data-act="next" aria-keyshortcuts="Enter N ArrowRight" '+(!a?"disabled":"")+'>'+(atLast?"Finish practice →":s.q===caseQuestions-1?"Next cluster →":"Next question →")+'</button></div><p class="cp-note"><b>Keyboard:</b> A–D / 1–4 answer · Enter / N / → next · S skip question · K skip cluster · P / ← previous</p></article></div>';
}
function render(){if(!root)return;if(db.view==="play")play();else landing();}
root.addEventListener("click",e=>{const target=e.target.closest("[data-act]");if(!target)return;const act=target.dataset.act;e.preventDefault();
 if(act==="paper"){db.active=target.dataset.paper;db.view="landing";db.showAll=false;db.subject="All";db.condition="All";db.bank="hard";if(window.history?.replaceState&&window.location){const params=new URLSearchParams(window.location.search);params.set("paper",db.active);window.history.replaceState(null,"",window.location.pathname+"?"+params.toString());}save();render();}
 if(act==="start"){db.view="play";makeSession(target.dataset.random==="yes"?true:db.randomize);}
 if(act==="continue"){db.view="play";save();render();}
 if(act==="home"){db.view="landing";save();render();}
 if(act==="more"){db.showAll=true;save();render();}
 if(act==="reveal"){const id=target.dataset.id;db.revealed[id]=!db.revealed[id];save();render();}
 if(act==="open"){const idx=+target.dataset.idx;delete db.revealed[pool[db.active][idx]?.id];const order=filtered().map(x=>x.i),pos=order.indexOf(idx);if(pos<0)return;db.sessions[sessionKey()]={order,pos,q:0,answers:{},finished:false,created:Date.now(),randomize:false};db.view="play";save();render();}
 if(act==="choose")answerRecord(target.dataset.value);
 if(act==="prev")next(-1);
 if(act==="skip-question")next(1,true);
 if(act==="skip")skipCase();
 if(act==="next")next(1);
 if(act==="selfmark"){const s=session(),k=current(s).key;if(s.answers[k]){s.answers[k].correct=true;s.answers[k].selfMarked=true;save();render();}}
});
root.addEventListener("change",e=>{if(["cp-bank","cp-subject","cp-condition"].includes(e.target.id)){if(e.target.id==="cp-bank")db.bank=e.target.value;if(e.target.id==="cp-subject"){db.subject=e.target.value;db.condition="All";}if(e.target.id==="cp-condition")db.condition=e.target.value;db.showAll=false;if(window.history?.replaceState){const p=new URLSearchParams(location.search);p.set("paper",db.active);p.delete("cluster");p.delete("condition");p.delete("bank");window.history.replaceState(null,"",location.pathname+"?"+p.toString());}save();render();return;}if(e.target.id==="cp-shuffle"){db.randomize=e.target.checked;save();}if(e.target.id==="cp-jump"){const s=session(),n=Number(e.target.value);if(s&&Number.isInteger(n)&&n>=0&&n<s.order.length){s.pos=n;s.q=0;save();render();}}});
root.addEventListener("submit",e=>{if(e.target.id==="cp-vsaq-form"){e.preventDefault();answerRecord(document.getElementById("cp-vsaq")?.value);}});
window.addEventListener("keydown",e=>{
 if(db.view!=="play"||e.defaultPrevented||e.repeat||e.isComposing||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
 if(e.target?.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(e.target?.tagName))return;
 const s=session();if(!s||s.finished)return;
 const {q,key}=current(s);if(!q)return;
 const k=e.key.toLowerCase();
 const answer=/^[abcd]$/.test(k)?k.toUpperCase():/^[1-4]$/.test(k)?"ABCD"[Number(k)-1]:null;
 if(answer&&q.type==="SBA"&&!Object.hasOwn(s.answers,key)){e.preventDefault();answerRecord(answer);return;}
 if(k==="s"){e.preventDefault();next(1,true);return;}
 if(k==="k"){e.preventDefault();skipCase();return;}
 if(k==="p"||k==="arrowleft"){e.preventDefault();next(-1);return;}
 if((k==="n"||k==="arrowright"||k==="enter")&&Object.hasOwn(s.answers,key)){
  if(k==="enter"&&["BUTTON","A","SUMMARY"].includes(e.target?.tagName))return;
  e.preventDefault();next(1);
 }
});
document.querySelectorAll("[data-cp-mobile-menu]").forEach(b=>b.addEventListener("click",()=>{const open=document.querySelector(".sidebar")?.classList.toggle("cp-open");b.setAttribute("aria-expanded",String(!!open));}));document.addEventListener("click",e=>{const side=document.getElementById("sidebar");if(side?.classList.contains("cp-open")&&!e.target.closest("[data-cp-mobile-menu]")&&(!side.contains(e.target)||e.target.closest(".nav-stack a"))){side.classList.remove("cp-open");document.querySelector("[data-cp-mobile-menu]")?.setAttribute("aria-expanded","false");}});document.addEventListener("keydown",e=>{if(e.key==="Escape"){document.getElementById("sidebar")?.classList.remove("cp-open");document.querySelector("[data-cp-mobile-menu]")?.setAttribute("aria-expanded","false");}});
if(requestedId){const index=pool[db.active].findIndex(c=>c.id==="site-"+requestedId);if(index>=0){const order=filtered().map(x=>x.i);const pos=order.indexOf(index);if(pos>=0){db.sessions[sessionKey()]={order,pos,q:0,answers:{},finished:false,created:Date.now(),randomize:false};db.view="play";save();}}if(window.history?.replaceState){params.delete("cluster");params.delete("condition");params.delete("bank");window.history.replaceState(null,"",location.pathname+"?"+params.toString());}}
render();
})();