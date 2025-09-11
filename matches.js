(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const S = (window.AdminAuth && window.AdminAuth.storage) || {
    get(k, f){ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;} },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  };
  let teams = S.get('sl_teams', []);
  let matches = S.get('sl_matches', []);

  function save(){ S.set('sl_matches', matches); }

  function fillTeams(){
    teams = S.get('sl_teams', []);
    const home = qs('#match-home'); const away = qs('#match-away');
    const note = qs('#teams-note');
    if(!Array.isArray(teams) || teams.length===0){
      const placeholder = `<option value="" selected disabled>لا توجد فرق — الرجاء إضافة فرق من صفحة الفرق</option>`;
      if(home) home.innerHTML = placeholder;
      if(away) away.innerHTML = placeholder;
      if(note) note.style.display = 'block';
      return;
    }
    const opts = teams.map(t=> `<option value="${t.id}">${t.name}${t.city? ` - ${t.city}`:''}</option>`).join('');
    if(home) home.innerHTML = `<option value="">—</option>` + opts;
    if(away) away.innerHTML = `<option value="">—</option>` + opts;
    if(note) note.style.display = 'none';
  }

  function resetForm(){
    qs('#match-id').value='';
    qs('#match-home').value='';
    qs('#match-away').value='';
    qs('#match-date').value='';
    qs('#match-time').value='';
    qs('#match-cat').value='';
    qs('#match-round').value='';
    qs('#match-venue').value='';
    qs('#match-score').value='';
  }

  function isPlayed(m){ return Number.isFinite(m.homeGoals) && Number.isFinite(m.awayGoals); }

  function render(){
    const tbody = qs('#matches-table tbody'); tbody.innerHTML='';
    const teamById = Object.fromEntries(teams.map(t=> [String(t.id), t]));
    const sorted = [...matches].sort((a,b)=> (Number(a.round||0)-Number(b.round||0)) || (a.date||'').localeCompare(b.date) || (a.time||'').localeCompare(b.time));
    sorted.forEach((m,i)=>{
      const tr = document.createElement('tr');
      const res = isPlayed(m) ? `${m.homeGoals} - ${m.awayGoals}` : '—';
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${m.category||m.cat||''}</td>
        <td>${m.round??m.r??''}</td>
        <td>${m.date||''}</td>
        <td>${m.time||''}</td>
        <td>${teamById[m.homeId]?.name || '—'}</td>
        <td>${teamById[m.awayId]?.name || '—'}</td>
        <td>${res}</td>
        <td>${m.venue||''}</td>
        <td class="actions-cell">
          <button class="btn" data-edit="${m.id}">تعديل</button>
          <button class="btn danger" data-del="${m.id}">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    });
    qsa('[data-edit]').forEach(b=> b.onclick = ()=> openEdit(b.getAttribute('data-edit')));
    qsa('[data-del]').forEach(b=> b.onclick = ()=> del(b.getAttribute('data-del')));
  }

  function openEdit(id){
    window.AdminAuth.requireAuth();
    const m = matches.find(x=> String(x.id)===String(id)); if(!m) return;
    qs('#match-id').value=m.id;
    qs('#match-home').value=String(m.homeId);
    qs('#match-away').value=String(m.awayId);
    qs('#match-date').value=m.date||'';
    qs('#match-time').value=m.time||'';
    qs('#match-cat').value=(m.category||m.cat||'');
    qs('#match-round').value=(m.round??m.r??'');
    qs('#match-venue').value=m.venue||'';
    qs('#match-score').value= (isPlayed(m)? `${m.homeGoals}-${m.awayGoals}` : '');
  }

  function del(id){ window.AdminAuth.requireAuth(); matches = matches.filter(m=> String(m.id)!==String(id)); save(); render(); }

  function setup(){
    qs('#reset-match').addEventListener('click', resetForm);
    const form = qs('#match-form');
    form.addEventListener('submit', (e)=>{
      e.preventDefault(); window.AdminAuth.requireAuth();
      const id = qs('#match-id').value.trim();
      const homeId = qs('#match-home').value; const awayId = qs('#match-away').value;
      const date = qs('#match-date').value; const time = qs('#match-time').value; const venue = qs('#match-venue').value;
      const category = (qs('#match-cat').value || '').toUpperCase();
      const round = Number(qs('#match-round').value || 0);
      const score = qs('#match-score').value.trim();
      let homeGoals = NaN, awayGoals = NaN;
      if(score){ const m = score.match(/^(\d+)\s*[-:]\s*(\d+)$/); if(m){ homeGoals = Number(m[1]); awayGoals = Number(m[2]); } }
      if(id){ const mm = matches.find(x=> String(x.id)===String(id)); if(!mm) return; Object.assign(mm, { homeId, awayId, date, time, venue, category, round, homeGoals, awayGoals }); }
      else { matches.push({ id: Date.now(), homeId, awayId, date, time, venue, category, round, homeGoals, awayGoals }); }
      save(); resetForm(); render();
    });
  }

  function seed(){ if(matches.length===0){ matches=[ { id:'m1', homeId:'t1', awayId:'t2', date:'2025-09-10', time:'18:00', venue:'ستاد النجوم', homeGoals:2, awayGoals:1 } ]; save(); } }

  function init(){ fillTeams(); seed(); render(); setup(); }

  document.addEventListener('DOMContentLoaded', init);
})();