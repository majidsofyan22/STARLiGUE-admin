(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const S = (window.AdminAuth && window.AdminAuth.storage) || {
    get(k, f){ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;} },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  };

  let teams = S.get('sl_teams', []);

  function save(){ S.set('sl_teams', teams); }

  function resetForm(){ qs('#team-id').value=''; qs('#team-name').value=''; qs('#team-city').value=''; qs('#team-logo').value=''; qs('#team-pass').value=''; const p=qs('#team-logo-preview'); if(p){ p.src=''; p.style.display='none'; } const f=qs('#team-logo-file'); if(f){ f.value=''; } }

  function renderCards(){
    const wrap = qs('#teams-cards'); if(!wrap) return; wrap.innerHTML='';
    teams.forEach((t)=>{
      const card = document.createElement('div');
      card.className='team-card';
      // Use the same structure/classes as public cards with city next to name
      card.innerHTML = `
        <div class="logo">${t.logo? `<img src="${t.logo}" alt="">` : '🛡️'}</div>
        <div class="meta">
          <div class="name">${t.name}${t.city? ` - <span class="city-inline">${t.city}</span>`:''}</div>
        </div>
        <div class="team-actions">
          <button class="btn" data-edit="${t.id}">تعديل</button>
          <button class="btn danger" data-del="${t.id}">حذف</button>
        </div>`;
      wrap.appendChild(card);
    });
    bindRowActions();
  }

  function bindRowActions(){
    qsa('[data-edit]').forEach(b=> b.onclick = ()=> openEdit(b.getAttribute('data-edit')));
    qsa('[data-del]').forEach(b=> b.onclick = ()=> del(b.getAttribute('data-del')));
  }

  function openEdit(id){ window.AdminAuth.requireAuth(); const t = teams.find(x=> String(x.id)===String(id)); if(!t) return; qs('#team-id').value=t.id; qs('#team-name').value=t.name; qs('#team-city').value=t.city||''; qs('#team-logo').value=t.logo||''; qs('#team-pass').value=t.pass||''; const p=qs('#team-logo-preview'); if(p){ if(t.logo){ p.src=t.logo; p.style.display='block'; } else { p.src=''; p.style.display='none'; } } }

  function del(id){ window.AdminAuth.requireAuth();
    const used = (S.get('sl_matches', [])).some(m=> String(m.homeId)===String(id) || String(m.awayId)===String(id));
    if(used){ alert('لا يمكن حذف الفريق بسبب وجود مباريات مرتبطة به'); return; }
    teams = teams.filter(t=> String(t.id)!==String(id)); save(); refresh();
  }

  function setup(){
    document.querySelector('#reset-team').addEventListener('click', resetForm);
    const logoInput = qs('#team-logo');
    const fileInput = qs('#team-logo-file');
    const preview = qs('#team-logo-preview');
    if(fileInput){
      fileInput.addEventListener('change', ()=>{
        const f = fileInput.files && fileInput.files[0];
        if(!f){ if(preview){ preview.src=''; preview.style.display='none'; } return; }
        const reader = new FileReader();
        reader.onload = (ev)=>{
          const dataUrl = ev.target?.result || '';
          if(logoInput) logoInput.value = String(dataUrl);
          if(preview){ preview.src = String(dataUrl); preview.style.display='block'; }
        };
        reader.readAsDataURL(f);
      });
    }
    const form = qs('#team-form');
    form.addEventListener('submit', (e)=>{
      e.preventDefault(); window.AdminAuth.requireAuth();
      const id = qs('#team-id').value.trim();
      const name = qs('#team-name').value.trim();
      const city = qs('#team-city').value.trim();
      const logo = qs('#team-logo').value.trim();
      if(!name){ alert('اسم الفريق مطلوب'); return; }
      if(id){ const t = teams.find(x=> String(x.id)===String(id)); if(!t) return; t.name=name; t.city=city; t.logo=logo; t.pass = qs('#team-pass').value.trim(); }
      else { teams.push({ id: Date.now(), name, city, logo, pass: qs('#team-pass').value.trim() }); }
      save(); resetForm(); refresh();
    });
  }

  function seed(){ if(teams.length===0){ teams=[ {id:'t1', name:'ستارز', city:'الرباط'}, {id:'t2', name:'فينيكس', city:'الدار البيضاء'} ]; save(); } }

  function refresh(){
    renderCards();
  }

  function init(){ seed(); refresh(); setup(); }

  document.addEventListener('DOMContentLoaded', init);
})();