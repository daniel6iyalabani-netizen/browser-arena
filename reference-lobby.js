/* Working controls layered over the reference lobby artwork. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const root = $('match-setup-overlay');
  if (!root) return;

  const prefKey = 'browserArenaOperatorPrefsV1';
  const defaults = {gender:'male',uniform:'#477f72',hair:'#30241e',skin:'#b88d70',shoes:'#20292b',gun:'#52665f',armor:'0',mode:'1v1',difficulty:'medium',map:0,target:0};
  const readPrefs = () => {
    try { return {...defaults, ...(JSON.parse(localStorage.getItem(prefKey) || '{}'))}; }
    catch { return {...defaults}; }
  };
  let prefs = readPrefs();
  let activePage = 'online';
  let selectedMode = ['1v1','2v2','3v3','4v4','5v5'].includes(prefs.mode) ? prefs.mode : '1v1';
  let selectedDifficulty = ['easy','medium','hard'].includes(prefs.difficulty) ? prefs.difficulty : 'medium';
  let selectedMap = Math.max(0, Math.min(5, Number(prefs.map) || 0));
  let selectedGender = prefs.gender === 'female' ? 'female' : 'male';

  function selectValue(id, value, eventName = 'input') {
    const el = $(id);
    if (!el) return;
    el.value = String(value);
    el.dispatchEvent(new Event(eventName, {bubbles:true}));
  }
  function savePrefs() {
    prefs = {
      ...prefs, gender:selectedGender, mode:selectedMode, difficulty:selectedDifficulty, map:selectedMap,
      uniform:$('setup-uniform').value, hair:$('setup-hair').value, skin:$('setup-skin').value,
      shoes:$('setup-shoes').value, gun:$('setup-gun').value, armor:$('setup-armor').value,
      target:$('bot-target')?.value || '0'
    };
    try { localStorage.setItem(prefKey, JSON.stringify(prefs)); } catch {}
    window.browserArenaGender = selectedGender;
    window.browserArenaSelectedMap = selectedMap;
  }
  function syncNativeSettings() {
    selectValue('match-mode', selectedMode, 'change');
    selectValue('difficulty', selectedDifficulty, 'change');
    const botTarget = $('setup-bot-target') ? $('setup-bot-target').value : (prefs.target || '0');
    selectValue('bot-target', botTarget, 'change');
    selectValue('uniform-color', $('setup-uniform').value);
    selectValue('hair-color', $('setup-hair').value);
    selectValue('skin-color', $('setup-skin').value);
    selectValue('shoe-color', $('setup-shoes').value);
    selectValue('gun-color', $('setup-gun').value);
    selectValue('armor-color', $('setup-armor').value, 'change');
    window.browserArenaGender = selectedGender;
    window.browserArenaSelectedMap = selectedMap;
    savePrefs();
  }
  function syncPanelsFromPrefs() {
    $('setup-uniform').value = prefs.uniform;
    $('setup-hair').value = prefs.hair;
    $('setup-skin').value = prefs.skin;
    $('setup-shoes').value = prefs.shoes;
    $('setup-gun').value = prefs.gun;
    $('setup-armor').value = String(prefs.armor);
    selectValue('uniform-color', prefs.uniform);
    selectValue('hair-color', prefs.hair);
    selectValue('skin-color', prefs.skin);
    selectValue('shoe-color', prefs.shoes);
    selectValue('gun-color', prefs.gun);
    selectValue('armor-color', prefs.armor, 'change');
    selectValue('match-mode', selectedMode, 'change');
    selectValue('difficulty', selectedDifficulty, 'change');
    if ($('bot-target')) $('bot-target').value = String(prefs.target || '0');
    if ($('setup-bot-target')) $('setup-bot-target').value = String(prefs.target || '0');
    selectedMap = Math.max(0,Math.min(5,Number(prefs.map)||0));
    selectedGender = prefs.gender === 'female' ? 'female' : 'male';
    window.browserArenaGender = selectedGender;
    window.browserArenaSelectedMap = selectedMap;
    document.querySelectorAll('[data-mode-choice]').forEach(b=>b.classList.toggle('selected',b.dataset.modeChoice===selectedMode));
    document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('selected',b.dataset.difficulty===selectedDifficulty));
    document.querySelectorAll('[data-map-choice]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.mapChoice)===selectedMap));
    document.querySelectorAll('[data-gender-choice]').forEach(b=>b.classList.toggle('selected',b.dataset.genderChoice===selectedGender));
    $('setup-career-level').textContent='OPERATOR LEVEL '+String($('profile-level')?.textContent || '01').padStart(2,'0');
  }
  function setPage(page) {
    activePage = page;
    root.querySelectorAll('[data-setup-tab]').forEach(b=>b.classList.toggle('active',b.dataset.setupTab===page));
    root.querySelectorAll('[data-setup-page]').forEach(s=>s.classList.toggle('hidden',s.dataset.setupPage!==page));
    const title = page === 'online' ? 'Choose your mission' : page === 'bots' ? 'Configure training' : 'Build your operator';
    const subtitle = page === 'online' ? 'Pick a team size and find real players.' : page === 'bots' ? 'Tune the difficulty, choose a battlefield, and earn XP.' : 'Choose your field identity and appearance.';
    $('setup-title').textContent=title;
    $('setup-subtitle').textContent=subtitle;
    syncPanelsFromPrefs();
  }
  function openSetup(page='online') {
    setPage(page);
    root.classList.remove('hidden');
    root.setAttribute('aria-hidden','false');
    const close=$('setup-close'); close?.focus({preventScroll:true});
  }
  function closeSetup() {
    root.classList.add('hidden');
    root.setAttribute('aria-hidden','true');
  }
  window.browserArenaOpenMatchSetup = openSetup;

  // Preferences are applied before the game module initializes so first-person
  // equipment and remote operator visuals start with the saved appearance.
  selectValue('uniform-color', prefs.uniform);
  selectValue('hair-color', prefs.hair);
  selectValue('skin-color', prefs.skin);
  selectValue('shoe-color', prefs.shoes);
  selectValue('gun-color', prefs.gun);
  selectValue('armor-color', prefs.armor, 'change');
  selectValue('match-mode', selectedMode, 'change');
  selectValue('difficulty', selectedDifficulty, 'change');
  window.browserArenaGender = selectedGender;
  window.browserArenaSelectedMap = selectedMap;

  root.querySelectorAll('[data-setup-tab]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.setupTab)));
  root.querySelectorAll('[data-mode-choice]').forEach(b=>b.addEventListener('click',()=>{
    selectedMode=b.dataset.modeChoice;
    root.querySelectorAll('[data-mode-choice]').forEach(x=>x.classList.toggle('selected',x===b));
    selectValue('match-mode',selectedMode,'change');
    savePrefs();
  }));
  root.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{
    selectedDifficulty=b.dataset.difficulty;
    root.querySelectorAll('[data-difficulty]').forEach(x=>x.classList.toggle('selected',x===b));
    selectValue('difficulty',selectedDifficulty,'change');
    savePrefs();
  }));
  root.querySelectorAll('[data-map-choice]').forEach(b=>b.addEventListener('click',()=>{
    selectedMap=Number(b.dataset.mapChoice);
    root.querySelectorAll('[data-map-choice]').forEach(x=>x.classList.toggle('selected',x===b));
    window.browserArenaSelectedMap=selectedMap;
    savePrefs();
  }));
  root.querySelectorAll('[data-gender-choice]').forEach(b=>b.addEventListener('click',()=>{
    selectedGender=b.dataset.genderChoice;
    window.browserArenaGender=selectedGender;
    root.querySelectorAll('[data-gender-choice]').forEach(x=>x.classList.toggle('selected',x===b));
    savePrefs();
  }));
  ['uniform','hair','skin','shoes','gun','armor'].forEach(key=>{
    const el=$('setup-'+key);
    el?.addEventListener('change',()=>{savePrefs();syncNativeSettings();});
  });
  $('setup-save-operator')?.addEventListener('click',()=>{syncNativeSettings();savePrefs();closeSetup();});
  $('setup-close')?.addEventListener('click',closeSetup);
  root.addEventListener('click',e=>{if(e.target===root)closeSetup();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.classList.contains('hidden'))closeSetup();});
  $('setup-start-online')?.addEventListener('click',()=>{
    syncNativeSettings();
    const button=$('setup-start-online');button.disabled=true;button.innerHTML='CONNECTING <span>…</span>';
    if(typeof window.browserArenaStartMatch==='function'){
      closeSetup();
      window.browserArenaStartMatch(true);
      button.disabled=false;button.innerHTML='FIND MATCH <span>↗</span>';
    } else {
      button.disabled=false;button.innerHTML='FIND MATCH <span>↗</span>';
      $('setup-subtitle').textContent='Game engine is still loading — please try again in a moment.';
    }
  });
  $('setup-start-bots')?.addEventListener('click',()=>{
    syncNativeSettings();
    if(typeof window.browserArenaStartMatch==='function'){
      closeSetup();
      window.browserArenaStartMatch(false);
    } else $('setup-subtitle').textContent='Game engine is still loading — please try again in a moment.';
  });

  function interceptButton(id,page='online') {
    $(id)?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openSetup(page);},true);
  }
  interceptButton('play-online','online');
  interceptButton('play-offline','bots');
  interceptButton('reference-custom-hitbox','online');
  interceptButton('reference-private-hitbox','online');
  document.querySelectorAll('[data-queue="online"]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openSetup('online');},true));
  document.querySelectorAll('[data-queue="training"]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openSetup('bots');},true));
  document.querySelectorAll('[data-lobby-tab="operators"],[data-lobby-tab="loadout"]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openSetup('operator');},true));
  document.querySelectorAll('[data-lobby-tab="play"]').forEach(b=>b.addEventListener('click',()=>closeSetup(),true));
  $('claim-reference-reward')?.addEventListener('click',e=>{e.currentTarget.textContent='CLAIMED';e.currentTarget.disabled=true;});
  syncPanelsFromPrefs();
})();
