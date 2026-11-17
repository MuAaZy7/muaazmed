/* MuaazMed flashcard engine v1: per-core decks, flip, scheduled recall and progress.
 * The host app supplies its existing state/save/navigation helpers so guest and cloud
 * progress share the existing account snapshot without introducing an extra login.
 */
window.createMuaazFlashcards=function(env){
 "use strict";
 const {notes,studyGroups,getState,save,goto,view,esc,norm,badge,toast,render}=env;
 const papers=studyGroups?.papers||[];
 const indexed=new Map();
 for(const p of papers)for(const s of p.subjects)for(const name of s.conditions){const x=indexed.get(name)||[];x.push({paper:p.paper,subject:s.name});indexed.set(name,x)}
 const tags=name=>indexed.get(name)||[];
 const seeds=Array.isArray(window.MED_FLASHCARD_SEEDS)?window.MED_FLASHCARD_SEEDS:[];
 const base=seeds.flatMap((seed,i)=>{
  const note=notes.find(n=>n.name===seed.name);if(!note)return[];
  return [...seed.pairs,{front:note.vsaq,back:note.answer,skill:"VSAQ"}].map((p,j)=>({
   id:"eye2026-"+(i+1)+"-"+(j+1),name:note.name,module:note.category,
   front:p.front,back:p.back,skill:p.skill
  }));
 });
 const extensions=Array.isArray(window.MED_FLASHCARD_EXTENDED)?window.MED_FLASHCARD_EXTENDED:[];
 const extended=extensions.flatMap((seed,i)=>{
  const note=notes.find(n=>n.name===seed.name);if(!note)return[];
  return (seed.cards||[]).map((p,j)=>({
   id:"eye2026-deep-"+(i+1)+"-"+(j+1),name:note.name,module:note.category,
   front:p.front,back:p.back,skill:p.skill
  }));
 });
 const all=[...base,...extended];
 const DAY=86400000;
 let scope="All",mode="Due",batch=20,search="";
 const safeState=()=>{const s=getState();if(!s.flashcards||typeof s.flashcards!=="object")s.flashcards={};return s};
 const record=c=>safeState().flashcards[c.id]||null;
 const due=(c,now=Date.now())=>{const r=record(c);return !r||!Number.isFinite(r.dueAt)||r.dueAt<=now};
 const mastered=c=>{const r=record(c);return !!r&&r.reps>=3&&r.intervalDays>=14&&["Good","Easy"].includes(r.lastRating)};
 const deckFor=x=>all.filter(c=>{
  if(x==="All")return true;
  if(x.startsWith("condition:"))return c.name===x.slice(10);
  if(x.startsWith("paper:"))return tags(c.name).some(t=>t.paper===x.slice(6));
  if(x.startsWith("subject:"))return tags(c.name).some(t=>t.subject===x.slice(8));
  if(x.startsWith("paper-subject:")){const parts=x.slice(14).split("|");return tags(c.name).some(t=>t.paper===parts[0]&&t.subject===parts[1]);}
  if(x.startsWith("module:"))return tags(c.name).some(t=>t.subject===x.slice(7));
  return false;
 });
 const stats=cards=>({total:cards.length,due:cards.filter(c=>due(c)).length,seen:cards.filter(c=>record(c)).length,mastered:cards.filter(mastered).length});
 const statsFor=name=>stats(deckFor("condition:"+name));
 const selected=()=>safeState().flashSession;
 function randomised(list){const v=[...list];for(let i=v.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[v[i],v[j]]=[v[j],v[i]]}return v}
 function filtered(c,selection){const r=record(c);
  if(selection==="New")return !r;
  if(selection==="Missed")return Boolean(r&&r.lapses>0);
  if(selection==="Due")return due(c);
  return true;
 }
 function start(choice,selection,count){
  choice=choice||scope;selection=selection||mode;count=Math.max(0,Number(count)||0);
  let list=deckFor(choice).filter(c=>filtered(c,selection));
  if(!list.length){toast(selection==="Due"?"Nothing due yet. Choose All for extra practice.":"No matching cards. Try another review mode.");return}
  // Prioritise previously missed due cards, then other due cards, then unseen cards.
  const first=randomised(list.filter(c=>record(c)&&due(c)&&record(c).lapses>0));
  const second=randomised(list.filter(c=>record(c)&&due(c)&&!record(c).lapses));
  const fresh=randomised(list.filter(c=>!record(c)));
  const other=randomised(list.filter(c=>record(c)&&!due(c)));
  list=[...first,...second,...fresh,...other].slice(0,count||list.length);
  safeState().flashSession={scope:choice,mode:selection,queue:list.map(c=>c.id),position:0,revealed:false,initialCount:list.length,repeats:{},ratings:{Again:0,Hard:0,Good:0,Easy:0},started:Date.now()};
  save();goto("#study");
 }
 function current(){const s=selected();return s?all.find(c=>c.id===s.queue[s.position]):null}
 function flip(){const s=selected();if(!s||s.position>=s.queue.length)return;s.revealed=!s.revealed;save();study()}
 function rate(rating){
  const s=selected(),c=current();if(!s||!c||!s.revealed||!["Again","Hard","Good","Easy"].includes(rating))return;
  const before=record(c)||{ease:2.5,reps:0,intervalDays:0,lapses:0};
  let ease=Number(before.ease)||2.5,reps=Number(before.reps)||0,days=Number(before.intervalDays)||0,lapses=Number(before.lapses)||0;
  if(rating==="Again"){reps=0;lapses++;ease=Math.max(1.3,ease-.20);days=10/1440}
  if(rating==="Hard"){reps++;ease=Math.max(1.3,ease-.12);days=days>=1?Math.max(1,Math.round(days*1.2)):1}
  if(rating==="Good"){reps++;days=days<1?2:Math.max(3,Math.round(days*ease))}
  if(rating==="Easy"){reps++;ease=Math.min(3.2,ease+.13);days=days<1?5:Math.max(7,Math.round(days*ease*1.3))}
  safeState().flashcards[c.id]={ease,reps,intervalDays:days,lapses,dueAt:Date.now()+days*DAY,lastAt:Date.now(),lastRating:rating};
  s.ratings[rating]=(s.ratings[rating]||0)+1;
  // Retest an Again card once more at the end of this study session.
  if(rating==="Again"&&(s.repeats[c.id]||0)<1){s.repeats[c.id]=1;s.queue.push(c.id)}
  s.position++;s.revealed=false;save();study();
 }
 function option(value,label,chosen){return '<option value="'+esc(value)+'"'+(value===chosen?" selected":"")+'>'+esc(label)+'</option>'}
 function menu(){
  let html=option("All","Both papers · All 66 core conditions",scope);
  for(const p of papers){
   html+='<optgroup label="'+esc(p.paper)+'">';
   html+=option("paper:"+p.paper,p.paper+" · all subjects",scope);
   for(const s of p.subjects)html+=option("paper-subject:"+p.paper+"|"+s.name,p.paper+" · "+s.name,scope);
   html+='</optgroup>';
  }
  html+='<optgroup label="Individual core conditions">';
  for(const n of [...notes].sort((a,b)=>a.name.localeCompare(b.name)))html+=option("condition:"+n.name,n.name,scope);
  html+='</optgroup>';
  return html;
 }
 function metric(icon,title,value){return '<div class="flash-metric"><span class="glyph">'+icon+'</span><b>'+value+'</b><small>'+title+'</small></div>'}
 function overview(){
  const s=stats(all);
  view().innerHTML='<div class="flash-hero"><div><div class="overline">ACTIVE RECALL · SPACED REVISION</div><h1>Know it <em style="font-style:normal;color:#4e58c5">before</em> you flip.</h1><p>'+all.length+' high-yield flashcards across 66 red-listed GEMP1 conditions. Recognise clinical patterns, explain mechanisms, select investigations, flag emergencies and distinguish lookalikes. Rate recall to schedule the next review.</p></div><div class="flash-burst" aria-hidden="true">◈</div></div>'+
   '<div class="study-exam-notice">This paper-by-subject layout follows your study split. The official Wits guide does not confirm a fixed distribution of conditions between examination papers.</div><div class="flash-metric-grid">'+metric("▤","Flashcards",s.total)+metric("◷","Due for review",s.due)+metric("◎","Studied at least once",s.seen)+metric("✦","Mastered",s.mastered)+'</div>'+
   '<section class="panel"><div class="panel-head"><div><h2>Create a review session</h2><p>Choose a study paper, subject or individual disease, then review due, new or missed cards.</p></div>'+badge("Deep decks · no six-card limit","blue")+'</div>'+
   '<div class="flash-controls"><label class="flash-field">Deck<select id="flash-scope">'+menu()+'</select></label>'+
   '<label class="flash-field">Review mode<select id="flash-mode">'+["Due","New","Missed","All"].map(x=>option(x,x,mode)).join("")+'</select></label>'+
   '<label class="flash-field">Cards this session<select id="flash-limit">'+[10,20,40,80,160,0].map(x=>option(String(x),x===0?"Entire available deck":x+" cards",String(batch))).join("")+'</select></label>'+
   '<button class="btn btn-primary" data-action="flash-start">Start review →</button></div>'+
   '<div class="notice good">Say the answer aloud or think it through, then flip. Mark <b>Again</b>, <b>Hard</b>, <b>Good</b> or <b>Easy</b> based on recall — not on how familiar the answer looks after revealing it. Your ratings schedule future reviews.</div></section>'+
   '<div class="flash-section-head"><div><h2>Core condition decks by paper</h2><p>Paper 1: BCMH · CVS · Respiratory. Paper 2: Renal · GIT · MSK · Haem/Onc.</p></div><span class="chip blue" id="flash-deck-count">66 conditions</span></div>'+
   '<div class="toolbar"><label class="search-field"><span>⌕</span><input id="flash-search" type="search" placeholder="Search core conditions…" value="'+esc(search)+'" aria-label="Search flashcard decks"></label></div>'+
   '<div id="flash-decks"></div>';
  refreshDecks();
 }
 function refreshDecks(){
  const target=document.getElementById("flash-decks");if(!target)return;
  const accepted=new Set(deckFor(scope).filter(c=>norm(c.name+" "+tags(c.name).map(t=>t.subject).join(" ")).includes(norm(search))).map(c=>c.name));
  const chosenPapers=papers.filter(p=>!scope.startsWith("paper:")&&!scope.startsWith("paper-subject:")||p.paper===(scope.startsWith("paper:")?scope.slice(6):scope.slice(14).split("|")[0]));
  let shown=new Set(),listed=0;
  target.innerHTML=chosenPapers.map(p=>{
   const sections=p.subjects.filter(s=>!scope.startsWith("paper-subject:")||p.paper+"|"+s.name===scope.slice(14)).map(s=>{
    const names=s.conditions.filter(name=>accepted.has(name));
    if(!names.length)return "";
    names.forEach(n=>shown.add(n));listed+=names.length;
    const cards=names.map(name=>{
     const st=statsFor(name),pct=Math.round(st.mastered/Math.max(st.total,1)*100);
     return '<button class="flash-deck-tile" data-action="flash-start" data-scope="condition:'+esc(name)+'" data-mode="All" data-limit="0">'+
      '<span class="top">'+badge(s.name,"blue")+'<span>'+st.due+' due</span></span><h3>'+esc(name)+'</h3><div class="flash-deck-progress"><span style="width:'+pct+'%"></span></div>'+
      '<footer><span>'+st.mastered+' / '+st.total+' mastered</span><strong>Flip cards ↗</strong></footer></button>';
    }).join("");
    return '<section class="study-subject-section"><div class="study-subject-heading"><h3>'+esc(s.name)+'</h3><span>'+names.length+' conditions</span></div><div class="flash-condition-grid">'+cards+'</div></section>';
   }).join("");
   return sections?'<section class="study-paper-block"><div class="study-paper-heading"><span>'+esc(p.paper)+'</span><p>'+p.subjects.map(s=>esc(s.name)).join(" · ")+'</p></div>'+sections+'</section>':"";
  }).join("")||'<div class="empty"><h3>No matching core decks</h3><p>Try another study paper, subject or search term.</p></div>';
  const count=document.getElementById("flash-deck-count");if(count)count.textContent=shown.size+" unique cores · "+listed+" listings";
 }
 function ratingsMarkup(){
  return '<div class="flash-rating-buttons">'+
    '<button class="flash-rating again" data-action="flash-rate" data-rating="Again"><strong>1 · Again</strong><small>10 minutes</small></button>'+
    '<button class="flash-rating hard" data-action="flash-rate" data-rating="Hard"><strong>2 · Hard</strong><small>~1 day</small></button>'+
    '<button class="flash-rating good" data-action="flash-rate" data-rating="Good"><strong>3 · Good</strong><small>2+ days</small></button>'+
    '<button class="flash-rating easy" data-action="flash-rate" data-rating="Easy"><strong>4 · Easy</strong><small>5+ days</small></button></div>';
 }
 function study(){
  const s=selected();if(!s){goto("#flashcards");return}
  if(s.position>=s.queue.length){complete();return}
  const c=current();if(!c){goto("#flashcards");return}
  const progress=Math.round(s.position/Math.max(1,s.queue.length)*100);
  const title=s.scope.startsWith("condition:")?s.scope.slice(10):"Clinical flashcards";
  view().innerHTML='<div class="flash-play-shell"><div class="flash-play-header"><div><div class="overline">GEMP1 ACTIVE RECALL · '+esc(s.mode.toUpperCase())+'</div>'+
    '<h1>'+esc(title)+'</h1><p>'+esc(tags(c.name).map(t=>t.paper+' / '+t.subject).join(' · '))+' · '+esc(c.skill)+' · '+esc(c.name)+'</p></div><a class="btn btn-sm" href="#flashcards">Save & exit ↗</a></div>'+
    '<div class="flash-play-meter"><span>Card <b>'+(s.position+1)+'</b> / '+s.queue.length+'</span><span>Again '+s.ratings.Again+' · Hard '+s.ratings.Hard+' · Good '+s.ratings.Good+' · Easy '+s.ratings.Easy+'</span></div>'+
    '<div class="flash-track"><span style="width:'+progress+'%"></span></div>'+
    '<div class="flash-card-wrap"><button type="button" class="flash-card-surface '+(s.revealed?"answer":"question")+'" data-action="flash-flip" aria-label="'+(s.revealed?"Answer shown. Tap to see question":"Question shown. Tap to reveal answer")+'">'+
    (s.revealed
      ?'<span class="flash-face-overline">EXPECTED ANSWER</span><span class="flash-answer">'+esc(c.back)+'</span><span class="flash-card-hint">Answer revealed · Tap to view question</span>'
      :'<span class="flash-face-overline">QUESTION · '+esc(c.skill)+'</span><span class="flash-prompt">'+esc(c.front)+'</span><span class="flash-card-hint">Recall first · Tap to reveal answer</span>')+
    '</button></div>'+
    '<div class="flash-rating-area">'+(s.revealed?'<p class="flash-rating-title">How well did you recall it before flipping?</p>'+ratingsMarkup():'<div class="flash-reveal"><button class="btn btn-primary" data-action="flash-flip">Reveal answer · Space ↗</button></div>')+'</div>'+
    '<div class="flash-play-footer"><span class="tiny-note">Space = flip · 1–4 = rate · Esc = exit</span><span class="tiny-note">Scores are based on your own recall ratings, not marks.</span></div></div>';
 }
 function complete(){
  const s=selected();if(!s){goto("#flashcards");return}
  const names=["Again","Hard","Good","Easy"],total=names.reduce((x,n)=>x+(s.ratings[n]||0),0);
  view().innerHTML='<section class="flash-complete"><div class="symbol">✦</div><div class="overline">FLASHCARD SESSION COMPLETE</div>'+
   '<h1>Strong recall is built by returning.</h1><p>You reviewed '+s.initialCount+' cards and made '+total+' recall ratings, including any repeated Again cards. The next review dates are saved to your progress.</p>'+
   '<div class="flash-result-grid">'+names.map(n=>'<div><b>'+s.ratings[n]+'</b><small>'+n+'</small></div>').join("")+'</div>'+
   '<div class="page-actions" style="justify-content:center"><button class="btn btn-primary" data-action="flash-start" data-scope="'+esc(s.scope)+'" data-mode="Due">Review what is due →</button>'+
   '<a href="#flashcards" class="btn">All flashcards</a></div><p class="flash-next">Prioritise due and missed cards tomorrow. Use the corresponding disease note for any concept you could not recall.</p></section>';
 }
 function handleAction(action,el){
  if(action==="flash-start"){start(el.dataset.scope||scope,el.dataset.mode||mode,el.dataset.limit||batch);return true}
  if(action==="flash-flip"){flip();return true}
  if(action==="flash-rate"){rate(el.dataset.rating);return true}
  return false;
 }
 function handleChange(el){
  if(el.id==="flash-scope"){scope=el.value;refreshDecks();return true}
  if(el.id==="flash-mode"){mode=el.value;return true}
  if(el.id==="flash-limit"){batch=Number(el.value)||20;return true}
  return false;
 }
 function handleInput(el){
  if(el.id==="flash-search"){search=el.value;refreshDecks();return true}
  return false;
 }
 function handleKey(e){
  if(location.hash!=="#study"||!selected())return false;
  if(e.target?.closest?.("input,textarea,select,[contenteditable=true]"))return false;
  if(e.key===" "){e.preventDefault();flip();return true}
  if(selected().revealed&&["1","2","3","4"].includes(e.key)){e.preventDefault();rate(["Again","Hard","Good","Easy"][Number(e.key)-1]);return true}
  if(e.key==="Escape"){goto("#flashcards");return true}
  return false;
 }
 return {cards:all,statsFor,stats:()=>stats(all),start,overview,study,handleAction,handleChange,handleInput,handleKey};
};