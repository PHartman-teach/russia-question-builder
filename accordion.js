/* Accessible collapsible sections — shared by all Russia pages. */
(() => {
  'use strict';
  const panels = [...document.querySelectorAll('main.wrap > section.panel')];
  const labels = { 'assemble-panel':'Build / change question','question-panel':'Generated question and past-paper comparison', 'planning-panel':'Sample essay plans', 'features-panel':'Syllabus Key Features', 'reference-panel':'Formula reference', 'teacher-panel':'Teacher review and ratings' };
  const bodyMode = document.body.dataset.mode;
  for (const panel of panels) {
    // Keep hidden reference nodes for application compatibility, without visible tabs.
    if(panel.hidden) continue;
    // Don't render sections hidden in this page's mode.
    if (bodyMode === 'question' && panel.id === 'planning-panel') continue;
    if (bodyMode === 'planning' && panel.id === 'reference-panel') continue;
    const heading = panel.querySelector(':scope > h2');
    const details = document.createElement('details');
    details.className='accordion';
    const summary=document.createElement('summary');
    summary.className='accordion-title';
    summary.textContent=labels[panel.id] || heading?.textContent || 'Section';
    if(heading) heading.remove();
    panel.parentNode.insertBefore(details,panel);
    details.append(summary,panel);
    details.dataset.panel=panel.id;
    // All sections begin closed. Students expand only the sections they need.
    details.open=false;
  }
  const openPanel=(id) => {const d=document.querySelector('.accordion[data-panel="'+id+'"]');if(d) d.open=true;};
  ['lucky','random'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>openPanel('question-panel')));
  // No section opens on initial load, including on the dedicated planner.
  document.getElementById('copyPlans')?.addEventListener('click',()=>openPanel('planning-panel'));
  const teacherToggle=document.querySelector('#teacher-panel > button');
  teacherToggle?.addEventListener('click',()=>openPanel('teacher-panel'));
  // If the Planning Machine receives a selected question from a Question Machine, reveal it.
  // A transferred question is populated, but its accordion stays closed initially.
})();
