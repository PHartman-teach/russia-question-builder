/* Russia HSC Teacher Reviews — independent client, security enforced in Supabase RLS. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const config = window.RUSSIA_SUPABASE || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url||'') && /^sb_publishable_|^eyJ/.test(config.publishableKey||'');
  const client = configured && window.supabase ? window.supabase.createClient(config.url,config.publishableKey) : null;
  const cache = new Map();
  let user = null, allowed = false, editingKey = '', editingText = '', manualReview = false;
  let latestQuestion = ($('result')?.textContent||'').trim();
  let autoTry = false, attempts=0, busy=false, loaded=false;
  const normalize = s => s.normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
  const keyOf = text => normalize(text);
  const make = (tag, cls, text) => {const el=document.createElement(tag); if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const select = (id,opts) => {const e=make('select');e.id=id; for(const [value,label] of opts){const o=make('option','',label);o.value=value;e.append(o)}return e;};
  const field=(label,control)=>{const w=make('div','field');const l=make('label','',label);l.htmlFor=control.id;w.append(l,control);return w;};
  const qpanel=$('question-panel'); if(!qpanel)return;
  const statusBox=make('div','rating-status');statusBox.id='rating-status';
  const filter=select('rating-filter',[['all','All available questions'],['approved','Teacher-approved only'],['reviewed','Approved and practice questions']]);
  const filterInfo=make('p','smallnote','Unrated questions appear in “All available”. Rejected questions are hidden from students.');
  const filterRow=make('div','rating-filter-row');filterRow.append(field('Question filter',filter),filterInfo);
  qpanel.insertBefore(filterRow,$('result')); qpanel.insertBefore(statusBox,$('pastmatch'));

  const tpanel=make('section','panel rating-teacher-panel');tpanel.id='teacher-panel';
  const h=make('h2','', 'Teacher review and question ratings');
  const toggle=make('button','secondary','Teacher sign-in / reviews');toggle.type='button';
  const body=make('div','teacher-body');body.hidden=true;
  tpanel.append(h,toggle,body);qpanel.insertAdjacentElement('afterend',tpanel);
  toggle.addEventListener('click',()=>{body.hidden=!body.hidden;if(!body.hidden)renderTeacher()});
  const message=make('p','smallnote');
  function note(s,kind=''){message.textContent=s;message.className='smallnote '+kind;}
  const mode=(status)=>{const x=make('span','rating-pill',status);return x;};
  const qualityLabels={excellent:'Excellent',good:'Good',weak:'Weak',reject:'Reject'};
  const scopeLabels={appropriate:'Appropriate for a 25-mark essay',too_broad:'Too broad',too_narrow:'Too narrow',historically_inappropriate:'Historically inappropriate'};
  const visibilityLabels={approved:'Teacher approved',practice:'Practice question',challenge:'Challenge question',hidden:'Rejected / hidden'};
  let savedReviews=[];
  function activeReview(){return savedReviews.find(x=>x.question_key===editingKey)}
  function useCurrent(){manualReview=false;editingText=latestQuestion;editingKey=keyOf(latestQuestion);renderTeacher()}
  function renderTeacher(){
    body.replaceChildren();
    if(!client){body.append(make('p','rating-error','Teacher ratings are not yet connected. Set up Supabase and edit config.js as described in SETUP.md.'));return;}
    if(!allowed){
      if(user){body.append(make('p','rating-error','This signed-in account is not authorised to review questions. Add its user ID to the teacher allowlist in Supabase.'));const out=make('button','secondary','Sign out');out.onclick=signOut;body.append(out);return;}
      const frm=make('form','login-form');const email=make('input');email.id='rating-email';email.type='email';email.autocomplete='username';email.required=true;
      const password=make('input');password.id='rating-password';password.type='password';password.autocomplete='current-password';password.required=true;
      const submit=make('button','','Sign in securely');submit.type='submit';
      frm.append(field('Teacher email',email),field('Password',password),submit);frm.onsubmit=async(e)=>{e.preventDefault();submit.disabled=true;note('Signing in…');const {error}=await client.auth.signInWithPassword({email:email.value,password:password.value});password.value='';if(error)note(error.message,'rating-error');else await refreshAuth();submit.disabled=false;};
      body.append(make('p','smallnote','Students do not need accounts. Only allowlisted teacher accounts can edit ratings.'),frm,message);return;
    }
    const bar=make('div','actions');const switchCurrent=make('button','secondary','Rate the current question');switchCurrent.onclick=useCurrent;
    const refresh=make('button','secondary','Refresh reviews');refresh.onclick=loadReviews;
    const logout=make('button','secondary','Sign out');logout.onclick=signOut;
    bar.append(switchCurrent,refresh,logout);body.append(bar);
    body.append(make('h3','','Question being reviewed'));
    const qText=make('p','review-question',editingText||latestQuestion);body.append(qText);
    const old=activeReview();
    const quality=select('review-quality',Object.entries(qualityLabels));quality.value=old?.quality||'good';
    const likelihood=select('review-likelihood',[['unsure','Not assessed'],['likely','Likely / plausible HSC-style'],['plausible','Plausible'],['unlikely','Unlikely']]);likelihood.value=old?.likelihood||'unsure';
    const scope=select('review-scope',Object.entries(scopeLabels));scope.value=old?.scope||'appropriate';
    const visibility=select('review-visibility',Object.entries(visibilityLabels));visibility.value=old?.visibility||'practice';
    quality.addEventListener('change',()=>{if(quality.value==='reject')visibility.value='hidden'});
    const notes=make('textarea');notes.id='review-notes';notes.rows=3;notes.maxLength=5000;notes.value=old?.teacher_note||'';
    const form=make('div','cols review-fields');form.append(field('Question quality',quality),field('Exam plausibility (teacher only)',likelihood),field('Essay scope',scope),field('Student visibility',visibility),field('Private teacher notes',notes));
    body.append(form);
    const actions=make('div','actions');const save=make('button','','Save rating');const del=make('button','secondary','Delete rating');del.disabled=!old;
    save.onclick=async()=>{
      if(!editingText){note('No question selected.','rating-error');return;}
      if(quality.value==='reject')visibility.value='hidden';
      save.disabled=true;note('Saving to Supabase…');
      const record={question_key:editingKey,question_text:editingText,quality:quality.value,likelihood:likelihood.value,scope:scope.value,visibility:visibility.value,teacher_note:notes.value,reviewed_by:user.id};
      const {error}=await client.from('russia_question_reviews').upsert(record,{onConflict:'question_key'});
      if(error){note('Could not save: '+error.message,'rating-error');save.disabled=false;return;}
      note('Saved centrally. Student filtering will use the published status.','rating-success');await loadReviews(false);await loadStatuses(false);save.disabled=false;
    };
    del.onclick=async()=>{if(!confirm('Delete this rating? The question will become unrated and available again.'))return;const {error}=await client.from('russia_question_reviews').delete().eq('question_key',editingKey);if(error){note('Delete failed: '+error.message,'rating-error');return;}await loadReviews(false);await loadStatuses(false);note('Rating deleted.');};
    actions.append(save,del);body.append(actions,message);
    body.append(make('h3','','Reviewed question library'));
    const search=make('input');search.type='search';search.placeholder='Search reviewed questions or notes…';search.className='rating-search';body.append(search);
    const lib=make('div','review-library');body.append(lib);
    const draw=()=>{lib.replaceChildren();const term=search.value.toLowerCase();for(const r of savedReviews.filter(r=>(r.question_text+' '+r.teacher_note).toLowerCase().includes(term))){const item=make('button','review-item');item.type='button';const heading=make('strong','',r.question_text);const subt=make('span','smallnote',`${visibilityLabels[r.visibility]} · ${qualityLabels[r.quality]} · ${scopeLabels[r.scope]}`);item.append(heading,subt);item.onclick=()=>{manualReview=true;editingKey=r.question_key;editingText=r.question_text;renderTeacher();tpanel.scrollIntoView({behavior:'smooth',block:'start'});};lib.append(item);} if(!lib.children.length)lib.append(make('p','smallnote','No reviewed questions match.'));};
    search.addEventListener('input',draw);draw();
  }
  function studentCanSee(text){const vis=cache.get(keyOf(text));if(vis==='hidden')return false;if(filter.value==='approved')return vis==='approved';if(filter.value==='reviewed')return vis==='approved'||vis==='practice';return true;}
  function applyStatus(){
    if(!latestQuestion)return;
    const vis=cache.get(keyOf(latestQuestion));const accept=allowed || !loaded || studentCanSee(latestQuestion);
    statusBox.replaceChildren();
    if(!client)statusBox.append(make('p','smallnote','This copy is not connected to the ratings database; student filtering is not active.'));
    else if(!loaded)statusBox.append(make('p','smallnote','Ratings unavailable; filtering is temporarily inactive.'));
    else if(!accept)statusBox.append(make('p','rating-error','This question is excluded by the selected filter. Choose another combination or press Feeling lucky?.'));
    else statusBox.append(mode(vis?visibilityLabels[vis]:'Unrated practice question'));
    ['copyQ','planThis','copyPlans','printPlans','print'].forEach(id=>{if($(id))$(id).disabled=!accept});
    const result=$('result');if(result)result.textContent=accept?latestQuestion:'Question excluded by the selected filter. Choose another question.';
    const plans=$('plans');if(plans)plans.style.display=accept?'':'none';
    const past=$('pastmatch');if(past)past.style.display=accept?'':'none';
    if(!accept && autoTry && attempts<40){attempts++;queueMicrotask(()=>{if(!busy){busy=true;$('lucky')?.click();busy=false;}});}
    else if(accept || attempts>=40){autoTry=false;attempts=0;}
  }
  window.addEventListener('russia-question-change',e=>{latestQuestion=e.detail.question;if(!manualReview){editingKey=keyOf(latestQuestion);editingText=latestQuestion;}applyStatus();});
  filter.addEventListener('change',()=>{autoTry=false;applyStatus()});
  ['lucky','random'].forEach(id=>$(id)?.addEventListener('click',()=>{autoTry=true;attempts=0;},{capture:true}));
  async function loadStatuses(show=true){if(!client)return;const {data,error}=await client.from('russia_question_statuses').select('question_key,visibility').limit(10000);if(error){loaded=false;if(show)statusBox.textContent='Ratings could not be loaded; filtering is temporarily inactive.';return;}cache.clear();for(const r of data)cache.set(r.question_key,r.visibility);loaded=true;applyStatus();}
  async function loadReviews(show=true){if(!client||!allowed)return;const {data,error}=await client.from('russia_question_reviews').select('*').order('updated_at',{ascending:false}).limit(10000);if(error){note('Could not load reviews: '+error.message,'rating-error');return;}savedReviews=data||[];if(show)renderTeacher();}
  async function refreshAuth(){if(!client)return;const {data}=await client.auth.getUser();user=data?.user||null;allowed=false;if(user){const {data:permitted,error}=await client.rpc('russia_is_teacher');allowed=!error&&permitted===true;}if(allowed){await loadReviews(false);}renderTeacher();applyStatus();}
  async function signOut(){await client.auth.signOut();user=null;allowed=false;savedReviews=[];renderTeacher();applyStatus();}
  // Initialise only after app.js builds its first question.
  editingKey=keyOf(latestQuestion);editingText=latestQuestion;
  if(client){loadStatuses();refreshAuth();client.auth.onAuthStateChange((_event,_session)=>{setTimeout(refreshAuth,0)});}
  else{loaded=false;}
  applyStatus();
})();
