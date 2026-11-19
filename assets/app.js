(function(){
"use strict";
const EYE_NOTES=Array.isArray(window.MED_NOTES)?window.MED_NOTES:[];
const RAW_CASES=[...(window.MED_BANK||[]),...(window.MED_EXTRA||[]),...(window.MED_INTEGRATED_CASES||[])];
const SLIDES=window.MED_SLIDES||[];
const CONFIG=window.MED_BACKEND||{};
const CORE_MAP={
 16:["Anaphylaxis","Anaphylactic Shock"],35:["HIV/AIDS","Oral Candidiasis"],2:["Sepsis"],
 17:["Sepsis"],12:["Cardiac Arrhythmia"],32:["Congestive Cardiac Failure"],
 1:["Ischaemic Heart Disease"],13:["Pulmonary Embolism"],3:["Shock"],26:["Asthma"],
 33:["Chronic Obstructive Pulmonary Disease (COPD)"],11:["Pneumonia"],7:["Tuberculosis"],
 5:["Acute Kidney Injury"],34:["Nephritic syndrome","Nephrotic syndrome"],
 23:["Renal Calculi"],19:["Liver Cirrhosis","Ascites"],14:["Liver Cirrhosis"],
 6:["Upper GI Bleed","Peptic Ulcer Disease"],20:["Aplastic Anaemia"],
 10:["Iron Deficiency Anaemia"],27:["Stroke"]
};
const MODULE_ICON={"BCMH":"◈","CVS":"♡","Respiratory":"◉","Renal":"◇","GIT":"≈","MSK":"✳","Haem/Onc":"✦"};
/* User-provided GEMP1 study organisation; the official guide does not prescribe this paper split. */
const PAPER_GROUPS=window.MED_PAPER_GROUPS?.papers||[];
const SUBJECTS=["BCMH","CVS","Respiratory","Renal","GIT","MSK","Haem/Onc"];
const STUDY_TAGS=new Map();
for(const p of PAPER_GROUPS)for(const s of p.subjects)for(const name of s.conditions){
 const key=String(name).toLowerCase(), tags=STUDY_TAGS.get(key)||[];
 tags.push({paper:p.paper,subject:s.name});STUDY_TAGS.set(key,tags);
}
function tagsFor(name){return STUDY_TAGS.get(String(name||"").toLowerCase())||[]}
function caseTags(c){const unique=new Map();for(const name of c.coreNames||[])for(const tag of tagsFor(name))unique.set(tag.paper+"|"+tag.subject,tag);return [...unique.values()]}
function subjectOptions(paper){return PAPER_GROUPS.filter(p=>paper==="All"||p.paper===paper).flatMap(p=>p.subjects.map(s=>s.name)).filter((s,i,a)=>a.indexOf(s)===i)}
function selectOptions(paper,subject,subjectOnly=false){
 const all=subjectOnly?'<option value="All">All subjects</option>':'<option value="All">Both study papers</option>';
 const values=subjectOnly?subjectOptions(paper):PAPER_GROUPS.map(p=>p.paper);
 return all+values.map(value=>'<option value="'+esc(value)+'"'+((subjectOnly?subject:paper)===value?" selected":"")+'>'+esc(value)+'</option>').join("");
}
function subjectMark(paper,subject){return '<span class="study-mini-badge">'+esc(paper)+' · '+esc(subject)+'</span>'}
function labelsFor(name){return tagsFor(name).map(t=>subjectMark(t.paper,t.subject)).join("")}
function caseLabel(c){const t=caseTags(c);return t.length?t.slice(0,3).map(x=>x.paper+" / "+x.subject).join(" · "):"Integrated"}
const CASES=RAW_CASES.map(c=>Object.assign({},c,{coreNames:Array.isArray(c.core)?c.core:(c.core?[c.core]:(CORE_MAP[c.id]||[]))}));
const CORE_CASES=CASES.filter(c=>c.coreNames.length>0);
const KEY="muaazmed-gemp1-2026-v5";
const defaultState=()=>({learned:[],saved:[],quickChecks:{},flashcards:{},flashSession:null,caseAnswers:{},practiceHistory:[],flowSessions:{},flags:{},mockSessions:{},mockHistory:[],guestName:"Guest student",lastVisited:null});
let state=defaultState();
try{const p=JSON.parse(localStorage.getItem(KEY)||"null");if(p&&typeof p==="object")state=Object.assign(defaultState(),p)}catch(e){}
if(!Array.isArray(state.learned))state.learned=[];
if(!Array.isArray(state.saved))state.saved=[];
if(!state.flashcards||typeof state.flashcards!=="object")state.flashcards={};
if(!Array.isArray(state.mockHistory))state.mockHistory=[];
if(!state.mockSessions||typeof state.mockSessions!=="object")state.mockSessions={};
if(!state.caseAnswers||typeof state.caseAnswers!=="object")state.caseAnswers={};
if(!Array.isArray(state.practiceHistory))state.practiceHistory=[];
if(!state.flowSessions||typeof state.flowSessions!=="object")state.flowSessions={};
let filterNotes="All",notePaper="All",noteSubject="All",filterCases="All",casePaper="All",caseSubject="All",filterLectures="All",searchText="",currentTimer=null,toastTimer=null;
let supabase=null,authUser=null,syncTimer=null,authReady=false,communityEntries=[];
let activeQuestion=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();
const today=()=>new Date().toISOString().slice(0,10);
const short=(s,n=130)=>String(s||"").length>n?String(s).slice(0,n).trimEnd()+"…":String(s||"");
const titleCase=s=>String(s||"").replace(/\b\w/g,x=>x.toUpperCase());
const courseName=c=>c&&c.category||"BCMH";
const goto=url=>{if(location.hash!==url)location.hash=url;else render()};
const noteHash=n=>"#note/"+encodeURIComponent(n);
const caseHash=(id,idx=0)=>"#case/"+encodeURIComponent(String(id))+"/"+idx;
const qrKey=(c,q)=>String(c.id)+":"+String(q.number);
const totalQuestions=CASES.reduce((n,c)=>n+c.questions.length,0);
function toast(msg){const el=$("toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2900)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){toast("Local storage full; export your progress.")}if(authUser&&supabase){clearTimeout(syncTimer);syncTimer=setTimeout(syncNow,1300)}}
function progressPct(){return Math.round(state.learned.length/Math.max(1,EYE_NOTES.length)*100)}
function answeredCount(){return Object.keys(state.caseAnswers).length}
function caseAccuracy(){const a=Object.values(state.caseAnswers);return a.length?Math.round(a.filter(x=>x.correct).length/a.length*100):null}
function bestScore(){const a=state.mockHistory.filter(h=>h.total===120);return a.length?Math.max(...a.map(x=>Math.round(x.correct/120*100))):null}
function badge(label,style=""){return '<span class="chip '+style+'">'+esc(label)+'</span>'}
function iconFor(m){return MODULE_ICON[m]||"✧"}
function head(over,title,sub,actions=""){return '<div class="page-head"><div><div class="overline">'+esc(over)+'</div><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div><div class="page-actions">'+actions+'</div></div>'}
function feedbackBox(text,style=""){return '<div class="feedback '+style+'">'+text+'</div>'}
function formatNumber(n){return new Intl.NumberFormat("en-ZA").format(n)}
function clip(s,n=150){return esc(short(s,n))}
function setCrumb(page){const labels={home:"Dashboard",notes:"Core notes",note:"Core condition",cases:"Practice Questions",case:"Practice question",mocks:"Practice Questions",mock:"Mock paper",result:"Results",practice:"Practice Questions",flow:"Continuous Practice",flashcards:"Flashcards",study:"Card review",leaderboard:"Progress",lectures:"Lecture library"};$("crumb").textContent=labels[page]||"Dashboard";document.querySelectorAll("[data-nav]").forEach(a=>a.classList.toggle("active",a.dataset.nav===(["note"].includes(page)?"notes":["case"].includes(page)?"practice":["mock","result"].includes(page)?"practice":page==="flow"?"flow":page==="study"?"flashcards":page)))}
function setIdentity(){let label=authUser?(authUser.user_metadata?.nickname||authUser.email?.split("@")[0]||"Student"):state.guestName;label=short(label,21);$("side-name").textContent=label;$("top-identity").textContent=authUser?"My account":"Guest mode";$("top-avatar").textContent=label.slice(0,1).toUpperCase();$("side-status").textContent=authUser?"Synced account (when online)":"Progress saved on this device";document.querySelector(".avatar").textContent=label.slice(0,1).toUpperCase()}
function learnToggle(name){const idx=state.learned.indexOf(name);if(idx>=0)state.learned.splice(idx,1);else state.learned.push(name);save();render()}
function saveToggle(name){const idx=state.saved.indexOf(name);if(idx>=0)state.saved.splice(idx,1);else state.saved.push(name);save();render()}
function questionStats(){const p=Object.values(state.caseAnswers).filter(x=>typeof x.correct==="boolean");const c=p.filter(x=>x.correct).length;return {count:p.length,correct:c,percent:p.length?Math.round(c/p.length*100):0}}
function renderHome(){
 const quiz=questionStats(),pct=progressPct(),best=bestScore();
 const subjectTiles=PAPER_GROUPS.map(p=>'<div class="home-paper-block"><div class="home-paper-heading"><span>'+esc(p.paper)+'</span><small>'+p.subjects.map(s=>esc(s.name)).join(' • ')+'</small></div><div class="subject-grid">'+p.subjects.map(s=>{
   const n=s.conditions.length, done=s.conditions.filter(name=>state.learned.includes(name)).length;
   return '<button class="subject-tile" data-action="module" data-paper="'+esc(p.paper)+'" data-subject="'+esc(s.name)+'"><span class="subject-icon">'+iconFor(s.name)+'</span><span><b>'+esc(s.name)+'</b><small>'+done+' / '+n+' conditions revised</small></span><span class="subject-arrow">↗</span></button>';
 }).join("")+'</div></div>').join("");
  $("view").innerHTML='<section class="hero"><div class="hero-copy"><div class="hero-kicker">THE GEMP1 END-OF-YEAR INTEGRATED ASSESSMENT</div><h1>Build the clinical thinking that gets you <em>exam-ready.</em></h1><p>Every red-listed GEMP1 condition. Condensed high-yield notes, 1,254 clinical flashcards, case clusters and instant-feedback clinical questions — organised around what Wits says it tests.</p><div class="hero-actions"><a class="btn btn-primary" href="#flow">Start continuous practice ↗</a><a class="btn btn-soft" href="#practice">Individual cases →</a><a class="btn btn-soft" href="flashcards.html#flashcards">Review flashcards →</a><a class="btn btn-soft" href="#notes">Core conditions ↗</a></div></div><div class="hero-art"><div class="orbit"><div class="hero-ring"><span>'+pct+'%<small>REVISED</small></span></div></div><span class="spark a">✦</span><span class="spark b">✧</span></div></section>'+
 '<section class="stat-grid">'+
 metric("◈",EYE_NOTES.length,"GEMP1 core conditions","Official red-listed scope")+
 metric("☷",CASES.length,"Clinical case clusters",totalQuestions+" practice questions")+
 metric("◇",Object.values(state.caseAnswers).filter(x=>!x.correct).length,"Questions to revisit","Learn from the explanation")+
 metric("✦",quiz.count?quiz.percent+"%":"—","Practice accuracy","Review what you missed")+
 '</section><div class="dashboard-cols"><div><section class="panel"><div class="panel-head"><div><h2>Master the core, one system at a time</h2><p>Paper 1: BCMH, CVS, Respiratory. Paper 2: Renal, GIT, MSK, Haem/Onc.</p></div><a href="#notes" class="btn btn-sm">View all ↗</a></div>'+subjectTiles+'<div class="notice">Source transparency: the 66-condition scope follows the red text in your Wits document. Summaries are original educational syntheses; case questions include student-bank contributions and separately identified original practice.</div></section></div><div><section class="panel"><div class="panel-head"><div><h2>Your revision pulse</h2><p>Your progress is private to this device in guest mode.</p></div></div><div class="progress-meta"><span>Conditions revised</span><b>'+state.learned.length+' / '+EYE_NOTES.length+'</b></div><div class="progress-track"><span style="width:'+pct+'%"></span></div><div class="rule"></div>'+
 task("▤","Finish your next condition","Short mechanism + discriminators + red flags","#notes")+
 task("◈","Flip active-recall flashcards","1,254 cards · due and missed reviews","flashcards.html#flashcards")+
 task("◈","Work through a full paper flow","One continuous sequence · instant explanations","#flow")+
 task("▣","Review your mistakes","Learn from the feedback after every answer","#practice")+
 '<div class="notice good"><strong>Practice so far:</strong> '+quiz.count+' questions answered · '+(quiz.count?quiz.percent+"% accuracy":"no answers yet")+'.</div></section></div></div>';
}
function metric(icon,value,label,note){return '<div class="metric-card"><span class="metric-icon">'+icon+'</span><div class="metric-number">'+esc(value)+'</div><div class="metric-label">'+esc(label)+'</div><div class="metric-note">'+esc(note)+'</div></div>'}
function task(icon,title,sub,link){return '<a class="task-row" href="'+link+'"><span class="task-mark">'+icon+'</span><span class="task-body"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></span><span class="task-go">→</span></a>'}
function filterBar(section,options,active){return '<div class="filters">'+options.map(x=>'<button class="filter-pill '+(x===active?"active":"")+'" data-action="filter" data-section="'+section+'" data-value="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div>'}
function notesFiltered(){
 return EYE_NOTES.filter(n=>{
  const tags=tagsFor(n.name),shown=tags.some(t=>(notePaper==="All"||t.paper===notePaper)&&(noteSubject==="All"||t.subject===noteSubject));
  const status=filterNotes==="All"||(filterNotes==="Saved"&&state.saved.includes(n.name))||(filterNotes==="To revise"&&!state.learned.includes(n.name));
  return shown&&status&&norm(n.name+" "+n.presentation+" "+n.clues+" "+tags.map(t=>t.subject).join(" ")).includes(norm(searchText));
 }).sort((a,b)=>a.name.localeCompare(b.name));
}
function noteCard(n,subject){
 const saved=state.saved.includes(n.name),learned=state.learned.includes(n.name);
 return '<article class="condition-card"><div class="card-top">'+badge(subject||tagsFor(n.name)[0]?.subject||"Core","blue")+'<button class="icon-star '+(saved?"saved":"")+'" data-action="save" data-name="'+esc(n.name)+'" aria-label="Bookmark condition">'+(saved?"★":"☆")+'</button></div><h3>'+esc(n.name)+'</h3><p>'+clip(n.presentation,148)+'</p><div class="card-footer"><span>'+(learned?'<span class="is-learned">✓ Revised</span>':'<span>Core note</span>')+'</span><a class="card-cta" href="'+noteHash(n.name)+'">Open notes ↗</a></div></article>';
}
function renderNotes(){
 $("view").innerHTML=head("GEMP1 CORE CONDITIONS","66 core conditions · 2 study papers","Grouped by Paper 1 (BCMH, CVS, Respiratory) and Paper 2 (Renal, GIT, MSK, Haem/Onc), following your study split. Cross-listed conditions appear under every relevant subject.",'<button class="btn" data-action="export">Export progress ↗</button>')+
 '<div class="study-exam-notice">Study organisation only — the official Wits information guide does not confirm a fixed subject allocation per exam paper.</div>'+
 '<div class="study-filter-toolbar"><label class="search-field"><span>⌕</span><input id="notes-search" type="search" placeholder="Search core conditions…" value="'+esc(searchText)+'" aria-label="Search conditions"></label>'+
 '<label>Study paper<select id="notes-paper" class="select">'+selectOptions(notePaper,noteSubject)+'</select></label>'+
 '<label>Subject<select id="notes-subject" class="select">'+selectOptions(notePaper,noteSubject,true)+'</select></label></div>'+
 filterBar("notes",["All","To revise","Saved"],filterNotes)+
 '<div class="results-count" id="notes-count"></div><div id="notes-cards"></div>';
 refreshNotesList();
}
function refreshNotesList(){
 const found=notesFiltered(),listed=new Set(found.map(n=>n.name)),target=$("notes-cards");if(!target)return;
 let placements=0;
 target.innerHTML=PAPER_GROUPS.filter(p=>notePaper==="All"||p.paper===notePaper).map(p=>{
  const sections=p.subjects.filter(s=>noteSubject==="All"||s.name===noteSubject).map(s=>{
   const items=s.conditions.map(name=>found.find(n=>n.name===name)).filter(Boolean);
   if(!items.length)return "";
   placements+=items.length;
   return '<section class="study-subject-section"><div class="study-subject-heading"><h3>'+esc(s.name)+'</h3><span>'+items.length+' conditions</span></div><div class="card-grid">'+items.map(n=>noteCard(n,s.name)).join("")+'</div></section>';
  }).join("");
  return sections?'<section class="study-paper-block"><div class="study-paper-heading"><span>'+esc(p.paper)+'</span><p>'+p.subjects.map(s=>esc(s.name)).join(' · ')+'</p></div>'+sections+'</section>':"";
 }).join("")||'<div class="empty"><h3>No matching core conditions</h3><p>Try another paper, subject or search term.</p></div>';
 $("notes-count").textContent=found.length+" unique conditions · "+placements+" subject listings · "+EYE_NOTES.length+" core conditions total";
}
function relatedCases(name){return CASES.filter(c=>c.coreNames.some(n=>norm(n)===norm(name)))}
function slidesFor(n){const wordMap={
 "Anaphylaxis":["anaphylaxis","antihistamines"],"Anaphylactic Shock":["anaphylaxis","shock"],"Tuberculosis":["tb","tuberculosis"],"HIV/AIDS":["hiv","arvs"],"Osteoporosis":["osteoporosis","bone physiology"],"Gout":["gout"],"Iron Deficiency Anaemia":["iron deficiency","anaemia"],"Ischaemic Heart Disease":["myocardial infarction","atherosclerosis","acute cardiac"],"Renal Calculi":["calculi","urology"],"Liver Cirrhosis":["chronic liver","portal hypertension"],"Cholecystitis":["cholecystitis","gallstones"],"Peptic Ulcer Disease":["peptic ulcer"],"Rheumatoid Arthritis":["rheumatoid arthritis"],"Nephritic syndrome":["glomerulonephritis","haematuria"],"Nephrotic syndrome":["nephrotic","proteinuria"],"Disseminated Intravascular Coagulation":["coagulation","haemostasis"],"Von Willebrand Disease":["coagulation","haemostasis"],"Septic Arthritis":["osteoarticular infections"],"Breast Cancer":["cancer"],"Cervical Cancer":["cancer"],"Severe Acute Malnutrition":["nutrition"]
 };
 const tokens=(wordMap[n.name]||[n.name.toLowerCase()]).map(x=>norm(x));
 const mod=norm(n.category);
 const scored=SLIDES.map(s=>{let score=0;const sn=norm(s.name),sm=norm(s.module);for(const x of tokens)if(sn.includes(x))score+=12;if(mod==="haem cancer"&&(sm.includes("haem")||sm.includes("cancer")))score+=2;else if(mod==="emergency"&&(sn.includes("shock")||sn.includes("emergency")))score+=3;else if(mod===sm)score+=2;return{s,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 return scored.slice(0,4).map(x=>x.s);
}
function renderDetail(name){
 const n=EYE_NOTES.find(x=>norm(x.name)===norm(name));if(!n){goto("#notes");return}
 const saved=state.saved.includes(n.name),learned=state.learned.includes(n.name),rels=relatedCases(n.name),slides=slidesFor(n);
 
 const sections=[
  section("◈","Clinical presentation",n.presentation,""),
  section("✳","Mechanism · explain why",n.mechanism,"highlight"),
  section("⌁","Discriminating findings",n.clues,""),
  section("⌕","Investigations and interpretation",n.tests,""),
  section("!","Danger signs & safest next step",n.safety,"warning"),
  section("⇄","Differentiate from common mimics",n.differentiate,""),
  section("★","Exam memory hook",n.memory,"ok")
 ].join("");
 const links=rels.sort((a,b)=>(b.difficulty==="Challenge")-(a.difficulty==="Challenge")||(a.id||0)-(b.id||0)).map((c,i)=>'<div class="linked-case"><span>◈</span><strong>Case '+(i+1)+': '+esc(c.title)+(c.difficulty==="Challenge"?" · HARD":"")+'</strong><a href="'+caseHash(c.id)+'">Practise ↗</a></div>').join("")||'<p class="tiny-note">A full case cluster is being prepared for this condition. Start with its VSAQ and use the clinical case bank for integrated practice.</p>';
 const lectures=slides.map(s=>'<div class="linked-case"><span>▥</span><strong>'+esc(s.name)+'</strong><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">Slides ↗</a></div>').join("")||'<p class="tiny-note">Browse the lecture library to find supporting course material.</p>';
 $("view").innerHTML='<div class="detail-layout"><div class="detail-main"><button class="back-link" data-action="back-notes">← Back to core conditions</button><div class="detail-hero"><div class="detail-top">'+badge("GEMP1 red-listed","red")+labelsFor(n.name)+(learned?badge("Revised ✓","green"):"")+'</div><h1>'+esc(n.name)+'</h1><p>'+esc(n.presentation)+'</p><div class="page-actions"><button class="btn '+(learned?"btn-success":"btn-primary")+'" data-action="learn" data-name="'+esc(n.name)+'">'+(learned?"✓ Marked as revised":"+ Mark as revised")+'</button><button class="btn" data-action="save" data-name="'+esc(n.name)+'">'+(saved?"★ Saved":"☆ Save note")+'</button><button class="btn btn-soft" data-action="flash-start" data-scope="condition:'+esc(n.name)+'" data-mode="All" data-limit="0">◈ Deep flashcards</button></div></div>'+sections+'<div class="notice">Study rule: be able to recognise the presentation, explain the underlying mechanism, interpret basic investigations and state the safest supervised action. These summaries are revision aids, not a replacement for your original Wits teaching material.</div></div><aside class="detail-aside"><section class="aside-box"><div class="overline">ACTIVE RECALL · FLASHCARDS</div><h3>'+Flash.statsFor(n.name).total+' cards for this condition</h3><p>Clinical recognition, mechanisms, tests, clinical data, red flags, mimics and multiple VSAQs.</p><div class="progress-meta"><span>Mastered</span><b>'+Flash.statsFor(n.name).mastered+' / '+Flash.statsFor(n.name).total+'</b></div><div class="progress-track"><span style="width:'+(Flash.statsFor(n.name).mastered/Math.max(1,Flash.statsFor(n.name).total)*100)+'%"></span></div><button class="btn btn-primary btn-wide" style="margin-top:14px" data-action="flash-start" data-scope="condition:'+esc(n.name)+'" data-mode="All" data-limit="0">Study all flashcards →</button><p class="tiny-note" style="margin-top:10px">Flip the card and rate your recall to schedule future reviews. No fixed card cap.</p></section><section class="aside-box"><h3>Linked case practice</h3>'+links+'</section><section class="aside-box"><h3>Related Wits lectures</h3>'+lectures+'</section></aside></div>';
}
function section(icon,title,body,kind){return '<section class="detail-section '+kind+'"><h2><span>'+icon+'</span>'+esc(title)+'</h2><p>'+esc(body)+'</p></section>'}

function practiceCaseStats(c){const saved=c.questions.map(q=>state.caseAnswers[qrKey(c,q)]);const attempted=saved.filter(Boolean);return{total:c.questions.length,attempted:attempted.length,correct:attempted.filter(x=>x.correct).length,wrong:attempted.filter(x=>x.correct===false).length}}
function practiceCaseCard(c){
 const st=practiceCaseStats(c),tags=caseTags(c);
 return '<article class="practice-case-card"><div class="practice-case-meta">'+
  badge(c.difficulty==="Challenge"?"Challenge · hard":c.isIntegrated?"Integrated reasoning":"Core condition",c.difficulty==="Challenge"?"amber":"blue")+
  '<span>'+c.questions.length+' questions · '+c.questions.filter(q=>q.type==="VSAQ").length+' VSAQ</span></div>'+
  '<h4>'+esc(c.title)+'</h4><p>'+clip(c.scenario,155)+'</p>'+
  '<div class="practice-case-footer"><span>'+st.attempted+' / '+st.total+' attempted'+(st.wrong?' · <b class="practice-miss">'+st.wrong+' to review</b>':"")+'</span>'+
  '<a class="btn btn-primary btn-sm" href="'+caseHash(c.id)+'">'+(st.attempted?"Continue / review →":"Start practice →")+'</a></div></article>';
}
function needsPracticeReview(c){
 return c.questions.some(q=>{
  const key=qrKey(c,q),current=state.caseAnswers[key];
  if(current&&typeof current.correct==="boolean")return !current.correct;
  const recent=(state.practiceHistory||[]).filter(h=>String(h.caseId)===String(c.id)&&String(h.question)===String(q.number));
  return recent.length?recent[recent.length-1].correct===false:false;
 });
}
function practiceFilter(c){
 const tags=caseTags(c);
 const scope=filterCases==="All"||(filterCases==="Challenge"?c.difficulty==="Challenge":filterCases==="Core"?!c.isIntegrated&&c.coreNames.length>0:filterCases==="Integrated"?!!c.isIntegrated:filterCases==="Mistakes"?needsPracticeReview(c):filterCases==="Extension"?c.coreNames.length===0:false);
 const paper=casePaper==="All"||tags.some(t=>t.paper===casePaper);
 const subject=caseSubject==="All"||tags.some(t=>t.subject===caseSubject&&(casePaper==="All"||t.paper===casePaper));
 const query=!searchText||norm(c.title+" "+c.module+" "+c.coreNames.join(" ")+" "+c.scenario).includes(norm(searchText));
 return scope&&paper&&subject&&query;
}
function renderCases(){
 const found=CASES.filter(practiceFilter),integrated=found.filter(c=>c.isIntegrated),ordinary=found.filter(c=>!c.isIntegrated);
 const unique=new Set(ordinary.map(c=>String(c.id)));
 let groups="";
 for(const paper of PAPER_GROUPS){
  if(casePaper!=="All"&&casePaper!==paper.paper)continue;
  const subjectBlocks=[];
  for(const subject of paper.subjects){
   if(caseSubject!=="All"&&caseSubject!==subject.name)continue;
   const conditionBlocks=[];
   for(const name of subject.conditions){
    const linked=ordinary.filter(c=>c.coreNames.some(x=>norm(x)===norm(name))).sort((a,b)=>(b.difficulty==="Challenge")-(a.difficulty==="Challenge")||(a.id||0)-(b.id||0));
    if(!linked.length)continue;
    conditionBlocks.push('<details class="practice-condition"'+(caseSubject!=="All"?' open':'')+'><summary><span>'+esc(name)+'</span><span>'+linked.length+' cases <span class="practice-caret">⌄</span></span></summary><div class="practice-case-list">'+linked.map(practiceCaseCard).join("")+'</div></details>');
   }
   if(conditionBlocks.length)subjectBlocks.push('<section class="practice-subject-section"><h3>'+esc(subject.name)+' <small>'+conditionBlocks.length+' core conditions</small></h3>'+conditionBlocks.join("")+'</section>');
  }
  if(subjectBlocks.length)groups+='<section class="practice-paper-section"><header><h2>'+esc(paper.paper)+'</h2><span>'+paper.subjects.map(s=>esc(s.name)).join(" · ")+'</span></header>'+subjectBlocks.join("")+'</section>';
 }
 $("view").innerHTML=head("PRACTICE QUESTIONS","Learn from every answer","Choose a subject or a core condition. Answer an SBA to reveal the correct option and its explanation straight away. VSAQs show the expected short answer for self-review.","")+
 '<div class="practice-intro">Built around the GEMP1 integrated-assessment examples: one clinical presentation followed by mechanisms, discriminating findings, investigations, data and safe actions. These are original/student-derived questions, not an official Wits examination. Challenge cases use close differential diagnoses and lab interpretation. Study-paper headings are for revision, not guaranteed exam allocation.</div>'+
 '<div class="practice-summary-grid"><div><strong>'+CASES.length+'</strong><span>Total clinical clusters</span></div><div><strong>'+totalQuestions+'</strong><span>Practice questions</span></div><div><strong>'+questionStats().percent+'%</strong><span>Your answer accuracy</span></div><div><strong>'+Object.values(state.caseAnswers).filter(x=>!x.correct).length+'</strong><span>Answers to review</span></div></div>'+
 '<div class="study-filter-toolbar"><label class="search-field"><span>⌕</span><input id="cases-search" type="search" aria-label="Search question practice" placeholder="Search disease, clinical presentation or mechanism…" value="'+esc(searchText)+'"></label>'+
 '<label>Study paper<select id="cases-paper" class="select">'+selectOptions(casePaper,caseSubject)+'</select></label>'+
 '<label>Subject<select id="cases-subject" class="select">'+selectOptions(casePaper,caseSubject,true)+'</select></label></div>'+
 filterBar("cases",["All","Challenge","Integrated","Core","Mistakes"],filterCases)+
 '<p class="tiny-note">'+found.length+' distinct clinical clusters shown · '+found.reduce((n,c)=>n+c.questions.length,0)+' questions · Expand a condition to practise its cases.</p>'+
 (integrated.length?'<section class="practice-featured"><div class="practice-featured-head"><div><div class="overline">MULTISYSTEM REASONING</div><h2>Integrated clinical cases</h2><p>Like the Wits examples: a single presentation with linked questions across clinical and basic science tracks.</p></div><span>'+integrated.length+' cases</span></div><div class="practice-case-list">'+integrated.map(practiceCaseCard).join("")+'</div></section>':"")+
 (groups||(!integrated.length?'<div class="empty"><h3>No matching practice cases</h3><p>Change the filters or search terms.</p></div>':""));
}
function practiceFeedback(c,q,saved){
 if(!saved)return '<p class="practice-help">Choose one answer to see the explanation immediately. Questions are for learning, not a timed test.</p>';
 const correctText=q.type==="SBA"?q.answer+'. '+q.options["ABCD".indexOf(q.answer)]:q.answer;
 const pending=q.type==="VSAQ"&&saved.selfReviewed===false;
 const mark=pending?'<span class="practice-status">Compare and self-mark</span>':saved.correct?'<span class="practice-status correct">✓ Correct</span>':'<span class="practice-status incorrect">✕ Not quite — review</span>';
 const choice=q.type==="SBA"?'<p><b>Your choice:</b> '+esc(saved.answer)+'. '+esc(q.options["ABCD".indexOf(saved.answer)]||"")+'</p>':'<p><b>Your answer:</b> '+esc(saved.answer)+'</p>';
 const selectedIndex="ABCD".indexOf(saved.answer),wrongReason=q.type==="SBA"&&!saved.correct&&Array.isArray(q.whyOptions)&&q.whyOptions[selectedIndex]?'<p><b>Why your choice was less suitable:</b> '+esc(q.whyOptions[selectedIndex])+'</p>':"";
 const allOptions=q.type==="SBA"&&Array.isArray(q.whyOptions)&&q.whyOptions.length===4?'<details class="practice-why"><summary>Why each option is right or wrong</summary><div>'+q.whyOptions.map((r,i)=>'<p><b>'+String.fromCharCode(65+i)+'.</b> '+esc(r)+'</p>').join("")+'</div></details>':"";
 const self=q.type==="VSAQ"?'<div class="practice-self-check"><span>'+(saved.selfReviewed?'Self-marked '+(saved.correct?'correct':'for revision')+'. Change if necessary:':'Did your answer match the expected meaning?')+'</span><button class="btn btn-sm" data-action="mark-practice-vsaq" data-correct="1" data-case="'+c.id+'" data-number="'+q.number+'">✓ I got it</button><button class="btn btn-sm" data-action="mark-practice-vsaq" data-correct="0" data-case="'+c.id+'" data-number="'+q.number+'">Needs revision</button></div>':"";
 return '<section class="practice-answer-feedback '+(pending?"pending":saved.correct?"correct":"incorrect")+'" id="answer-feedback" tabindex="-1">'+mark+choice+'<div class="practice-correct-answer"><small>EXPECTED ANSWER</small><strong>'+esc(correctText)+'</strong></div><p><b>Reasoning:</b> '+esc(q.explain||q.point||"Review this concept in the relevant core note.")+'</p>'+wrongReason+allOptions+self+'</section>';
}

/* A continuous learning sequence, not a timed or official Wits exam paper.
   Case IDs are de-duplicated within each paper even if a condition crosses subjects.
   The user's study split determines grouping, not official exam allocation. */
function buildFlowQueues(){
 const out=new Map();
 for(const p of PAPER_GROUPS){
  const used=new Set(),ordered=[];
  function add(c,subject){
   if(used.has(String(c.id)))return;
   used.add(String(c.id));ordered.push({c,subject});
  }
  for(const s of p.subjects){
   for(const name of s.conditions){
    const linked=CASES.filter(c=>!c.isIntegrated&&c.coreNames.some(x=>norm(x)===norm(name)))
      .sort((a,b)=>(a.difficulty==="Challenge")-(b.difficulty==="Challenge")||(a.id||0)-(b.id||0));
    linked.forEach(c=>add(c,s.name));
   }
   /* Two older extension cases have a known Renal/GIT module. */
   CASES.filter(c=>!c.isIntegrated&&!c.coreNames.length&&norm(c.module)===norm(s.name))
     .sort((a,b)=>(a.id||0)-(b.id||0)).forEach(c=>add(c,s.name));
  }
  /* Integrated cases appear after the core-system practice for each relevant paper. */
  CASES.filter(c=>c.isIntegrated&&caseTags(c).some(t=>t.paper===p.paper))
    .sort((a,b)=>(a.id||0)-(b.id||0)).forEach(c=>add(c,"Integrated"));
  const items=[];
  ordered.forEach((item,ci)=>item.c.questions.forEach((q,qi)=>items.push({
   c:item.c,q,subject:item.subject,caseIndex:ci,questionIndex:qi
  })));
  out.set(p.paper,{paper:p.paper,cases:ordered,items,subjects:p.subjects.map(s=>s.name)});
 }
 return out;
}
const FLOW_QUEUES=buildFlowQueues();
function flowGetSession(paper){
 if(!FLOW_QUEUES.has(paper))return null;
 let sess=state.flowSessions[paper];
 if(!sess||typeof sess!=="object"||!sess.answers||typeof sess.answers!=="object"){
  sess={index:0,answers:{},started:Date.now(),updated:Date.now(),finished:false};
  state.flowSessions[paper]=sess;save();
 }
 if(!Number.isInteger(sess.index)||sess.index<0)sess.index=0;
 const max=FLOW_QUEUES.get(paper).items.length;
 sess.index=Math.min(sess.index,max);
 return sess;
}
function flowCounts(paper){
 const pack=FLOW_QUEUES.get(paper),sess=state.flowSessions?.[paper];
 const records=Object.values(sess?.answers||{}),graded=records.filter(a=>typeof a.correct==="boolean");
 return {paper,cases:pack.cases.length,total:pack.items.length,answered:records.length,
  graded:graded.length,correct:graded.filter(a=>a.correct).length,wrong:graded.filter(a=>!a.correct).length,
  percent:graded.length?Math.round(100*graded.filter(a=>a.correct).length/graded.length):0,
  started:!!sess,finished:!!sess?.finished};
}
function flowPaperCard(p){
 const pack=FLOW_QUEUES.get(p.paper),progress=flowCounts(p.paper);
 const pct=Math.round(100*progress.answered/Math.max(1,progress.total));
 const subjectList=p.subjects.map(s=>s.name).join(" · ");
 return '<article class="flow-paper-card"><div class="flow-card-top"><span class="flow-paper-label">'+esc(p.paper)+'</span>'+
 badge(progress.finished?"Completed":progress.answered?"In progress":"Ready",progress.finished?"green":"blue")+'</div>'+
 '<h2>'+esc(subjectList)+'</h2><p>All mapped clinical case clusters, including challenging SBAs, result interpretation and VSAQs. One question at a time, with immediate feedback.</p>'+
 '<div class="flow-paper-metrics"><div><strong>'+pack.cases.length+'</strong><span>Distinct cases</span></div><div><strong>'+pack.items.length+'</strong><span>Questions</span></div><div><strong>'+progress.graded+'</strong><span>Graded</span></div></div>'+
 '<div class="flow-progress-track"><span style="width:'+pct+'%"></span></div>'+
 '<div class="flow-progress-meta"><span>'+progress.answered+' of '+progress.total+' answered</span><b>'+pct+'%</b></div>'+
 '<div class="flow-paper-actions"><button class="btn btn-primary" data-action="flow-start" data-paper="'+esc(p.paper)+'">'+(progress.finished?"Review completed flow →":progress.started?"Resume practice →":"Start paper flow →")+'</button>'+
 (progress.started?'<button class="btn btn-sm" data-action="flow-restart" data-paper="'+esc(p.paper)+'">Start again</button>':"")+'</div></article>';
}
function renderFlowLanding(){
 $("view").innerHTML=head("CONTINUOUS PRACTICE","Keep going. One case after another.","Work through linked clinical case questions without returning to the case library. Choose Paper 1 or Paper 2; every answer reveals its explanation immediately.","")+
 '<div class="flow-intro"><strong>How it works:</strong> Choose a paper, answer, read the explanation, then press <b>Next</b>. At the last question of a case, Next opens the following case automatically. You can leave and resume without losing your place. No timer and no compulsory submission.</div>'+
 '<div class="flow-paper-grid">'+PAPER_GROUPS.map(flowPaperCard).join("")+'</div>'+
 '<p class="flow-qualifier">The Paper 1 / Paper 2 subject split is a student revision organisation, not an official Wits promise about what will appear on either paper. Seven older extension cases without a suitable subject mapping remain in individual-case practice.</p>'+
 '<a class="btn btn-soft" href="#practice">Browse individual cases instead ↗</a>';
}
function flowFeedback(c,q,record,paper){
 const original=practiceFeedback(c,q,record);
 return original.replace(/data-action="mark-practice-vsaq"/g,
  'data-action="flow-mark-vsaq" data-flow-paper="'+esc(paper)+'"');
}
function flowItemKey(item){return qrKey(item.c,item.q)}
function flowCanContinue(item,sess){
 const answer=sess.answers[flowItemKey(item)];
 return !!answer&&(item.q.type!=="VSAQ"||answer.selfReviewed===true);
}
function renderFlow(paper){
 const pack=FLOW_QUEUES.get(paper);if(!pack){goto("#flow");return}
 const sess=flowGetSession(paper),pos=Math.min(sess.index,pack.items.length),scores=flowCounts(paper);
 const pct=Math.round(100*scores.answered/Math.max(1,scores.total));
 if(pos===pack.items.length){renderFlowFinish(paper,pack,sess);return}
 const item=pack.items[pos],c=item.c,q=item.q,record=sess.answers[flowItemKey(item)];
 const prev=pos>0,nextLabel=pos===pack.items.length-1?"Finish paper →":
  item.questionIndex===c.questions.length-1?"Next case →":"Next question →";
 let options="";
 if(q.type==="SBA"){
  options='<div class="options practice-options flow-options">'+q.options.map((op,i)=>{
   const letter="ABCD"[i],className=record?(letter===q.answer?"correct":letter===record.answer?"incorrect":""):"";
   return '<button class="option '+className+'" data-action="flow-answer" data-paper="'+esc(paper)+'" data-letter="'+letter+'" '+(record?"disabled":"")+'><span class="opt-letter">'+letter+'</span>'+esc(op)+
     (record&&letter===q.answer?' <span class="practice-option-status">✓ Correct</span>':
      record&&letter===record.answer?' <span class="practice-option-status">✕ Your answer</span>':"")+'</button>';
  }).join("")+'</div>';
 }else{
  options='<div class="flow-vsaq"><p class="tiny-note">Write a very short answer (1–3 words), or reveal the answer if unsure.</p>'+
   '<input id="flow-free" class="input" autocomplete="off" placeholder="Type your short answer…" aria-label="Short answer" value="'+esc(record?.answer==="—"?"":record?.answer||"")+'" '+(record?"disabled":"")+'>'+
   (record?"":'<div class="flow-vsaq-buttons"><button class="btn btn-primary" data-action="flow-submit-vsaq" data-paper="'+esc(paper)+'">Check my answer</button>'+
    '<button class="btn" data-action="flow-reveal-vsaq" data-paper="'+esc(paper)+'">I don’t know — reveal</button></div>')+
   '</div>';
 }
 const canGo=flowCanContinue(item,sess);
 const sameCaseStart=item.questionIndex===0;
 $("view").innerHTML='<div class="flow-shell">'+
 '<div class="flow-topline"><a href="#flow" class="back-link">← Paper selection</a><span class="flow-session-tag">'+esc(paper)+' · '+esc(item.subject)+'</span><span class="flow-saved">Progress saved</span></div>'+
 '<div class="flow-main-progress"><div><b>Question '+(pos+1)+' of '+pack.items.length+'</b><span>Case '+(item.caseIndex+1)+' of '+pack.cases.length+' · '+scores.answered+' answered · '+scores.correct+' correct</span></div>'+
 '<div class="flow-progress-track"><span style="width:'+pct+'%"></span></div></div>'+
 '<article class="flow-study-card"><div class="flow-scenario-header"><span class="overline">'+esc(paper)+' / '+esc(item.subject)+' · CASE '+(item.caseIndex+1)+'</span>'+
 (c.difficulty==="Challenge"?badge("Challenge","amber"):c.isIntegrated?badge("Integrated case","blue"):badge("Clinical cluster","blue"))+'</div>'+
 '<h2>'+esc(c.title)+'</h2>'+
 '<details class="flow-scenario" open><summary>Patient scenario <span>Toggle details</span></summary><p>'+esc(c.scenario)+'</p></details>'+
 '<div class="flow-question-header"><span>QUESTION '+(item.questionIndex+1)+' OF '+c.questions.length+'</span>'+
 badge(q.type==="VSAQ"?"Very short answer":q.isData?"Data interpretation":"Single best answer","blue")+'</div>'+
 '<h3>'+esc(q.q)+'</h3>'+options+flowFeedback(c,q,record,paper)+
 (record&&q.type==="VSAQ"&&!record.selfReviewed?'<p class="flow-gate">Compare the model answer and self-mark to continue.</p>':"")+
 '<div class="flow-navigation"><button class="btn" data-action="flow-prev" data-paper="'+esc(paper)+'" '+(!prev?"disabled":"")+'>← Previous</button>'+
 '<button class="btn btn-primary flow-next" data-action="flow-next" data-paper="'+esc(paper)+'" '+(!canGo?"disabled":"")+'>'+
 (canGo?esc(nextLabel):q.type==="SBA"?"Select an answer to continue":"Check and mark to continue")+'</button></div>'+
 (record?'<div class="flow-followup"><a href="'+noteHash(c.coreNames[0]||"")+'">Review the relevant core note ↗</a>'+
 '<button class="btn btn-sm" data-action="flow-retry-question" data-paper="'+esc(paper)+'">Try this question again</button>'+
 '<button class="btn btn-soft btn-sm" data-action="ask-ai" data-case="'+c.id+'" data-index="'+item.questionIndex+'">✦ Ask AI tutor</button></div>':"")+
 '</article><div class="flow-bottom-links"><span>One tap advances to the next question or case—no returning to the case bank.</span>'+
 '<a href="#flow">Switch paper</a></div></div>';
}
function renderFlowFinish(paper,pack,sess){
 const progress=flowCounts(paper),wrong=pack.items.map((item,i)=>({item,i,a:sess.answers[flowItemKey(item)]})).filter(x=>x.a?.correct===false);
 const byCore=new Map();for(const w of wrong){const name=w.item.c.coreNames[0]||w.item.subject;
  byCore.set(name,(byCore.get(name)||0)+1)}
 const review=wrong.slice(0,25).map(({item,i})=>'<button class="flow-review-line" data-action="flow-jump" data-paper="'+esc(paper)+'" data-index="'+i+'"><span>✕</span>'+
  '<span><strong>'+esc(item.c.title)+'</strong><small>Question '+(item.questionIndex+1)+' · '+esc(item.subject)+'</small></span><span>Review →</span></button>').join("");
 $("view").innerHTML=head("CONTINUOUS PRACTICE","You've completed "+paper,"All questions in this revision flow have been displayed. Review your weak areas, or restart when you want a fresh attempt.","")+
 '<div class="flow-finish-stats"><div><strong>'+progress.total+'</strong><span>Questions in this paper flow</span></div>'+
 '<div><strong>'+progress.correct+' / '+progress.graded+'</strong><span>Correct / graded</span></div>'+
 '<div><strong>'+progress.percent+'%</strong><span>Practice accuracy</span></div>'+
 '<div><strong>'+wrong.length+'</strong><span>To review</span></div></div>'+
 '<div class="flow-finish-actions"><button class="btn btn-primary" data-action="flow-restart" data-paper="'+esc(paper)+'">Start a new attempt →</button>'+
 '<a class="btn" href="#flow">Choose the other paper</a></div>'+
 (review?'<section class="flow-mistakes"><h2>Go back over your mistakes</h2><p>Review the explanation, then retry the question.</p>'+review+'</section>':
 '<div class="flow-intro">No incorrect graded answers are currently recorded for this attempt.</div>');
}
function flowCurrent(paper){
 const pack=FLOW_QUEUES.get(paper),sess=flowGetSession(paper);
 return pack&&sess&&sess.index<pack.items.length?{pack,sess,item:pack.items[sess.index]}:null;
}
function flowAdvance(paper,delta){
 const current=flowCurrent(paper);
 if(!current)return;
 const {pack,sess,item}=current;
 if(delta>0&&!flowCanContinue(item,sess)){toast("Answer and review the question first");return}
 sess.index=Math.max(0,Math.min(pack.items.length,sess.index+delta));
 sess.finished=sess.index===pack.items.length;
 sess.updated=Date.now();save();render();
 if(typeof window.scrollTo==="function")window.scrollTo({top:0,behavior:"auto"});
}
function flowRecordAnswer(paper,answer,isVsaq=false){
 const current=flowCurrent(paper);if(!current)return;
 const {sess,item}=current,key=flowItemKey(item);
 if(sess.answers[key])return;
 const correct=isVsaq?null:answer===item.q.answer;
 sess.answers[key]={answer,correct,time:Date.now(),selfReviewed:!isVsaq};
 if(!isVsaq)state.practiceHistory.push({caseId:item.c.id,question:item.q.number,answer,correct,paper,source:"continuous",time:Date.now()});
 sess.updated=Date.now();save();render();
 if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>$("answer-feedback")?.scrollIntoView({behavior:"smooth",block:"nearest"}));
}

function renderCase(id,idx){
 const c=CASES.find(x=>String(x.id)===String(id));if(!c){goto("#practice");return}
 idx=Math.max(0,Math.min(c.questions.length-1,Number(idx)||0));const q=c.questions[idx],key=qrKey(c,q),saved=state.caseAnswers[key],flag=state.flags[key];
 const opts=q.type==="SBA"?'<div class="options practice-options">'+q.options.map((o,i)=>{
  const letter="ABCD"[i],cls=saved?(letter===q.answer?"correct":letter===saved.answer?"incorrect":""):"";
  return '<button class="option '+cls+'" data-action="answer-case" data-case="'+c.id+'" data-index="'+idx+'" data-letter="'+letter+'" '+(saved?"disabled":"")+'><span class="opt-letter">'+letter+'</span>'+esc(o)+(saved&&letter===q.answer?' <span class="practice-option-status">✓ Correct</span>':saved&&letter===saved.answer?' <span class="practice-option-status">✕ Your answer</span>':"")+'</button>';
 }).join("")+'</div>':
 '<div><p class="tiny-note">Answer in 1–3 words. Then compare with the expected short answer.</p><input class="input" style="width:100%" id="case-free" placeholder="Your very short answer…" value="'+esc(saved?.answer||"")+'" '+(saved?"disabled":"")+'><div style="margin-top:10px"><button class="btn btn-primary btn-sm" data-action="answer-vsaq" data-case="'+c.id+'" data-index="'+idx+'" '+(saved?"disabled":"")+'>Show expected answer</button></div></div>';
 const palette=c.questions.map((x,i)=>{const f=state.caseAnswers[qrKey(c,x)],fl=state.flags[qrKey(c,x)];return '<button class="'+(i===idx?"active ":"")+(f?(f.correct?"answered":"wrong"):"")+(fl?" flagged":"")+'" data-action="case-jump" data-case="'+c.id+'" data-index="'+i+'">'+(i+1)+'</button>'}).join("");
 const stats=practiceCaseStats(c);
 $("view").innerHTML='<div class="case-layout"><div><button class="back-link" data-action="back-cases">← Back to Practice Questions</button>'+
 '<div class="scenario"><div class="overline">INTEGRATED PRACTICE · '+esc(caseLabel(c))+'</div><h2>'+esc(c.title)+'</h2><p>'+esc(c.scenario)+'</p></div>'+
 '<div class="question-panel"><div class="q-progress"><span>QUESTION '+(idx+1)+' OF '+c.questions.length+'</span>'+badge(q.type==="VSAQ"?"VSAQ · 1–3 words":q.isData?"Results interpretation":"SBA · 4 options","blue")+'</div><h2>'+esc(q.q)+'</h2>'+
 opts+practiceFeedback(c,q,saved)+
 '<div class="question-foot"><button class="btn btn-sm" data-action="flag" data-key="'+esc(key)+'">'+(flag?"⚑ Flagged":"⚐ Flag to revise")+'</button><div class="page-actions"><button class="btn btn-sm" data-action="case-jump" data-case="'+c.id+'" data-index="'+(idx-1)+'" '+(idx===0?"disabled":"")+'>← Previous</button><button class="btn btn-primary btn-sm" data-action="case-jump" data-case="'+c.id+'" data-index="'+(idx+1)+'" '+(idx===c.questions.length-1?"disabled":"")+'>Next question →</button></div></div>'+
 (saved?'<div class="practice-followup"><a href="'+noteHash(c.coreNames[0]||"")+'">Review related core notes ↗</a><button class="btn btn-sm" data-action="practice-retry" data-case="'+c.id+'" data-index="'+idx+'">Try again</button><button class="btn btn-soft btn-sm" data-action="ask-ai" data-case="'+c.id+'" data-index="'+idx+'">✦ Ask AI tutor</button></div>':'')+
 '</div></div><aside class="q-side"><div class="aside-box"><h3>Learning progress</h3><p class="tiny-note">Green = correct; red = needs review. Tap any question to revisit it.</p><div class="q-palette">'+palette+'</div>'+
 '<div class="progress-track"><span style="width:'+Math.round(100*stats.attempted/stats.total)+'%"></span></div><p class="tiny-note">'+stats.attempted+'/'+stats.total+' attempted · '+stats.correct+' correct · '+stats.wrong+' to review</p>'+
 '<div class="rule"></div><p class="tiny-note"><strong>Source:</strong> '+esc(c.source||"Student teaching bank")+'</p><button class="btn btn-sm" data-action="practice-reset-case" data-case="'+c.id+'">Restart this case</button><p class="tiny-note">Restart clears the current case answers, not your previous attempt history.</p></div></aside></div>';
}
function mockCaseOrder(){
 const byModule={};for(const c of CORE_CASES){const m=c.module;if(!byModule[m])byModule[m]=[];byModule[m].push(c)}
 Object.keys(byModule).forEach(k=>byModule[k].sort((a,b)=>(a.id*117+51)%997-(b.id*117+51)%997));
 let order=[];let groups=Object.keys(byModule).sort();let alive=true;while(alive){alive=false;for(const k of groups){if(byModule[k].length){order.push(byModule[k].shift());alive=true}}}
 const a=[],b=[];for(let i=0;i<order.length;i++){if(a.length===18&&b.length===18)break;if(i%2===0&&a.length<18)a.push(order[i]);else if(b.length<18)b.push(order[i]);else if(a.length<18)a.push(order[i])}
 return {A:a,B:b}
}
const MOCK_CASES=mockCaseOrder();
function mockItems(which){
 const list=MOCK_CASES[which]||[];let out=[];
 list.forEach((c,i)=>{
  const count=i<12?7:6;
  const sbas=c.questions.filter(q=>q.type==="SBA");
  const data=sbas.find(q=>q.isData||/lab report|results:|ecg shows|blood results|spirometry|creatinine|haemoglobin|haematocrit|blood count|imaging shows|x-ray shows|x-ray reveals|urinalysis|blood gas/i.test(q.q));
  let selected=sbas.filter(q=>!data||q.number!==data.number).slice(0,count-2);
  if(data)selected.push(data);
  else if(sbas[count-2])selected.push(sbas[count-2]);
  const v=c.questions.find(q=>q.type==="VSAQ");
  if(v)selected.push(v);
  if(selected.length<count)for(const q of c.questions){if(!selected.includes(q)){selected.splice(selected.length-(v?1:0),0,q);if(selected.length===count)break}}
  selected.slice(0,count).forEach((q,j)=>out.push({id:qrKey(c,q),caseId:c.id,caseTitle:c.title,category:c.module,scenario:c.scenario,q,section:i+1,sectionQ:j+1}));
 });
 return out.slice(0,120);
}
const MOCKS={A:mockItems("A"),B:mockItems("B")};
function fmtTime(ms){const t=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60;return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":")}
function mockResults(which){const hist=state.mockHistory.filter(x=>x.paper===which).sort((a,b)=>b.date-a.date);return hist.length?hist[0]:null}
function renderMocks(){
 const cards=["A","B"].map(p=>{const ses=state.mockSessions[p],done=mockResults(p),ready=MOCKS[p].length===120;
 return '<article class="mock-card '+(ses&&ses.status==="active"?"mock-live":"")+'"><div class="card-top">'+badge("PAPER "+p,"blue")+badge(ready?"120 QUESTIONS":"UNDER CONSTRUCTION",ready?"green":"amber")+'</div><h2>Integrated Paper '+p+'</h2><p>Approximately 18 undifferentiated clinical case clusters with linked 4-option SBAs, data interpretation and 1–3-word VSAQs.</p><div class="mock-stats">'+badge("180 minutes")+badge("120 marks")+badge("Timed & self-marked")+'</div>'+(done?'<p><strong>Latest result: '+done.correct+'/120 ('+Math.round(done.correct/120*100)+'%)</strong></p>':"")+'<button class="btn btn-primary" data-action="mock-start" data-paper="'+p+'" '+(!ready?"disabled":"")+'>'+(ses?.status==="active"?"Continue paper":ses?"Retake paper":"Start paper")+' →</button></article>'}).join("");
 $("view").innerHTML=head("THE EXAM CENTRE","Sit the paper before the paper","Official format: 2 papers of 120 questions, 180 minutes each, typically ~35–40 case clusters across both papers. These two mock papers are original/student-derived practice, not predictions.",'<a class="btn" href="https://ulwazi.wits.ac.za/courses/91264/files/12089280" target="_blank" rel="noopener">Wits assessment guide ↗</a>')+
 '<div class="mock-grid">'+cards+'</div><div class="notice warning">Assessment focus: recognising undifferentiated presentations, mechanisms, results interpretation, patient safety and the safest supervised next step. VSAQs are self-marked after submission. A 90% target is a study goal, not a score guarantee.</div>';
}
function scoreMock(which){const m=MOCKS[which],s=state.mockSessions[which];if(!s)return null;let sbaCorrect=0,sbaTotal=0,vsaqTotal=0,vsaqCorrect=0,unmarked=0,answered=0;
 for(const item of m){let val=s.answers[item.id];if(val!=null&&String(val).trim())answered++;if(item.q.type==="SBA"){sbaTotal++;if(val===item.q.answer)sbaCorrect++}else{vsaqTotal++;if(s.review[item.id]===true)vsaqCorrect++;else if(s.review[item.id]!==false)unmarked++}}
 return{sbaCorrect,sbaTotal,vsaqTotal,vsaqCorrect,unmarked,answered,correct:sbaCorrect+vsaqCorrect,total:m.length};
}
function renderMock(which){
 const m=MOCKS[which];const s=state.mockSessions[which];if(!s){goto("#mocks");return}if(s.status!=="active"){goto("#result/"+which);return}
 if(Date.now()>=s.end){submitPaper(which);return}
 const idx=Math.max(0,Math.min(119,s.index||0)),item=m[idx];if(!item){goto("#mocks");return}
 const q=item.q,sel=s.answers[item.id],flag=(s.flags||[]).includes(item.id);
 let options=q.type==="SBA"?'<div class="options">'+q.options.map((o,i)=>{const letter="ABCD"[i];return '<button class="option '+(sel===letter?"selected":"")+'" data-action="mock-answer" data-paper="'+which+'" data-letter="'+letter+'"><span class="opt-letter">'+letter+'</span>'+esc(o)+'</button>'}).join("")+'</div>':'<label><span class="tiny-note">Your 1–3-word answer:</span><input id="mock-free" class="input" style="display:block;width:100%;margin-top:8px" data-paper="'+which+'" placeholder="Type answer…" maxlength="100" value="'+esc(sel||"")+'"></label>';
 const palette=m.map((t,i)=>'<button class="'+(i===idx?"active ":"")+(s.answers[t.id]!=null&&String(s.answers[t.id]).trim()?"answered ":"")+(s.flags.includes(t.id)?"flagged":"")+'" data-action="mock-jump" data-paper="'+which+'" data-index="'+i+'">'+(i+1)+'</button>').join("");
 const stats=scoreMock(which);
 $("view").innerHTML='<div class="paper-banner"><div><div class="overline">TIMED PRACTICE PAPER '+which+'</div><h1 style="font-size:25px;margin:0">Integrated Assessment · Paper '+which+'</h1></div><div class="page-actions"><span class="timer" id="timer">'+fmtTime(s.end-Date.now())+'</span><button class="btn" data-action="mock-flag" data-paper="'+which+'">'+(flag?"⚑ Flagged":"⚐ Flag")+'</button></div></div><div class="exam-grid"><div><div class="question-panel"><div class="q-progress"><span>QUESTION '+(idx+1)+' / 120 · CLUSTER '+item.section+' / '+MOCK_CASES[which].length+'</span>'+badge(q.type==="VSAQ"?"VSAQ":q.isData||q.skill==="Results interpretation"?"Data interpretation":"SBA","blue")+'</div><div class="exam-stem"><strong>'+esc(item.caseTitle)+'</strong>\n\n'+esc(item.scenario)+'</div><h2>'+esc(q.q)+'</h2>'+options+'<div class="question-foot"><button class="btn btn-sm" data-action="mock-move" data-paper="'+which+'" data-offset="-1" '+(idx===0?"disabled":"")+'>← Previous</button><span class="tiny-note">Answers are hidden until submission</span><button class="btn btn-primary btn-sm" data-action="mock-move" data-paper="'+which+'" data-offset="1" '+(idx===119?"disabled":"")+'>Next →</button></div></div></div><aside class="q-side"><div class="aside-box"><h3>Your answer map</h3><div class="progress-meta"><span>Answered</span><strong>'+stats.answered+' / 120</strong></div><div class="progress-track"><span style="width:'+Math.round(stats.answered/120*100)+'%"></span></div><div class="q-palette" style="max-height:350px;overflow:auto">'+palette+'</div><button class="btn btn-primary btn-wide" data-action="mock-submit" data-paper="'+which+'">Submit paper</button><p class="tiny-note">Timer continues if you close this tab. No answer explanations appear during the paper.</p></div></aside></div>';
 const timer=$("timer");clearInterval(currentTimer);currentTimer=setInterval(()=>{if(!document.getElementById("timer")){clearInterval(currentTimer);return}const remain=s.end-Date.now();timer.textContent=fmtTime(remain);timer.classList.toggle("warning",remain<600000);if(remain<=0){clearInterval(currentTimer);submitPaper(which)}},1000);
}
function submitPaper(which){
 const s=state.mockSessions[which];if(!s||s.status!=="active")return;const list=MOCKS[which];
 s.status="submitted";s.completed=Date.now();s.review=s.review||{};
 for(const item of list){if(item.q.type!=="VSAQ")continue;const typed=norm(s.answers[item.id]||""),accepted=[item.q.answer,...(item.q.accepted||[])].map(norm);s.review[item.id]=typed&&accepted.includes(typed)?true:null}
 save();goto("#result/"+which);toast("Paper submitted. Self-mark remaining VSAQs.")
}
function finishMarking(which){
 const s=state.mockSessions[which];const sum=scoreMock(which);
 if(sum.unmarked>0)return;
 if(s.recorded)return;
 s.recorded=true;state.mockHistory.push({paper:which,correct:sum.correct,total:sum.total,date:Date.now(),id:which+"-"+s.started});
 save();syncMockResult(which,sum);toast("Final score saved: "+sum.correct+" / 120.")
}
function renderResult(which){
 const s=state.mockSessions[which];if(!s||s.status==="active"){goto("#mocks");return}
 const sum=scoreMock(which),complete=sum.unmarked===0,pct=Math.round(sum.correct/120*100);
 const v=MOCKS[which].filter(x=>x.q.type==="VSAQ");
 const marks=v.map(item=>{const ans=s.review[item.id],typed=s.answers[item.id]||"(no answer)";return '<div class="review-row"><b>'+esc(item.caseTitle)+' · VSAQ</b><div style="margin:7px 0">'+esc(item.q.q)+'</div><div class="micro">Your answer: <strong>'+esc(typed)+'</strong> · Expected: <strong>'+esc(item.q.answer)+'</strong></div><p class="tiny-note">'+esc(item.q.explain||"")+'</p><div class="page-actions"><button class="btn btn-sm '+(ans===true?"btn-success":"")+'" data-action="mark-vsaq" data-paper="'+which+'" data-id="'+esc(item.id)+'" data-correct="1">✓ Correct</button><button class="btn btn-sm '+(ans===false?"btn-soft":"")+'" data-action="mark-vsaq" data-paper="'+which+'" data-id="'+esc(item.id)+'" data-correct="0">✕ Incorrect</button></div></div>'}).join("");
 const incorrect=MOCKS[which].filter(i=>i.q.type==="SBA"&&s.answers[i.id]!==i.q.answer).slice(0,26);
 const review=incorrect.map(i=>'<div class="review-row"><b>'+esc(i.caseTitle)+' · Q'+i.q.number+'</b><div style="margin:6px 0">'+esc(i.q.q)+'</div><div>Your answer: '+esc(i.q.options["ABCD".indexOf(s.answers[i.id])]||"Unanswered")+'</div><div style="color:#248a6e;font-weight:800">Expected: '+esc(i.q.options["ABCD".indexOf(i.q.answer)])+'</div><p class="tiny-note">'+esc(i.q.explain||"")+'</p><button class="btn btn-soft btn-sm" data-action="ask-ai" data-paper="'+which+'" data-id="'+esc(i.id)+'">✦ Ask AI tutor</button></div>').join("");
 $("view").innerHTML='<button class="back-link" data-action="back-mocks">← All mock papers</button>'+head("PAPER "+which+" · RESULTS","Your clinical reasoning report","SBA marks are automatic; VSAQs must be self-marked using the expected 1–3-word answers. Your final result is saved only when every VSAQ is marked.")+
 '<section class="panel"><div class="page-head" style="margin:0"><div><div class="overline">'+(complete?"FINAL SCORE":"PROVISIONAL SCORE")+'</div><div class="score-large">'+(complete?sum.correct+"/120":sum.sbaCorrect+"/"+sum.sbaTotal+" SBA")+'</div><div class="micro text-muted">'+(complete?pct+"% overall":sum.unmarked+" VSAQs still awaiting self-marking")+'</div></div><div class="page-actions">'+badge(complete&&pct>=90?"A-level target achieved":complete?"Review weak areas":"Finish marking",complete&&pct>=90?"green":"amber")+'<button class="btn" data-action="export">Export progress</button></div></div><div class="score-bands" style="margin-top:20px"><div class="score-band"><b>'+sum.sbaCorrect+'/'+sum.sbaTotal+'</b><span>SBA correct</span></div><div class="score-band"><b>'+sum.vsaqCorrect+'/'+sum.vsaqTotal+'</b><span>VSAQ correct so far</span></div><div class="score-band"><b>'+sum.answered+'/120</b><span>Answers submitted</span></div></div></section>'+
 '<section class="panel" style="margin-top:18px"><div class="panel-head"><div><h2>Self-mark your VSAQs</h2><p>Credit short equivalent answers if scientifically correct. When unsure, compare with the explanation.</p></div>'+badge(sum.unmarked+" to mark","amber")+'</div><div class="exam-review">'+marks+'</div></section>'+
 '<section class="panel" style="margin-top:18px"><div class="panel-head"><div><h2>Review SBA errors</h2><p>These incorrect or unanswered items are your immediate revision priorities.</p></div></div><div class="exam-review">'+(review||'<p class="tiny-note">All SBAs correct — excellent work.</p>')+'</div></section>';
}
function renderLeaderboard(){
 const done=Object.entries(state.caseAnswers),stats=questionStats();
 const wrongCases=CASES.filter(needsPracticeReview);
 const list=wrongCases.slice(0,16).map(c=>'<div class="board-row"><span class="rank-num">↻</span><span class="board-name">'+esc(c.title)+'</span><a class="btn btn-sm" href="'+caseHash(c.id)+'">Review ↗</a></div>').join("");
 const history=[...(state.practiceHistory||[])].sort((a,b)=>b.time-a.time).slice(0,12).map(h=>{
  const c=CASES.find(x=>String(x.id)===String(h.caseId));
  if(!c)return "";
  const q=c.questions.find(x=>String(x.number)===String(h.question));
  return '<div class="board-row"><span class="rank-num">'+(h.correct?"✓":"✕")+'</span><span class="board-name">'+esc(c.title)+' · Question '+esc(h.question)+'</span><a class="btn btn-sm" href="'+caseHash(c.id,q?c.questions.indexOf(q):0)+'">Revisit</a></div>';
 }).join("");
 $("view").innerHTML=head("PRACTICE PROGRESS","See what you know — and what to fix","Every attempt teaches you something. Use wrong answers and low-confidence topics to decide what to revise next.",'<button class="btn" data-action="export">Export progress ↗</button>')+
 '<div class="stat-grid">'+metric("✦",stats.count?stats.percent+"%":"—","Current practice accuracy","Across submitted practice answers")+
 metric("▤",state.learned.length+"/"+EYE_NOTES.length,"Core conditions revised","Red-listed scope")+
 metric("◈",stats.count,"Practice questions answered","Correct + incorrect")+
 metric("⌁",done.filter(([id,a])=>a.correct===false).length,"Answers to revisit","Review mistakes to learn")+'</div>'+
 '<div class="dashboard-cols"><section class="panel"><div class="panel-head"><div><h2>Review your mistakes</h2><p>Work through explanations, then try a question again.</p></div><button class="btn btn-sm btn-primary" data-action="review-mistakes">Review all ↗</button></div>'+
 (list||'<div class="empty"><h3>No incorrect answers currently saved</h3><p>Start practising and review each explanation as it appears.</p><a class="btn btn-primary" href="#practice">Start practice ↗</a></div>')+'</section>'+
 '<section class="panel"><div class="panel-head"><div><h2>Recent practice</h2><p>Attempt history stays saved even if you retry a question.</p></div></div>'+
 (history||'<div class="empty"><h3>No attempts yet</h3><p>Start a case to build your revision history.</p></div>')+'</section></div>';
}
function renderLectures(){
 let choices=["All",...new Set(SLIDES.map(x=>x.module))].sort();let slides=SLIDES.filter(s=>(filterLectures==="All"||s.module===filterLectures)&&norm(s.name+" "+s.module).includes(norm(searchText)));
 $("view").innerHTML=head("SOURCE LIBRARY","Wits lecture bank","Direct Google Drive lecture links supplied for GEMP1 revision. These are references — this website does not redistribute the slide PDFs.",'<a class="btn btn-primary" href="https://drive.google.com/drive/folders/185j-AM_bQrW6duNPT5NQIGCTzxQ_8yD8" target="_blank" rel="noopener">Open Drive folder ↗</a>')+
 '<div class="toolbar"><label class="search-field"><span>⌕</span><input id="lectures-search" type="search" aria-label="Search lectures" placeholder="Find lecture titles…" value="'+esc(searchText)+'"></label><select id="lecture-module" class="select" aria-label="Select lecture module">'+choices.map(x=>'<option value="'+esc(x)+'" '+(x===filterLectures?"selected":"")+'>'+esc(x)+'</option>').join("")+'</select></div><p class="tiny-note">'+slides.length+' lecture references shown</p><div class="lectures-list">'+slides.map(s=>'<a class="lecture-item" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer"><span>▥</span><div><b>'+esc(s.name)+'</b><small>'+esc(s.module)+'</small></div><span>↗</span></a>').join("")+'</div>';
}
const Flash=window.createMuaazFlashcards({notes:EYE_NOTES,studyGroups:window.MED_PAPER_GROUPS,getState:()=>state,save,goto,view:()=>$("view"),esc,norm,badge,toast,render});
function render(){clearInterval(currentTimer);let r=decodeURIComponent(location.hash.replace(/^#/,"")||"home").split("/");let page=r[0]||"home";if(!["home","notes","note","cases","practice","flow","case","mocks","mock","result","leaderboard","lectures","flashcards","study"].includes(page))page="home";setCrumb(page);setIdentity();
 try{
  if(page==="home")renderHome();
  else if(page==="notes")renderNotes();
  else if(page==="note")renderDetail(r.slice(1).join("/"));
  else if(page==="cases"||page==="practice")renderCases();
  else if(page==="flow"){if(r[1])renderFlow(r.slice(1).join("/"));else renderFlowLanding()}
  else if(page==="case")renderCase(r[1],r[2]);
  else if(page==="mocks"){goto("#practice");return}
  else if(page==="mock"){goto("#practice");return}
  else if(page==="result"){goto("#practice");return}
  else if(page==="leaderboard")renderLeaderboard();
  else if(page==="lectures")renderLectures();
  else if(page==="flashcards")Flash.overview();
  else if(page==="study")Flash.study();
 }catch(err){console.error(err);$("view").innerHTML='<div class="empty"><h3>We could not load that section.</h3><p>'+esc(err.message)+'</p><a class="btn" href="#home">Return to dashboard</a></div>'}
}
function startMock(p){if(!MOCKS[p]||MOCKS[p].length!==120){toast("This paper is not ready");return}let s=state.mockSessions[p];if(!s||s.status!=="active"){s={status:"active",started:Date.now(),end:Date.now()+180*60000,index:0,answers:{},flags:[],review:{},recorded:false};state.mockSessions[p]=s;save()}goto("#mock/"+p)}
function goMockIndex(p,i){const s=state.mockSessions[p];if(!s)return;s.index=Math.min(119,Math.max(0,i));save();render()}
function markVsaq(p,id,correct){const s=state.mockSessions[p];if(!s||s.status==="active")return;s.review[id]=correct;save();finishMarking(p);render()}
function exportProgress(){const data={format:"muaazmed-progress-v5",exported:new Date().toISOString(),state};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");const url=URL.createObjectURL(blob);a.href=url;a.download="muaazmed-progress-"+today()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast("Your progress file is ready")}
function closeModal(){$("modal-root").innerHTML="";$("drawer-root").innerHTML=""}
function showAccount(mode="signin"){
 const configured=Boolean(CONFIG.url&&(CONFIG.publishableKey||CONFIG.anonKey));
 let h='<div class="modal-wrap" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="Student account" data-no-close="1"><button class="close-x" data-action="close-modal" aria-label="Close dialog">×</button><div class="overline">STUDENT PROFILE</div><h2>'+(authUser?"Your study account":"Study now, sign in when ready")+'</h2>';
 if(authUser){h+='<p>You are signed in as <strong>'+esc(authUser.email||"student")+'</strong>. Your saved progress synchronises while online.</p><label for="nickname">Display name</label><input id="nickname" class="input" maxlength="32" value="'+esc(authUser.user_metadata?.nickname||authUser.email?.split("@")[0]||"Student")+'"><div class="page-actions" style="margin-top:15px"><label style="display:flex;align-items:center;gap:7px;margin:0;font-size:11px"><input type="checkbox" id="visible-board"> Show my mock score on the opt-in leaderboard</label></div><div class="modal-actions"><button class="btn btn-primary" data-action="save-profile">Save profile</button><button class="btn" data-action="signout">Sign out</button></div>'}
 else{h+='<p>No login is needed to study. Guest progress stays on this device. Optional accounts provide cross-device sync after the backend is connected.</p><label for="guest-nickname">Guest display name</label><input id="guest-nickname" class="input" maxlength="32" value="'+esc(state.guestName)+'"><button class="btn btn-soft btn-sm" style="margin-top:8px" data-action="guest-save">Save guest name</button>';
  if(configured){h+='<div class="rule"></div><div class="overline">'+(mode==="signup"?"CREATE ACCOUNT":"EXISTING ACCOUNT")+'</div><label for="auth-email">Email</label><input id="auth-email" class="input" type="email" autocomplete="email"><label for="auth-password">Password</label><input id="auth-password" class="input" type="password" autocomplete="'+(mode==="signup"?"new-password":"current-password")+'" minlength="8"><div class="modal-actions"><button class="btn btn-primary" data-action="auth-go" data-mode="'+mode+'">'+(mode==="signup"?"Create account":"Sign in")+'</button><button class="btn" data-action="auth-mode" data-mode="'+(mode==="signup"?"signin":"signup")+'">'+(mode==="signup"?"Already have an account? Sign in":"Create account")+'</button></div>'}
  else{h+='<div class="notice warning">Accounts and shared scoreboard are not connected yet. The study platform, local progress, mocks and explanations work without any account. A Supabase setup is required to activate synced accounts.</div>'}
 }
 h+='<div class="auth-status" id="auth-status"></div></section></div>';$("modal-root").innerHTML=h;
 if(authUser&&supabase)supabase.from("profiles").select("leaderboard_visible").eq("id",authUser.id).maybeSingle().then(({data})=>{if($("visible-board"))$("visible-board").checked=Boolean(data?.leaderboard_visible)});
}
async function ensureAuth(){if(supabase)return supabase;if(!CONFIG.url||!(CONFIG.publishableKey||CONFIG.anonKey))return null;try{const m=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");supabase=m.createClient(CONFIG.url,CONFIG.publishableKey||CONFIG.anonKey);const {data}=await supabase.auth.getUser();authUser=data?.user||null;authReady=true;supabase.auth.onAuthStateChange((_event,session)=>{authUser=session?.user||null;setIdentity();if(authUser)loadCloudProgress()});if(authUser)await loadCloudProgress();loadLeaderboard();render();return supabase}catch(e){console.warn("Accounts unavailable:",e);authReady=false;return null}}
async function authGo(mode){const status=$("auth-status");const email=String($("auth-email")?.value||"").trim(),password=String($("auth-password")?.value||"");if(!email.includes("@")||password.length<8){status.textContent="Enter a valid email and password of at least 8 characters.";return}const api=await ensureAuth();if(!api){status.textContent="Account backend is not connected or could not load.";return}status.textContent="Connecting…";
 try{const resp=mode==="signup"?await api.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname+"#home"}}):await api.auth.signInWithPassword({email,password});if(resp.error)throw resp.error;status.style.color="#16866d";status.textContent=mode==="signup"?"Account created. Check your email if confirmation is enabled.":"Signed in successfully.";if(resp.data?.session){authUser=resp.data.user;await loadCloudProgress();setTimeout(closeModal,650);render()}}catch(e){status.textContent=e.message||"Authentication failed."}}
async function signOut(){if(supabase)await supabase.auth.signOut();authUser=null;state=defaultState();save();closeModal();render();toast("Signed out; guest session reset on this device")}
async function saveProfile(){if(!supabase||!authUser)return;const nickname=String($("nickname")?.value||"").trim().slice(0,32);const visible=Boolean($("visible-board")?.checked);if(!nickname){toast("Choose a display name");return}
 const a=await supabase.from("profiles").upsert({id:authUser.id,nickname,leaderboard_visible:visible},{onConflict:"id"});if(a.error){toast(a.error.message);return}
 await supabase.auth.updateUser({data:{nickname}});toast("Profile updated");closeModal();loadLeaderboard();render()}
async function loadCloudProgress(){if(!supabase||!authUser)return;try{const {data,error}=await supabase.from("progress").select("snapshot").eq("user_id",authUser.id).maybeSingle();if(error)throw error;if(data?.snapshot&&typeof data.snapshot==="object"){const remote=data.snapshot;state=Object.assign(defaultState(),remote);localStorage.setItem(KEY,JSON.stringify(state))}render()}catch(e){console.warn("Sync read failed:",e)}}
async function syncNow(){if(!supabase||!authUser)return;try{const {error}=await supabase.from("progress").upsert({user_id:authUser.id,snapshot:state,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error}catch(e){console.warn("Cloud sync error:",e)}}
async function syncMockResult(p,score){if(!supabase||!authUser)return;try{await supabase.from("mock_results").insert({user_id:authUser.id,paper:p,correct:score.correct,total:120})}catch(e){console.warn("Mock score upload failed:",e)}}
async function loadLeaderboard(){if(!supabase)return;try{const {data,error}=await supabase.rpc("get_leaderboard");if(error)throw error;communityEntries=Array.isArray(data)?data:[];if(location.hash==="#leaderboard")render()}catch(e){console.warn("Leaderboard unavailable:",e)}}
function openTutor(c,q,submitted=true){activeQuestion={c,q};const explanation=String(q.explain||q.point||"No detailed explanation is included for this practice item.");const ready=Boolean(supabase&&authUser);
 $("drawer-root").innerHTML='<div class="drawer-wrap" data-action="close-modal"><div class="drawer" data-no-close="1"><div class="drawer-head"><h2>✦ MuaazMed AI tutor</h2><button class="close-x" style="position:static" data-action="close-modal">×</button></div><div class="drawer-content" id="ai-content"><div class="chip blue">CASE-BASED EXPLANATIONS</div><h3 style="margin-top:20px;font-size:16px">'+esc(c.title)+'</h3><p class="micro">'+esc(q.q)+'</p><div class="ai-message"><strong>VERIFIED QUESTION-BANK EXPLANATION</strong>'+esc(explanation)+'</div>'+(ready?'<div class="notice good">You can ask a follow-up question using your account. AI responses are educational, may make mistakes and must be checked against lectures.</div>':'<div class="notice warning">Live AI requires a configured authenticated backend and server-side API key. The authored answer explanation above works without it.</div>')+'</div><div class="drawer-input"><textarea id="ai-prompt" class="textarea" placeholder="Explain the mechanism, why B is wrong, or how to interpret these results…" maxlength="1200"></textarea><button class="btn btn-primary btn-wide" data-action="ask-ai-send" '+(!ready?"disabled":"")+'>Ask follow-up →</button></div></div></div>';
}
async function sendAI(){if(!activeQuestion||!supabase||!authUser){toast("Sign in after the AI backend is connected");return}const prompt=$("ai-prompt")?.value.trim();if(!prompt){toast("Type a question");return}const content=$("ai-content");const div=document.createElement("div");div.className="ai-message user";div.innerHTML='<strong>YOU ASKED</strong>'+esc(prompt);content.append(div);$("ai-prompt").value="";const reply=document.createElement("div");reply.className="ai-message";reply.textContent="Thinking through the clinical reasoning…";content.append(reply);content.scrollTop=content.scrollHeight;
 try{const {data,error}=await supabase.functions.invoke("ask-ai",{body:{prompt,context:{scenario:activeQuestion.c.scenario,question:activeQuestion.q.q,options:activeQuestion.q.options||[],expected:activeQuestion.q.answer,explanation:activeQuestion.q.explain||""}}});if(error)throw error;if(!data||!data.answer)throw Error(data?.error||"No AI response returned.");reply.textContent=data.answer}catch(e){reply.textContent="AI service unavailable: "+(e.message||"Please try again.")}}
document.addEventListener("click",e=>{
 const el=e.target.closest("[data-action]");if(!el)return;
 const action=el.dataset.action;
 if(Flash.handleAction(action,el))return;
 if(action==="close-modal"){if(e.target.closest("[data-no-close]")&&!e.target.closest(".close-x"))return;closeModal();return}
 if(["search","menu","account","export","load-board"].includes(action)){
  if(action==="search"){goto("#notes");setTimeout(()=>$("notes-search")?.focus(),80)}
  if(action==="menu")$("sidebar").classList.toggle("open");
  if(action==="account")showAccount();
  if(action==="export")exportProgress();
  if(action==="load-board")loadLeaderboard();
  return}
 if(action==="module"){notePaper=el.dataset.paper||"All";noteSubject=el.dataset.subject||"All";filterNotes="All";searchText="";goto("#notes");return}
 if(action==="filter"){const section=el.dataset.section;if(section==="notes")filterNotes=el.dataset.value;else if(section==="cases")filterCases=el.dataset.value;render();return}
 if(action==="review-mistakes"){filterCases="Mistakes";casePaper="All";caseSubject="All";searchText="";goto("#practice");return}
 if(action==="learn"){learnToggle(el.dataset.name);return}
 if(action==="save"){saveToggle(el.dataset.name);return}
 if(action==="back-notes"){goto("#notes");return}
 if(action==="back-cases"){goto("#practice");return}
 if(action==="back-mocks"){goto("#mocks");return}
 if(action==="quick-check"){const note=EYE_NOTES.find(n=>n.name===el.dataset.name);if(!note)return;const answer=($("quick-answer")?.value||"").trim();if(!answer){toast("Type 1–3 words");return}const correct=norm(answer)===norm(note.answer)||norm(answer).includes(norm(note.answer));state.quickChecks[note.name]={answer,correct};save();render();return}

 if(action==="flow-start"){const paper=el.dataset.paper;if(!FLOW_QUEUES.has(paper))return;flowGetSession(paper);goto("#flow/"+encodeURIComponent(paper));return}
 if(action==="flow-restart"){const paper=el.dataset.paper;if(!FLOW_QUEUES.has(paper))return;
   if(!confirm("Restart "+paper+" continuous practice? This resets its current flow answers and position but keeps your individual case work."))return;
   state.flowSessions[paper]={index:0,answers:{},started:Date.now(),updated:Date.now(),finished:false};save();goto("#flow/"+encodeURIComponent(paper));return}
 if(action==="flow-next"){flowAdvance(el.dataset.paper,1);return}
 if(action==="flow-prev"){flowAdvance(el.dataset.paper,-1);return}
 if(action==="flow-answer"){const paper=el.dataset.paper,current=flowCurrent(paper);
   if(!current||current.item.q.type!=="SBA")return;
   if(!"ABCD".includes(el.dataset.letter))return;
   flowRecordAnswer(paper,el.dataset.letter);return}
 if(action==="flow-submit-vsaq"){const paper=el.dataset.paper,current=flowCurrent(paper);
   if(!current||current.item.q.type!=="VSAQ")return;
   const answer=($("flow-free")?.value||"").trim();
   if(!answer){toast("Type your answer or choose Reveal");return}
   flowRecordAnswer(paper,answer,true);return}
 if(action==="flow-reveal-vsaq"){const paper=el.dataset.paper,current=flowCurrent(paper);
   if(!current||current.item.q.type!=="VSAQ")return;
   flowRecordAnswer(paper,"—",true);return}
 if(action==="flow-mark-vsaq"){const paper=el.dataset.flowPaper,current=flowCurrent(paper);
   if(!current||current.item.q.type!=="VSAQ")return;
   const key=flowItemKey(current.item),record=current.sess.answers[key];
   if(!record)return;
   if(!record.selfReviewed)state.practiceHistory.push({caseId:current.item.c.id,question:current.item.q.number,answer:record.answer,
    correct:el.dataset.correct==="1",paper,source:"continuous",time:Date.now()});
   record.correct=el.dataset.correct==="1";record.selfReviewed=true;current.sess.updated=Date.now();save();render();return}
 if(action==="flow-retry-question"){const paper=el.dataset.paper,current=flowCurrent(paper);if(!current)return;
   delete current.sess.answers[flowItemKey(current.item)];current.sess.finished=false;save();render();return}
 if(action==="flow-jump"){const paper=el.dataset.paper,pack=FLOW_QUEUES.get(paper),sess=flowGetSession(paper),idx=Number(el.dataset.index);
   if(!pack||!sess||!Number.isInteger(idx)||idx<0||idx>=pack.items.length)return;
   sess.index=idx;sess.finished=false;save();goto("#flow/"+encodeURIComponent(paper));return}
 if(action==="answer-case"){const c=CASES.find(x=>String(x.id)===el.dataset.case),q=c?.questions[Number(el.dataset.index)];if(!q||state.caseAnswers[qrKey(c,q)])return;const correct=el.dataset.letter===q.answer;state.caseAnswers[qrKey(c,q)]={answer:el.dataset.letter,correct,time:Date.now()};state.practiceHistory.push({caseId:c.id,question:q.number,correct,answer:el.dataset.letter,time:Date.now()});save();render();if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>document.getElementById("answer-feedback")?.scrollIntoView({behavior:"smooth",block:"nearest"}));return}
 if(action==="answer-vsaq"){const c=CASES.find(x=>String(x.id)===el.dataset.case),q=c?.questions[Number(el.dataset.index)];if(!q||state.caseAnswers[qrKey(c,q)])return;const answer=($("case-free")?.value||"").trim();if(!answer){toast("Type a short answer");return}state.caseAnswers[qrKey(c,q)]={answer,correct:null,time:Date.now(),selfReviewed:false};save();render();if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>document.getElementById("answer-feedback")?.scrollIntoView({behavior:"smooth",block:"nearest"}));return}
 if(action==="mark-practice-vsaq"){const c=CASES.find(x=>String(x.id)===el.dataset.case),q=c?.questions.find(x=>String(x.number)===el.dataset.number);if(!q)return;const a=state.caseAnswers[qrKey(c,q)];if(!a)return;a.correct=el.dataset.correct==="1";a.selfReviewed=true;state.practiceHistory.push({caseId:c.id,question:q.number,correct:a.correct,answer:a.answer,time:Date.now()});save();render();return}
 if(action==="practice-retry"){const c=CASES.find(x=>String(x.id)===el.dataset.case),q=c?.questions[Number(el.dataset.index)];if(!q)return;delete state.caseAnswers[qrKey(c,q)];save();render();return}
 if(action==="practice-reset-case"){const c=CASES.find(x=>String(x.id)===el.dataset.case);if(!c)return;for(const q of c.questions)delete state.caseAnswers[qrKey(c,q)];save();goto(caseHash(c.id,0));return}
 if(action==="case-jump"){const c=CASES.find(x=>String(x.id)===el.dataset.case);if(!c)return;const idx=Number(el.dataset.index);if(idx<0||idx>=c.questions.length)return;goto(caseHash(c.id,idx));return}
 if(action==="flag"){state.flags[el.dataset.key]=!state.flags[el.dataset.key];save();render();return}
 if(action==="mock-start"){startMock(el.dataset.paper);return}
 if(action==="mock-answer"){const p=el.dataset.paper,s=state.mockSessions[p];if(!s)return;const item=MOCKS[p][s.index];s.answers[item.id]=el.dataset.letter;save();render();return}
 if(action==="mock-jump"){goMockIndex(el.dataset.paper,Number(el.dataset.index));return}
 if(action==="mock-move"){const p=el.dataset.paper;goMockIndex(p,(state.mockSessions[p]?.index||0)+Number(el.dataset.offset));return}
 if(action==="mock-flag"){const p=el.dataset.paper,s=state.mockSessions[p];if(!s)return;const id=MOCKS[p][s.index].id;const idx=s.flags.indexOf(id);if(idx<0)s.flags.push(id);else s.flags.splice(idx,1);save();render();return}
 if(action==="mock-submit"){const p=el.dataset.paper;if(!confirm("Submit Paper "+p+"? Unanswered questions will receive no marks and you can then review all explanations."))return;submitPaper(p);return}
 if(action==="mark-vsaq"){markVsaq(el.dataset.paper,el.dataset.id,el.dataset.correct==="1");return}
 if(action==="ask-ai"){const c=el.dataset.case?CASES.find(x=>String(x.id)===el.dataset.case):CASES.find(x=>x.id===MOCKS[el.dataset.paper]?.find(q=>q.id===el.dataset.id)?.caseId);let q=el.dataset.case?c?.questions[Number(el.dataset.index)]:MOCKS[el.dataset.paper]?.find(x=>x.id===el.dataset.id)?.q;if(c&&q)openTutor(c,q);return}
 if(action==="ask-ai-send"){sendAI();return}
 if(action==="auth-mode"){showAccount(el.dataset.mode);return}
 if(action==="auth-go"){authGo(el.dataset.mode);return}
 if(action==="guest-save"){const val=($("guest-nickname")?.value||"Guest student").trim().slice(0,32);state.guestName=val||"Guest student";save();setIdentity();toast("Guest name saved");return}
 if(action==="save-profile"){saveProfile();return}
 if(action==="signout"){signOut();return}
});
document.addEventListener("input",e=>{
 const t=e.target;
 if(Flash.handleInput(t))return;
 if(t.id==="notes-search"){searchText=t.value;refreshNotesList()}
 if(t.id==="cases-search"){searchText=t.value;renderCases();const input=$("cases-search");if(input){input.focus();input.setSelectionRange(searchText.length,searchText.length)}}
 if(t.id==="lectures-search"){searchText=t.value;renderLectures();const input=$("lectures-search");if(input){input.focus();input.setSelectionRange(searchText.length,searchText.length)}}
 if(t.id==="mock-free"){const p=t.dataset.paper,s=state.mockSessions[p];if(s&&s.status==="active"){const item=MOCKS[p][s.index];s.answers[item.id]=t.value;save()}}
});
document.addEventListener("change",e=>{if(Flash.handleChange(e.target))return;if(e.target.id==="lecture-module"){filterLectures=e.target.value;renderLectures()}
 if(e.target.id==="notes-paper"){notePaper=e.target.value;noteSubject="All";renderNotes()}
 if(e.target.id==="notes-subject"){noteSubject=e.target.value;refreshNotesList()}
 if(e.target.id==="cases-paper"){casePaper=e.target.value;caseSubject="All";renderCases()}
 if(e.target.id==="cases-subject"){caseSubject=e.target.value;renderCases()}});
window.addEventListener("hashchange",()=>{searchText="";$("sidebar")?.classList.remove("open");window.scrollTo({top:0,behavior:"auto"});render()});
window.addEventListener("keydown",e=>{
 if(Flash.handleKey(e))return;
 const tag=e.target?.tagName;
 if(location.hash.startsWith("#flow/")&&!["INPUT","TEXTAREA","SELECT"].includes(tag)&&!e.altKey&&!e.ctrlKey&&!e.metaKey){
  const paper=decodeURIComponent(location.hash.slice(6)),current=flowCurrent(paper);
  if(current){
   if(current.item.q.type==="SBA"&&["1","2","3","4"].includes(e.key)&&!current.sess.answers[flowItemKey(current.item)]){
    e.preventDefault();flowRecordAnswer(paper,"ABCD"[Number(e.key)-1]);return;
   }
   if((e.key==="Enter"||e.key==="ArrowRight")&&flowCanContinue(current.item,current.sess)){
    e.preventDefault();flowAdvance(paper,1);return;
   }
  }
 }
 if(e.key==="Escape")closeModal();
});
window.addEventListener("beforeunload",()=>{clearInterval(currentTimer)});
if(EYE_NOTES.length!==66||CASES.length!==219||totalQuestions!==1877||SLIDES.length!==72||Flash.cards.length!==1254){console.warn("MuaazMed content validation:",{notes:EYE_NOTES.length,cases:CASES.length,questions:totalQuestions,slides:SLIDES.length})}
if(!location.hash)history.replaceState(null,"","#home");
setIdentity();render();ensureAuth();
})();