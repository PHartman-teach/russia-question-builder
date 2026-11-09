/* Apply teacher-editable display text. Runs after app and accordion scripts. */
(() => {
  'use strict';
  const cfg = window.RUSSIA_CONTENT || {};
  const common = cfg.common || {};
  const page = location.pathname.split('/').pop() || 'index.html';
  const p = (cfg.pages || {})[page] || (cfg.pages || {})['index.html'] || {};
  const el = sel => document.querySelector(sel);
  const put = (sel,txt) => { const node=el(sel); if(node && typeof txt === 'string') node.textContent=txt; };
  put('title',p.title); put('header.head h1',p.title); put('header.head p',p.subtitle);
  const headers={ 'assemble-panel':p.section1, 'question-panel':p.section2, 'planning-panel':p.section3 };
  for(const [id,txt] of Object.entries(headers)){
    const summary=el('.accordion[data-panel="'+id+'"] > summary');
    if(summary && txt) summary.textContent=txt;
  }
  const assembly=el('#assemble-panel');
  if(assembly && common.questionInstructions){const block=document.createElement('p');block.className='teacher-custom-instructions';block.textContent=common.questionInstructions;assembly.prepend(block)}
  const planning=el('#planning-panel');
  if(planning && common.planningInstructions){const block=document.createElement('p');block.className='teacher-custom-instructions';block.textContent=common.planningInstructions;planning.prepend(block)}
  if(common.validityCheck){const hint=el('#question-panel .hint');if(hint) hint.textContent=common.validityCheck}
  if(common.toolNotice){const foot=el('footer.foot');if(foot) foot.textContent=common.toolNotice}
  if(common.showNavigation===false){const nav=el('.site-nav');if(nav)nav.hidden=true}
  if(common.showHistoricalReference===false){const ref=el('.accordion[data-panel="reference-panel"]');if(ref)ref.hidden=true}
  if(common.showTechnicalNotes===false){
    document.querySelectorAll('.tech-note').forEach(node=>node.hidden=true);
  }
})();
