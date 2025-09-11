// Admin panel for StarLeague. Uses same localStorage keys as public site.
(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  const storage = {
    get(k, f){ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;} },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  };

  const db = {
    teams: storage.get('sl_teams', []),
    matches: storage.get('sl_matches', []),
    slides: storage.get('sl_slides', []),
    registrations: storage.get('sl_registrations', []),
    admin: storage.get('sl_admin', { username:'admin', password:'123456' })
  };
  function save(){ storage.set('sl_teams', db.teams); storage.set('sl_matches', db.matches); storage.set('sl_slides', db.slides); storage.set('sl_admin', db.admin); }

  let isAuthed = false;

  function requireAuth(){
    if(!isAuthed){ alert('الرجاء تسجيل الدخول أولاً'); throw new Error('not authed'); }
  }

  function renderTeams(){
    const tbody = qs('#teams tbody');
    tbody.innerHTML = '';
    db.teams.forEach((t,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><span class="avatar">${t.logo? `<img src="${t.logo}" alt="">`: ''}</span></td>
        <td>${t.name}</td>
        <td>${t.city||''}</td>
        <td class="actions-cell">
          <button class="btn" data-edit-team="${t.id}">تعديل</button>
          <button class="btn danger" data-del-team="${t.id}">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    });
    qsa('[data-edit-team]').forEach(b=> b.onclick = ()=> openTeamModal(b.getAttribute('data-edit-team')));
    qsa('[data-del-team]').forEach(b=> b.onclick = ()=> { requireAuth(); deleteTeam(b.getAttribute('data-del-team')); });

    // Update selects
    const home = qs('#match-home');
    const away = qs('#match-away');
    [home, away].forEach(sel => sel.innerHTML = db.teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join(''));
  }

  function openTeamModal(id){ requireAuth();
    const dlg = qs('#team-modal');
    const form = qs('#team-form');
    const title = qs('#team-modal-title');
    const name = qs('#team-name');
    const city = qs('#team-city');
    const logo = qs('#team-logo');

    if(id){
      const t = db.teams.find(x => String(x.id)===String(id));
      if(!t) return;
      title.textContent = 'تعديل فريق';
      name.value=t.name; city.value=t.city||''; logo.value=t.logo||'';
      form.onsubmit = (e)=>{ e.preventDefault(); t.name=name.value.trim(); t.city=city.value.trim(); t.logo=logo.value.trim(); save(); renderTeams(); closeDialog(dlg); };
    } else {
      title.textContent = 'إضافة فريق';
      name.value=''; city.value=''; logo.value='';
      form.onsubmit = (e)=>{ e.preventDefault(); db.teams.push({ id:Date.now(), name:name.value.trim(), city:city.value.trim(), logo:logo.value.trim() }); save(); renderTeams(); closeDialog(dlg); };
    }
    bindClose(dlg);
    dlg.showModal();
  }

  function deleteTeam(id){
    const used = db.matches.some(m=> String(m.homeId)===String(id) || String(m.awayId)===String(id));
    if(used){ alert('لا يمكن حذف الفريق بسبب وجود مباريات مرتبطة به'); return; }
    db.teams = db.teams.filter(t=> String(t.id)!==String(id));
    save(); renderTeams();
  }

  function renderMatches(){
    const tbody = qs('#matches tbody');
    tbody.innerHTML = '';
    const teamById = Object.fromEntries(db.teams.map(t=> [String(t.id), t]));
    const sorted = [...db.matches].sort((a,b)=> (a.date||'').localeCompare(b.date) || (a.time||'').localeCompare(b.time));
    sorted.forEach((m,i)=>{
      const tr = document.createElement('tr');
      const result = Number.isFinite(m.homeGoals) && Number.isFinite(m.awayGoals) ? `${m.homeGoals} - ${m.awayGoals}` : '—';
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${m.date||''}</td>
        <td>${m.time||''}</td>
        <td>${teamById[m.homeId]?.name || '—'}</td>
        <td>${teamById[m.awayId]?.name || '—'}</td>
        <td>${result}</td>
        <td>${m.venue||''}</td>
        <td class="actions-cell">
          <button class="btn" data-edit-match="${m.id}">تعديل</button>
          <button class="btn danger" data-del-match="${m.id}">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    });
    qsa('[data-edit-match]').forEach(b=> b.onclick = ()=> openMatchModal(b.getAttribute('data-edit-match')));
    qsa('[data-del-match]').forEach(b=> b.onclick = ()=> { requireAuth(); deleteMatch(b.getAttribute('data-del-match')); });
  }

  function openMatchModal(id){ requireAuth();
    const dlg = qs('#match-modal');
    const form = qs('#match-form');
    const title = qs('#match-modal-title');

    const homeSel = qs('#match-home');
    const awaySel = qs('#match-away');
    const date = qs('#match-date');
    const time = qs('#match-time');
    const venue = qs('#match-venue');
    const hg = qs('#match-home-goals');
    const ag = qs('#match-away-goals');

    if(id){
      const m = db.matches.find(x=> String(x.id)===String(id)); if(!m) return;
      title.textContent = 'تعديل مباراة';
      homeSel.value=String(m.homeId); awaySel.value=String(m.awayId);
      date.value=m.date||''; time.value=m.time||''; venue.value=m.venue||'';
      hg.value=Number.isFinite(m.homeGoals)? m.homeGoals: '';
      ag.value=Number.isFinite(m.awayGoals)? m.awayGoals: '';
      form.onsubmit = (e)=>{ e.preventDefault(); m.homeId=homeSel.value; m.awayId=awaySel.value; m.date=date.value; m.time=time.value; m.venue=venue.value; m.homeGoals=hg.value===''? NaN:Number(hg.value); m.awayGoals=ag.value===''? NaN:Number(ag.value); save(); renderMatches(); closeDialog(dlg); };
    } else {
      title.textContent = 'إضافة مباراة';
      homeSel.value=''; awaySel.value=''; date.value=''; time.value=''; venue.value=''; hg.value=''; ag.value='';
      form.onsubmit = (e)=>{ e.preventDefault(); db.matches.push({ id:Date.now(), homeId:homeSel.value, awayId:awaySel.value, date:date.value, time:time.value, venue:venue.value, homeGoals: hg.value===''? NaN:Number(hg.value), awayGoals: ag.value===''? NaN:Number(ag.value) }); save(); renderMatches(); closeDialog(dlg); };
    }
    bindClose(dlg); dlg.showModal();
  }

  function deleteMatch(id){ db.matches = db.matches.filter(m=> String(m.id)!==String(id)); save(); renderMatches(); }

  function bindClose(dlg){ qs('[data-close]', dlg)?.addEventListener('click', ()=> closeDialog(dlg), { once:true }); }
  function closeDialog(dlg){ dlg.close(); }

  function setupLogin(){
    const user = qs('#user');
    const pass = qs('#pass');
    const loginBtn = qs('#login');
    const msg = qs('#login-msg');
    loginBtn.addEventListener('click', ()=>{
      const ok = (user.value.trim()===db.admin.username && pass.value.trim()===db.admin.password);
      isAuthed = ok;
      msg.textContent = ok? 'تم تسجيل الدخول' : 'بيانات غير صحيحة';
      msg.style.color = ok? '#00d4a6' : '#ff5d73';
    });

    qs('#save-admin').addEventListener('click', ()=>{
      if(!isAuthed){ alert('تسجيل الدخول مطلوب'); return; }
      const nu = qs('#new-user').value.trim();
      const np = qs('#new-pass').value.trim();
      if(nu) db.admin.username = nu;
      if(np) db.admin.password = np;
      save(); alert('تم تحديث بيانات الإدمن');
    });
  }

  function seed(){
    if(db.teams.length===0){ db.teams=[ {id:'t1', name:'ستارز', city:'الرباط', logo:''}, {id:'t2', name:'فينيكس', city:'الدار البيضاء', logo:''} ]; }
    if(db.matches.length===0){ db.matches=[ {id:'m1', homeId:'t1', awayId:'t2', date:'2025-09-10', time:'18:00', venue:'ستاد النجوم', homeGoals:2, awayGoals:1} ]; }
    save();
  }

  function renderSlides(){
    const tbody = qs('#slides tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    db.slides.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><span class="thumb">${s.url? `<img src="${s.url}" alt="">`: ''}</span></td>
        <td>${s.caption||''}</td>
        <td>${s.link||''}</td>
        <td>${typeof s.order==='number' ? s.order : i}</td>
        <td class="actions-cell">
          <button class="btn" data-edit-slide="${s.id}">تعديل</button>
          <button class="btn" data-up="${s.id}">▲</button>
          <button class="btn" data-down="${s.id}">▼</button>
          <button class="btn danger" data-del-slide="${s.id}">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    });

    // Bind actions
    qsa('[data-edit-slide]').forEach(b=> b.onclick = ()=> openSlideModal(b.getAttribute('data-edit-slide')));
    qsa('[data-del-slide]').forEach(b=> b.onclick = ()=> { requireAuth(); deleteSlide(b.getAttribute('data-del-slide')); });
    qsa('[data-up]').forEach(b=> b.onclick = ()=> { requireAuth(); moveSlide(b.getAttribute('data-up'), -1); });
    qsa('[data-down]').forEach(b=> b.onclick = ()=> { requireAuth(); moveSlide(b.getAttribute('data-down'), 1); });
  }

  function openSlideModal(id){ requireAuth();
    const dlg = qs('#slide-modal');
    const form = qs('#slide-form');
    const title = qs('#slide-modal-title');
    const url = qs('#slide-url');
    const caption = qs('#slide-caption');

    if(id){
      const s = db.slides.find(x=> String(x.id)===String(id)); if(!s) return;
      title.textContent = 'تعديل صورة';
      url.value = s.url || '';
      caption.value = s.caption || '';
      form.onsubmit = (e)=>{ e.preventDefault(); s.url=url.value.trim(); s.caption=caption.value.trim(); save(); renderSlides(); dlg.close(); };
    } else {
      title.textContent = 'إضافة صورة للسلايدر';
      url.value=''; caption.value='';
      form.onsubmit = (e)=>{ e.preventDefault(); db.slides.push({ id:Date.now(), url:url.value.trim(), caption:caption.value.trim(), order: db.slides.length }); save(); renderSlides(); dlg.close(); };
    }
    qs('#slide-form [data-close]')?.addEventListener('click', ()=> dlg.close(), { once:true });
    dlg.showModal();
  }

  function deleteSlide(id){ db.slides = db.slides.filter(s=> String(s.id)!==String(id)); save(); renderSlides(); }

  function moveSlide(id, dir){
    const idx = db.slides.findIndex(s=> String(s.id)===String(id));
    if(idx<0) return;
    const newIdx = idx + dir;
    if(newIdx < 0 || newIdx >= db.slides.length) return;
    const [item] = db.slides.splice(idx,1);
    db.slides.splice(newIdx,0,item);
    // update order fields
    db.slides.forEach((s,i)=> s.order=i);
    save(); renderSlides();
  }

  function renderRegistrations(){
    const tbody = qs('#registrations tbody'); if(!tbody) return;
    const list = storage.get('sl_registrations', []);
    tbody.innerHTML = '';
    list.forEach((r,i)=>{
      const tr = document.createElement('tr');
      const date = new Date(r.ts||Date.now());
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${r.team||''}</td>
        <td>${r.city||''}</td>
        <td>${r.email||''}</td>
        <td>${r.phone||''}</td>
        <td>${date.toLocaleString('ar-MA')}</td>`;
      tbody.appendChild(tr);
    });
  }

  function init(){
    seed();
    setupLogin();
    renderSlides();
    renderTeams();
    renderMatches();
    renderRegistrations();
    qs('#add-slide')?.addEventListener('click', ()=> openSlideModal());
  }

  document.addEventListener('DOMContentLoaded', init);
})();