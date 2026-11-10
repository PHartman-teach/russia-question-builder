/* Russia 2017 HSC Question Machine — v7.4 interface and question-quality improvements.
   No AI calls or live searches; uses local question and evidence banks. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const b = document.body;
 const planningOnly = location.pathname.split('/').pop()==='planning.html';
 const topText=$('top-question-text'), topMeta=$('top-question-source'), top=$('top-question');
 let sourceMode='generated', officialChoice=null, recent=[];
 const queryState={};
 const questionTypeMap={any:[],assess:['F2','F3'],evaluate:['F5'],extent:['F1','F7'],why:['F6'],successful:['F4'],how:['F8']};
 const directiveNames={any:'Any question type',assess:'Assess',evaluate:'Evaluate',extent:'To what extent',why:'Why / Account for',successful:'How successful',how:'How did / transformation'};
 const directiveForFormula={F1:'extent',F2:'assess',F3:'assess',F4:'successful',F5:'evaluate',F6:'why',F7:'extent',F8:'how'};
 const normText=s=>String(s||'').toLowerCase().replace(/[‘’]/g,"'").replace(/[‐‑–—−]/g,'-').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const select=(id,options)=>{const el=$(id);if(!el)return;el.replaceChildren();options.forEach(([v,s])=>{const o=document.createElement('option');o.value=String(v);o.textContent=s;el.append(o)});};
 function showQuestion(){
   const inResult=$('result')?.textContent||'';
   topText.textContent=inResult || 'Choose a question to begin.';
   const filtered=inResult.includes('excluded by the selected filter');
   if(filtered){topMeta.textContent='This question is excluded by your teacher’s filter';}
   else if(sourceMode==='practice'){topMeta.textContent='Additional practice question · Not an official NESA examination question';}
   else if(sourceMode==='official'&&officialChoice){topMeta.textContent=`Official ${officialChoice.year} NESA HSC examination question · ${officialChoice.year>=2019?'2017 syllabus':'earlier syllabus'}`;}
   else topMeta.textContent='Newly generated practice question · NSW Modern History (2017 syllabus)';
   top.dataset.status=sourceMode==='official'?'official':'generated';
   if($('planTop'))$('planTop').disabled=sourceMode!=='generated'||filtered;
   if($('planThis'))$('planThis').disabled=sourceMode!=='generated'||filtered;
 }
 function generated(){sourceMode='generated';officialChoice=null;showQuestion();}
 function remember(){const s=$('result')?.textContent;if(s){recent.push(normText(s));recent=recent.slice(-12);}}
 function validate(text){
  if(!text || text.length<38 || text.length>260 || !/[?.]$/.test(text))return false;
  const t=normText(text);
  if(/\bits\b/.test(t)&&/\b(?:stalin|lenin|trotsky)\b/.test(t))return false;
  if(/(?:during the leadership struggle|following lenin s death).*?(?:during the leadership struggle|following lenin s death)/.test(t))return false;
  if(/(?:during bols(h)?evik consolidation).*?(?:during bols(h)?evik consolidation)/.test(t))return false;
  const words=t.split(' ');
  for(let n=4;n<=8;n++){
   const seen=new Set();for(let i=0;i+n<=words.length;i++){const chunk=words.slice(i,i+n).join(' ');if(seen.has(chunk))return false;seen.add(chunk)}
  }
  return true;
 }
 function simplifyPeriod(){
  const factor=$('factor')?.selectedOptions[0]?.textContent?.toLowerCase()||'';
  const outcome=$('outcome')?.selectedOptions[0]?.textContent?.toLowerCase()||'';
  const period=$('period')?.selectedOptions[0]?.textContent?.toLowerCase()||'';
  // Avoid repeating a complete event twice when F6 is used.
  if((period==='following lenin’s death'&&factor.includes('following lenin’s death')) || (period==='during the leadership struggle'&&(factor.includes('leadership struggle')||outcome.includes('leadership struggle')))){
   const other=[...$('period').options].find(o=>/\d{4}|by 19/.test(o.textContent));if(other)$('period').value=other.value;
  }
 }
 function improveGrammar(){
  // Original F4 generator treated Stalin/Lenin like institutions ('its aim').
  // Replace the phrase, never applying a pronoun to an individual.
  if(formula()!=='F4')return;
  const raw=$('result').textContent;
  const fixed=raw.replace(/ in achieving (?:its|their) aim of /,' in achieving ')
   .replace(/^How successful was (Stalin|Lenin|Trotsky) in achieving /,'How successful was $1 in achieving ');
  if(raw!==fixed){currentQuestion=fixed;$('result').textContent=fixed;}
 }
 function fireUpdated(){showPastMatches();renderPlans();window.dispatchEvent(new CustomEvent('russia-question-change',{detail:{question:currentQuestion}}));}
 function drawGenerated(){
  simplifyPeriod();render();improveGrammar();fireUpdated();generated();remember();
 }
 function constrainedGenerate(style){
  if(planningOnly)return;
  const previous=$('result').textContent;
  const past=new Set(recent);
  for(let n=0;n<45;n++){
   if(style==='lucky')feelingLucky();
   else if(style==='similar'){
    const s=slots[formula()];const a=s[0]&&$('factor').options.length>1;const d=s[1]&&$('outcome').options.length>1;
    if(a&&(!d||Math.random()<.6))$('factor').value=String(rnd($('factor').options.length));
    else if(d)$('outcome').value=String(rnd($('outcome').options.length));
    else if(a)$('factor').value=String(rnd($('factor').options.length));
    syncPeriodToSelections();render();
   }
   else render();
   simplifyPeriod();render();improveGrammar();fireUpdated();
   const text=$('result').textContent;
   if(validate(text)&&!past.has(normText(text))&&(style==='selected'||text!==previous))break;
   if(style==='selected'){
    // Respect the student's exact choices, but tidy obvious chronological duplication.
    break;
   }
  }
  generated();remember();
 }
 if(!planningOnly){
  select('directive',Object.entries(directiveNames));$('directive').value='any';
  $('directive').addEventListener('change',()=>{
   const type=$('directive').value, allowed=questionTypeMap[type];
   if(allowed.length){$('formula').value=String(formulas.findIndex(f=>f[0]===allowed[rnd(allowed.length)]));refreshSlots(true);}
  });
  $('formula').addEventListener('change',()=>{$('directive').value=directiveForFormula[formula()]||'any'});
  $('generateTop')?.addEventListener('click',()=>constrainedGenerate('selected'));
  $('anotherTop')?.addEventListener('click',()=>constrainedGenerate('similar'));
  $('luckyTop')?.addEventListener('click',()=>constrainedGenerate('lucky'));
 }
 // Track changes to original result, including security filtering by ratings.js.
 const original=$('result');if(original){new MutationObserver(showQuestion).observe(original,{childList:true,characterData:true,subtree:true});}
 window.addEventListener('russia-question-change',()=>{if(sourceMode!=='official')showQuestion();});
 // The original page's Feeling lucky? is still useful from the expanded options accordion.
 $('lucky')?.addEventListener('click',()=>{generated();remember()});
 $('random')?.addEventListener('click',()=>{generated();remember()});
 $('copyTop')?.addEventListener('click',()=>{
  const text=original?.textContent||'';
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).catch(()=>window.prompt('Copy question:',text));
  else window.prompt('Copy question:',text);
 });
 $('planTop')?.addEventListener('click',()=>{if(sourceMode==='generated')$('planThis')?.click();});
 const sourceFilter=$('historySource');
 const officialBank=typeof pastQuestions!=='undefined'?pastQuestions:[];
 const additions=Array.isArray(window.RUSSIA_EXTRA_QUESTIONS)?window.RUSSIA_EXTRA_QUESTIONS:[];
 const categories=areas.map(a=>a.name);
 function historicalArea(q){const t=normText(q);if(/foreign policy|diplom|league of nations|comintern|nazi soviet|germany|international|collective security/.test(t))return 4;
  if(/terror|purge|totalitarian|political control|stalinism|show trial|political transformation|totalitarian/.test(t))return 3;
  if(/collectiv|industrial|cultural|economic|society|social change|women|stalin s policies/.test(t))return 2;
  if(/power struggle|leadership|succession|trotsky|stalin.{0,15}rise|stalin.{0,10}emerge|competing visions/.test(t))return 1;
  return 0;}
 function questionDirective(q){const t=q.toLowerCase().trim();if(t.startsWith('assess'))return 'assess';if(t.startsWith('evaluate')||t.includes('evaluate the accuracy'))return 'evaluate';if(t.startsWith('to what extent'))return 'extent';if(t.startsWith('why')||t.startsWith('account for'))return 'why';if(t.startsWith('how successful'))return 'successful';if(t.startsWith('how did')||t.startsWith('how significant'))return 'how';return 'other';}
 function keyAreaMatch(feature,area){return feature<0||(featureAreas[feature]||[]).includes(area);}
 if(!planningOnly){
  select('historyArea',[['all','All syllabus areas'],...categories.map((c,i)=>[String(i),c])]);
  select('historyFeature',[['all','All Key Features'],...keyFeatures.map((k,i)=>[String(i),k])]);
  select('historyDirective',[['all','All question types'],...Object.entries(directiveNames).filter(([k])=>k!=='any').map(([k,v])=>[k,v])]);
  select('historySource',[['official','Official NESA HSC questions'],['practice','Additional practice questions'],['all','All collections']]);
  function matchesFilters(item){const area=historicalArea(item.text),df=questionDirective(item.text);
   return ($('historyArea').value==='all'||area===Number($('historyArea').value))
    &&($('historyFeature').value==='all'||keyAreaMatch(Number($('historyFeature').value),area))
    &&($('historyDirective').value==='all'||df===$('historyDirective').value)
    &&($('historySource').value==='all'||item.kind===$('historySource').value);}
  const bank=[...officialBank.map(q=>({...q,kind:'official'})),...additions.map(q=>({...q,kind:'practice',year:q.year||null}))];
  function showOfficial(entry){
   sourceMode='official';officialChoice=entry;
   currentQuestion=entry.text;$('result').textContent=entry.text;
   const box=$('pastmatch');box.replaceChildren();const p=document.createElement('p');p.textContent=`Original ${entry.year} NESA HSC examination question. ${entry.year>=2019?'2017 syllabus':'Earlier syllabus'}.`;box.append(p);
   if($('plans'))$('plans').style.display='none';
   window.dispatchEvent(new CustomEvent('russia-question-change',{detail:{question:entry.text}}));
   showQuestion();
   const msg=document.createElement('button');msg.type='button';msg.textContent='Generate a practice variation of this question';msg.id='variationButton';msg.addEventListener('click',()=>variation(entry));box.append(msg);
  }
  function variation(entry){
   const area=historicalArea(entry.text);$('keyFeature').value='-1';syncSecondary();updateTopicChoices(true);$('topic').value=String(area);
   const directive=questionDirective(entry.text);const allowed=questionTypeMap[directive]||[];
   if(allowed.length)$('formula').value=String(formulas.findIndex(f=>f[0]===allowed[0]));
   else $('formula').value=String(rnd(formulas.length));
   $('directive').value=directiveForFormula[formula()]||'any';refreshSlots(true);
   constrainedGenerate('similar');
   if(normText($('result').textContent)===normText(entry.text))constrainedGenerate('similar');
  }
  function renderLibrary(){
   const results=$('historyResults');results.replaceChildren();const entries=bank.filter(matchesFilters).sort((a,b)=>(b.year||0)-(a.year||0));
   if(!entries.length){const p=document.createElement('p');p.className='smallnote';p.textContent=$('historySource').value==='practice'?'No additional practice questions are included yet. Add verified examples to extra-questions.js.':'No questions match the selected filters.';results.append(p);return;}
   for(const e of entries){const card=document.createElement('article');card.className='history-item';const tag=document.createElement('div');tag.className='source';tag.textContent=e.kind==='official'?`OFFICIAL HSC · ${e.year} · ${e.year>=2019?'2017 syllabus':'earlier syllabus'}`:`ADDITIONAL PRACTICE · ${e.source||'source unspecified'}${e.year?' · '+e.year:''}`;
    const q=document.createElement('p');q.textContent=e.text;const act=document.createElement('button');act.type='button';act.textContent=e.kind==='official'?'Use this past HSC question':'Use this practice question';act.addEventListener('click',()=>{if(e.kind==='official')showOfficial(e);else{sourceMode='practice';officialChoice=null;currentQuestion=e.text;$('result').textContent=e.text;window.dispatchEvent(new CustomEvent('russia-question-change',{detail:{question:e.text}}));showQuestion();} });card.append(tag,q,act);results.append(card);
   }
  }
  ['historyArea','historyFeature','historyDirective','historySource'].forEach(id=>$(id).addEventListener('change',renderLibrary));
  renderLibrary();
  $('pastTop')?.addEventListener('click',()=>{
   // Use the currently selected syllabus area and directive where possible.
   const selectedArea=Number($('topic').value),selectedDirective=$('directive').value;
   const scoped=officialBank.filter(e=>historicalArea(e.text)===selectedArea&&(selectedDirective==='any'||questionDirective(e.text)===selectedDirective));
   const pool=scoped.length?scoped:officialBank;
   showOfficial(pool[rnd(pool.length)]);
   // Show original and offer variation; the accordion starts closed but can be opened here.
   const summary=document.querySelector('.accordion[data-panel="question-panel"]');if(summary)summary.open=true;
  });
 }
 // Theme editor previews current browser session only. No credentials/secrets stored.
 function applyTheme(){const s=document.documentElement.style;const brand=$('editBrand').value,accent=$('editAccent').value,bg=$('editBackground').value,size=$('editFont').value+'px';
  for(const name of ['--brand','--blue'])s.setProperty(name,brand);
  for(const name of ['--accent','--accent-colour'])s.setProperty(name,accent);
  s.setProperty('--page-background',bg);s.setProperty('--base-font',size);document.body.style.fontSize=size;}
 $('applyTheme')?.addEventListener('click',applyTheme);
 $('resetTheme')?.addEventListener('click',()=>{['--brand','--blue','--accent','--accent-colour','--page-background','--base-font'].forEach(x=>document.documentElement.style.removeProperty(x));document.body.style.removeProperty('font-size');$('editBrand').value='#8b1e24';$('editAccent').value='#bd8c54';$('editBackground').value='#f8f3ef';$('editFont').value='16';});
 $('copyTheme')?.addEventListener('click',()=>{const text=`/* Paste at the END of theme.css to apply your preferred appearance */\n:root {--brand:${$('editBrand').value};--blue:${$('editBrand').value};--accent:${$('editAccent').value};--accent-colour:${$('editAccent').value};--page-background:${$('editBackground').value};--base-font:${$('editFont').value}px;}\nbody{font-size:var(--base-font);}`;
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>window.alert('CSS copied. Paste it at the end of theme.css on GitHub.')).catch(()=>window.prompt('Copy CSS:',text));else window.prompt('Copy CSS:',text);
 });
 // Correct hidden legacy button controls and initial state.
 showQuestion();
 // Ensure teacher accordion is always the last one on the page.
 const teacher=document.querySelector('.accordion[data-panel="teacher-panel"]');const footer=document.querySelector('footer.foot');if(teacher&&footer)footer.before(teacher);
})();
