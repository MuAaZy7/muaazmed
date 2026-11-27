/* Shared content deduplication for mixed hard practice. Original source banks remain intact. */
(function(){
const norm=s=>String(s||"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const tokens=s=>new Set(norm(s).split(" ").filter(Boolean));
const sim=(a,b)=>{let n=0;for(const t of a)if(b.has(t))n++;return n/Math.max(1,a.size+b.size-n);};
const answer=q=>norm(q.options?.length===4?q.options["ABCD".indexOf(q.answer)]:q.answer);
const priority=c=>Number(!!c.kakamed)*8+Number(!!c.masterHard)*4+Number(!!c.extreme)*2+Number(!!c.expansion);
const context=q=>norm(q.context||"");
const numeric=s=>(String(s||"").match(/\d+(?:[.,]\d+)?/g)||[]).join("|");
window.MED_UNIQUE_HARD=function(entries){
 const ranked=entries.map((e,i)=>({e,i})).sort((a,b)=>priority(b.e.c)-priority(a.e.c)||a.i-b.i);
 const seenIds=new Set(),stems=new Map(),questions=new Map(),byAnswer=new Map(),kept=[];
 for(const {e,i} of ranked){
  const c=e.c,id=String(c.id),stem=norm(c.scenario),data=norm(c.labContext),stemKey=stem+"|"+data;
  if(seenIds.has(id))continue;seenIds.add(id);
  const qs=c.questions||[],prior=stems.get(stemKey);
  const signature=q=>norm(q.q)+"|"+answer(q)+"|"+context(q);
  if(stem&&prior&&qs.length&&qs.filter(q=>prior.has(signature(q))).length/qs.length>=0.75)continue;
  const fresh=[];
  for(const q of qs){
   const prompt=norm(q.q),a=answer(q),ctx=context(q),t=tokens(prompt);
   if(!prompt||!a){fresh.push(q);continue;}
   // Case-dependent generic prompts are only duplicates when their scenario also matches.
   const generic=t.size<7||/^(what|which) (is|would be) the (most likely|best|next|correct|appropriate)/.test(prompt);
   const contextual=!!(ctx||q.isData||/\b(calculate|results|values|shown|above|this patient|this case)\b/.test(prompt));
   const scope=generic||contextual?stemKey+"|"+ctx:"";
   const key=prompt+"|"+a+"|"+scope;
   const bucketKey=a+"|"+scope;
   const bucket=byAnswer.get(bucketKey)||[];
   if(questions.has(key)||(!generic&&!contextual&&t.size>=8&&bucket.some(x=>numeric(q.q)===x.n&&sim(t,x.t)>=0.88)))continue;
   questions.set(key,true);bucket.push({t,n:numeric(q.q)});byAnswer.set(bucketKey,bucket);fresh.push(q);
  }
  if(!fresh.length)continue;
  if(stem){const set=prior||new Set();qs.forEach(q=>set.add(signature(q)));stems.set(stemKey,set);}
  kept.push({i,e:{...e,c:{...c,questions:fresh}}});
 }
 return kept.sort((a,b)=>a.i-b.i).map(x=>x.e);
};
})();