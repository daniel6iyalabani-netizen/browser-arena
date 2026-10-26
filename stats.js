(() => {
  'use strict';
  const STORE = 'browserArenaStatsV1';
  const CAREER = 'browserArenaCareerV1';
  const $ = (id) => document.getElementById(id);
  const safeRead = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === 'object' ? value : fallback; } catch { return fallback; } };
  const fresh = () => ({ matches: [], totals: { matches: 0, wins: 0, losses: 0, draws: 0, eliminations: 0, bestRound: 0, seconds: 0 } });
  let data = { ...fresh(), ...safeRead(STORE, {}) };
  data.totals = { ...fresh().totals, ...(data.totals || {}) };
  data.matches = Array.isArray(data.matches) ? data.matches : [];
  let activeTab = 'overview';
  let lastResultStamp = '';
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch {} };
  const career = () => safeRead(CAREER, { xp: 0, matches: 0, minutes: 0, careerDays: 0 });
  const fmtTime = (seconds) => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  const rank = (xp) => ['ROOKIE','RECRUIT','CONTENDER','SPECIALIST','VANGUARD','ELITE','CHAMPION','LEGEND'][Math.min(7, Math.floor((Math.floor(xp / 100)) / 2))];
  const styles = document.createElement('style');
  styles.textContent = `
  #arena-stats-open,#arena-stats-hud{border:1px solid #80e9bd88;background:#102625;color:#a9f8d6;border-radius:8px;padding:10px 13px;font:800 10px/1.2 inherit;letter-spacing:.1em;cursor:pointer}
  #arena-stats-open{width:100%;margin-top:10px}
  #arena-stats-hud{position:absolute;right:24px;top:178px;pointer-events:auto}
  #arena-stats-overlay{position:fixed;inset:0;z-index:20;display:none;place-items:center;padding:18px;background:#03090cce;backdrop-filter:blur(12px);font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#edf8f4}
  #arena-stats-overlay.open{display:grid}
  .as-shell{width:min(860px,100%);max-height:min(88dvh,900px);overflow:auto;border:1px solid #80e9bd55;border-radius:18px;background:linear-gradient(145deg,#12272d,#071116 72%);box-shadow:0 28px 100px #000b}
  .as-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:24px 26px;border-bottom:1px solid #ffffff16}
  .as-kicker{font-size:9px;letter-spacing:.2em;color:#80e9bd;font-weight:900}.as-head h2{margin:7px 0 0;font-size:clamp(24px,5vw,36px);letter-spacing:-.05em}.as-head p{margin:7px 0 0;color:#9eb4b5;font-size:12px}
  .as-close{border:1px solid #ffffff2a;background:#ffffff0a;color:white;border-radius:8px;padding:8px 11px;cursor:pointer}
  .as-tabs{display:flex;gap:6px;padding:14px 24px 0;flex-wrap:wrap}.as-tab{border:1px solid #ffffff1c;border-radius:8px;padding:10px 13px;background:#ffffff08;color:#b7c9c8;font-size:10px;font-weight:800;letter-spacing:.08em;cursor:pointer}.as-tab.active{background:#80e9bd1b;border-color:#80e9bd;color:#a9f8d6}
  .as-content{padding:20px 24px 26px}.as-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.as-stat{border:1px solid #ffffff14;border-radius:11px;padding:15px;background:#ffffff06;min-width:0}.as-stat small{display:block;color:#92aaa9;font-size:9px;letter-spacing:.1em}.as-stat b{display:block;margin-top:9px;font-size:clamp(20px,3vw,28px);letter-spacing:-.04em;overflow-wrap:anywhere}.as-stat em{display:block;margin-top:5px;color:#80e9bd;font-style:normal;font-size:10px}
  .as-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:24px 0 10px;font-size:11px;letter-spacing:.12em}.as-section-title small{color:#8fa8a8;font-size:9px;letter-spacing:.06em;font-weight:500}
  .as-table-wrap{overflow:auto;border:1px solid #ffffff15;border-radius:10px}.as-table{width:100%;border-collapse:collapse;min-width:490px;font-size:11px}.as-table th{text-align:left;padding:12px;color:#8ea8a8;background:#ffffff06;font-size:9px;letter-spacing:.1em}.as-table td{padding:12px;border-top:1px solid #ffffff10}.as-table td:first-child{font-weight:900;color:#80e9bd}.as-table tr:first-child td{background:#80e9bd09}.as-muted{color:#91a9aa}.as-empty{padding:28px 15px;text-align:center;color:#9db3b2;border:1px dashed #ffffff24;border-radius:10px;font-size:12px;line-height:1.6}.as-badge{display:inline-block;border:1px solid #80e9bd44;background:#80e9bd12;color:#a9f8d6;border-radius:5px;padding:4px 6px;font-size:9px;font-weight:900}
  .as-note{margin-top:14px;color:#829a9b;font-size:10px;line-height:1.5}.as-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.as-actions button{border:1px solid #ffffff24;border-radius:7px;padding:9px 12px;background:#ffffff08;color:#d6e8e4;font-size:10px;cursor:pointer}
  @media(max-width:560px){#arena-stats-hud{top:auto;right:12px;bottom:120px;padding:8px;font-size:9px}.as-head{padding:19px}.as-tabs{padding:12px 14px 0}.as-content{padding:16px 14px 20px}.as-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.as-stat{padding:12px}.as-stat b{font-size:23px}}
  `;
  document.head.appendChild(styles);
  const overlay = document.createElement('div');
  overlay.id = 'arena-stats-overlay';
  overlay.innerHTML = '<section class="as-shell" role="dialog" aria-modal="true" aria-labelledby="as-title"><header class="as-head"><div><div class="as-kicker">BROWSER ARENA / PLAYER RECORD</div><h2 id="as-title">Career statistics</h2><p>Your record, your milestones, your next personal best.</p></div><button class="as-close" id="as-close" type="button" aria-label="Close statistics">✕</button></header><nav class="as-tabs" aria-label="Statistics sections"><button class="as-tab active" data-tab="overview">OVERVIEW</button><button class="as-tab" data-tab="leaderboard">LOCAL LEADERBOARD</button><button class="as-tab" data-tab="history">MATCH HISTORY</button></nav><div class="as-content" id="as-content"></div></section>';
  document.body.appendChild(overlay);
  const open = () => { render(); overlay.classList.add('open'); };
  const close = () => overlay.classList.remove('open');
  const name = () => (($('player-name')?.value || 'Rookie').trim().slice(0,18) || 'Rookie');
  const totals = () => data.totals;
  const sorted = () => [...data.matches].sort((a,b) => (b.eliminations||0)-(a.eliminations||0) || (b.wins||0)-(a.wins||0) || (b.xp||0)-(a.xp||0));
  function renderOverview() {
    const t=totals(), c=career(), winRate=t.matches?Math.round(t.wins/t.matches*100):0;
    return '<div class="as-grid">'+[
      ['MATCHES',t.matches,'CAREER GAMES'],
      ['WINS',t.wins,winRate+'% WIN RATE'],
      ['ELIMINATIONS',t.eliminations,'ALL RECORDED ROUNDS'],
      ['BEST ROUND',t.bestRound,'ELIMINATIONS']
    ].map(([label,value,foot])=>'<div class="as-stat"><small>'+label+'</small><b>'+Number(value||0).toLocaleString()+'</b><em>'+foot+'</em></div>').join('')+'</div>'+
    '<div class="as-section-title">CAREER PROGRESSION <small>Saved on this device</small></div>'+
    '<div class="as-grid">'+[
      ['LEVEL',Math.floor((c.xp||0)/100)+1,rank(c.xp||0)],
      ['TOTAL XP',Number(c.xp||0).toLocaleString(),'LIFETIME EXPERIENCE'],
      ['TIME PLAYED',Math.floor((c.minutes||0))+'m','TOTAL SESSION TIME'],
      ['CAREER DAYS',c.careerDays||0,'DAYS PLAYED']
    ].map(([label,value,foot])=>'<div class="as-stat"><small>'+label+'</small><b>'+value+'</b><em>'+foot+'</em></div>').join('')+'</div>'+
    '<div class="as-section-title">RECENT FORM <small>Last five recorded matches</small></div>'+historyTable(data.matches.slice(0,5))+
    '<p class="as-note">Stats and leaderboard entries are stored in this browser. They do not sync between devices or create a global online ranking. Online shared leaderboards need a server-side database.</p>'+
    '<div class="as-actions"><button id="as-export">EXPORT MATCH DATA</button><button id="as-reset">RESET STATS</button></div>';
  }
  function historyTable(matches) {
    if(!matches.length) return '<div class="as-empty">No completed matches recorded yet.<br><span class="as-muted">Finish an offline round to start building your record.</span></div>';
    return '<div class="as-table-wrap"><table class="as-table"><thead><tr><th>RESULT</th><th>CALLSIGN</th><th>ELIMS</th><th>XP</th><th>MODE</th></tr></thead><tbody>'+matches.map(m=>'<tr><td><span class="as-badge">'+escapeHTML(m.result||'PLAYED')+'</span></td><td>'+escapeHTML(m.name)+'</td><td>'+Number(m.eliminations||0)+'</td><td>+'+Number(m.xp||0)+'</td><td>'+escapeHTML(m.mode||'TRAINING')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function renderLeaderboard() {
    const rows=sorted().reduce((acc,m)=>{let row=acc.find(r=>r.name.toLowerCase()===String(m.name).toLowerCase());if(!row){row={name:m.name,matches:0,wins:0,eliminations:0,xp:0,best:0};acc.push(row)}row.matches++;row.wins+=m.result==='VICTORY'?1:0;row.eliminations+=Number(m.eliminations||0);row.xp+=Number(m.xp||0);row.best=Math.max(row.best,Number(m.eliminations||0));return acc;},[]);
    rows.sort((a,b)=>b.wins-a.wins||b.eliminations-a.eliminations||b.xp-a.xp);
    return '<div class="as-section-title">LOCAL RANKINGS <small>Wins → eliminations → XP</small></div>'+(rows.length?'<div class="as-table-wrap"><table class="as-table"><thead><tr><th>RANK</th><th>CALLSIGN</th><th>WINS</th><th>ELIMS</th><th>XP</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td>#'+(i+1)+'</td><td>'+escapeHTML(r.name)+(r.name.toLowerCase()===name().toLowerCase()?' <span class="as-badge">YOU</span>':'')+'</td><td>'+r.wins+'</td><td>'+r.eliminations+'</td><td>'+r.xp+'</td></tr>').join('')+'</tbody></table></div>':'<div class="as-empty">The leaderboard is waiting for its first match.<br>Play a round to claim the first spot.</div>')+'<p class="as-note">This leaderboard compares callsigns that have played on this browser only. It is not a global online leaderboard.</p>';
  }
  function render() {
    document.querySelectorAll('.as-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));
    $('as-title').textContent=activeTab==='overview'?'Career statistics':activeTab==='leaderboard'?'Local leaderboard':'Match history';
    $('as-content').innerHTML=activeTab==='overview'?renderOverview():activeTab==='leaderboard'?renderLeaderboard():historyTable(data.matches);
    $('as-export')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify({stats:data,career:career()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='browser-arena-stats.json';a.click();URL.revokeObjectURL(url);});
    $('as-reset')?.addEventListener('click',()=>{if(confirm('Reset your local match history and statistics? Your career XP and level will stay unchanged.')){data=fresh();save();render();}});
  }
  document.querySelector('.as-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){activeTab=b.dataset.tab;render();}});
  $('as-close').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))close();});
  const lobbyButton=document.createElement('button');lobbyButton.id='arena-stats-open';lobbyButton.type='button';lobbyButton.textContent='▤  CAREER STATS & LEADERBOARD';lobbyButton.addEventListener('click',open);
  const careerCard=document.querySelector('.progress-card');if(careerCard)careerCard.insertAdjacentElement('afterend',lobbyButton);
  const hudButton=document.createElement('button');hudButton.id='arena-stats-hud';hudButton.type='button';hudButton.textContent='STATS';hudButton.addEventListener('click',open);$('hud')?.appendChild(hudButton);
  function recordResult() {
    const screen=$('results-screen');if(!screen||screen.classList.contains('hidden'))return;
    const title=$('results-title')?.textContent||'MATCH COMPLETE';
    const resultText=$('results-outcome-label')?.textContent||'PLAYED';
    const stamp=[title,resultText,$('results-eliminations')?.textContent,$('results-earned-xp')?.textContent].join('|');
    if(stamp===lastResultStamp)return;lastResultStamp=stamp;
    const result=/victory|win/i.test(resultText+' '+title)?'VICTORY':/defeat|loss/i.test(resultText+' '+title)?'DEFEAT':'PLAYED';
    const elims=Math.max(0,Number($('results-eliminations')?.textContent)||0);
    const xp=Math.max(0,Number(($('results-earned-xp')?.textContent||'').replace(/[^0-9]/g,''))||0);
    const secondsText=$('results-time')?.textContent||'0:00',parts=secondsText.split(':').map(Number),seconds=(parts[0]||0)*60+(parts[1]||0);
    const entry={id:Date.now(),date:new Date().toISOString(),name:name(),result,eliminations:elims,xp,mode:$('results-match-type')?.textContent||'TRAINING',seconds};
    data.matches.unshift(entry);data.matches=data.matches.slice(0,100);
    const t=data.totals;t.matches++;t.wins+=result==='VICTORY'?1:0;t.losses+=result==='DEFEAT'?1:0;t.draws+=result==='PLAYED'?1:0;t.eliminations+=elims;t.bestRound=Math.max(t.bestRound,elims);t.seconds+=seconds;save();
  }
  const resultScreen=$('results-screen');
  if(resultScreen){new MutationObserver(recordResult).observe(resultScreen,{attributes:true,attributeFilter:['class','style']});}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)recordResult();});
  save();
})();