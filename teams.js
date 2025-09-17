(function(){
  'use strict';
  // Utilities
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const hasFB = ()=> typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet && !!window.firebaseAuth;
  const uid = ()=> String(Date.now());

  // UI helpers
  function setStatus(msg, color){ const el = qs('#form-status'); if(el){ el.textContent = msg||''; el.style.color = color||'#9aa0a6'; } }
  function setFormMode(edit){
    const title = qs('#form-title'); const cancel = qs('#cancel-edit');
    if(title) title.textContent = edit? 'تعديل فريق' : 'إضافة فريق';
    if(cancel) cancel.style.display = edit? '' : 'none';
  }
  function resetForm(){
    qs('#team-id').value='';
    qs('#team-name').value='';
    qs('#team-city').value='';
    qs('#team-logo').value='';
    const p=qs('#team-logo-preview'); if(p){ p.src=''; p.style.display='none'; }
    const f=qs('#team-logo-file'); if(f){ f.value=''; }
    setFormMode(false); setStatus('');
  }

  // Render team cards
  function renderCards(teams, filter=''){
    const wrap = qs('#teams-cards'); if(!wrap) return; wrap.innerHTML='';
    const list = (Array.isArray(teams)? teams: []).filter(t=>{
      if(!filter) return true;
      const f = filter.toLowerCase();
      return (t.name||'').toLowerCase().includes(f) || (t.city||'').toLowerCase().includes(f);
    });
    list.forEach(t=>{
      const card = document.createElement('div');
      card.className='team-card';
      card.innerHTML = `
        <div class="logo">${t.logo? `<img src="${t.logo}" alt="" referrerpolicy="no-referrer" loading="lazy">` : '🛡️'}</div>
        <div class="meta">
          <div class="name">${t.name || ''}${t.city? ` - <span class="city-inline">${t.city}</span>`:''}</div>
        </div>
        <div class="team-actions">
          <button class="btn" data-edit="${t.id}">تعديل</button>
          <button class="btn danger" data-del="${t.id}">حذف</button>
        </div>`;
      wrap.appendChild(card);
      const img = card.querySelector('.logo img');
      if(img){ img.addEventListener('error', ()=>{ const box = img.parentElement; try{ img.remove(); }catch{} if(box) box.textContent = '🛡️'; }); }
    });
    qsa('[data-edit]').forEach(b=> b.onclick = ()=> startEdit(b.getAttribute('data-edit')));
    qsa('[data-del]').forEach(b=> b.onclick = ()=> onDelete(b.getAttribute('data-del')));
  }

  // Firebase CRUD
  async function fetchTeams(){
    if(!hasFB()) return [];
    try{
      const snap = await window.dbGet('teams');
      if(!snap || !snap.exists()) return [];
      const val = snap.val();
      if(Array.isArray(val)) return val;
      if(typeof val === 'object') return Object.values(val);
      return [];
    }catch{ return []; }
  }
  async function saveTeams(teams){ if(!hasFB()) throw new Error('Firebase غير متاح'); await window.dbSet('teams', teams); }

  // Start edit into form
  async function startEdit(id){
    window.AdminAuth?.requireAuth();
    const teams = await fetchTeams();
    const t = teams.find(x=> String(x.id)===String(id)); if(!t) return;
    qs('#team-id').value=t.id; qs('#team-name').value=t.name||''; qs('#team-city').value=t.city||''; qs('#team-logo').value=t.logo||'';
    const p=qs('#team-logo-preview'); if(p){ if(t.logo){ p.src=t.logo; p.style.display='block'; p.referrerPolicy='no-referrer'; p.loading='lazy'; p.onerror=()=>{ p.style.display='none'; }; } else { p.src=''; p.style.display='none'; } }
    setFormMode(true); setStatus('وضع التعديل مفعل','');
  }

  // Delete with basic guard (matches relation optional - can be added later)
  async function onDelete(id){
    window.AdminAuth?.requireAuth();
    if(!confirm('هل تريد بالتأكيد حذف هذا الفريق؟')) return;
    const teams = await fetchTeams();
    const next = teams.filter(t=> String(t.id)!==String(id));
    await saveTeams(next);
    renderCards(next, qs('#search-teams')?.value||'');
    if(qs('#team-id').value === String(id)) resetForm();
    setStatus('تم حذف الفريق','var(--ok,#00d4a6)');
  }

  // Submit
  async function submitForm(e){
    e?.preventDefault();
    window.AdminAuth?.requireAuth();
    const id = qs('#team-id').value.trim();
    const name = qs('#team-name').value.trim();
    const city = qs('#team-city').value.trim();
    let logo = qs('#team-logo').value.trim();
    if(!name){ setStatus('اسم الفريق مطلوب','#ff8b9d'); return; }

    const targetId = id || uid();

    if(!hasFB()){
      setStatus('Firebase غير متاح. تأكد من الاتصال والتهيئة','#ff8b9d');
      return;
    }

    // Normalize and validate logo URL if provided
    if(logo){
      // If user pasted a URL, ensure it's a valid absolute URL
      if(!logo.startsWith('data:')){
        try{ const u = new URL(logo); logo = u.href; }catch{ setStatus('رابط الشعار غير صالح','#ff8b9d'); return; }
      }
    }

    // If DataURL -> upload and then replace with https URL
    if(logo && logo.startsWith('data:')){
      if(typeof window.uploadDataURL === 'function'){
        try{ logo = await window.uploadDataURL(`teams/${targetId}/logo.jpg`, logo, { contentType: 'image/jpeg' }); }
        catch(err){ setStatus('تعذر رفع الشعار. لن يتم الحفظ: ' + (err?.message||err),'#ff8b9d'); return; }
      }
      if(logo && logo.startsWith('data:')){ setStatus('تعذر رفع الشعار. حاول مجدداً أو احفظ بدون صورة','#ff8b9d'); return; }
    }

    const teams = await fetchTeams();
    if(id){
      const t = teams.find(x=> String(x.id)===String(id)); if(!t){ setStatus('الفريق غير موجود','#ff8b9d'); return; }
      t.name=name; t.city=city; t.logo=logo;
    } else {
      teams.push({ id: targetId, name, city, logo });
    }

    try{
      setStatus('جارٍ الحفظ...','#9aa0a6');
      await saveTeams(teams);
      renderCards(teams, qs('#search-teams')?.value||'');
      resetForm();
      setStatus('تم الحفظ بنجاح','var(--ok,#00d4a6)');
    }catch(err){ setStatus('فشل الحفظ: '+(err?.message||err),'#ff8b9d'); }
  }

  // Handle logo file -> compress -> upload (if logged-in)
  function bindLogoUpload(){
    const fileInput = qs('#team-logo-file');
    const logoInput = qs('#team-logo');
    const preview = qs('#team-logo-preview');

    function applyPreview(url){
      // Write DataURL to preview only; URL field is populated after successful upload
      if(preview){
        preview.src=url; preview.style.display='block';
        preview.referrerPolicy = 'no-referrer';
        preview.loading = 'lazy';
        preview.onerror = ()=>{ preview.style.display='none'; };
      }
    }

    // Instant preview when user pastes a URL
    logoInput?.addEventListener('input', ()=>{
      const v = String(logoInput.value||'').trim();
      if(!v){ if(preview){ preview.style.display='none'; preview.src=''; } return; }
      try{
        // Basic URL validation
        const u = new URL(v);
        applyPreview(u.href);
      }catch{ /* invalid URL -> ignore preview */ }
    });

    function handleFile(f){
      if(!f) return;
      const reader = new FileReader();
      reader.onload = async (ev)=>{
        let dataUrl = String(ev.target?.result||'');
        try{
          const img = new Image();
          img.onload = async ()=>{
            const maxSide = 800;
            let { width, height } = img;
            if(width > maxSide || height > maxSide){
              const scale = Math.min(maxSide/width, maxSide/height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            // show uploading state
            setStatus('جارٍ رفع الشعار...','#999');

            if(!hasFB()){
              applyPreview(dataUrl);
              setStatus('لا يمكن رفع الشعار: Firebase غير متاح','#ff8b9d');
              return;
            }

            // wait auth if needed (up to 3s)
            try{
              if(!window.firebaseAuth?.currentUser && typeof window.onAuthChanged === 'function'){
                await new Promise((resolve)=>{
                  let decided=false; const t=setTimeout(()=>{ if(!decided){ decided=true; resolve(false); } }, 3000);
                  window.onAuthChanged((u)=>{ if(!decided){ decided=true; clearTimeout(t); resolve(!!u); } });
                });
              }
            }catch{}

            if(!window.firebaseAuth?.currentUser){
              applyPreview(dataUrl);
              setStatus('لا يمكنك رفع الشعار قبل تسجيل الدخول','#ff8b9d');
              return;
            }

            try{
              const idEl = qs('#team-id');
              let upId = String(idEl?.value||'').trim();
              if(!upId && idEl){ upId = uid(); idEl.value = upId; }
              else if(!upId){ upId = uid(); }

              let url = '';
              if(typeof window.uploadDataURL === 'function'){
                url = await window.uploadDataURL(`teams/${upId}/logo.jpg`, dataUrl, { contentType: 'image/jpeg' });
              }
              if(!url && typeof window.uploadFile === 'function'){
                url = await window.uploadFile(`teams/${upId}/logo.jpg`, f, { contentType: f?.type || 'image/jpeg' });
              }
              if(url){ dataUrl = url; if(logoInput) logoInput.value = url; setStatus('تم رفع الشعار','var(--ok,#00d4a6)'); }
              else { setStatus('تعذر الحصول على رابط الشعار بعد الرفع','#ff8b9d'); }
            }catch(err){
              setStatus('فشل رفع الشعار: ' + (err?.message||err),'#ff8b9d');
            }
            applyPreview(dataUrl);
          };
          img.onerror = ()=>{ applyPreview(dataUrl); };
          img.src = dataUrl;
        }catch{ applyPreview(dataUrl); }
      };
      reader.readAsDataURL(f);
    }

    fileInput?.addEventListener('change', ()=> handleFile(fileInput.files && fileInput.files[0]));
  }

  // Live updates
  function bindLive(){
    if(!(hasFB() && window.dbOnValue)) return;
    window.dbOnValue('teams', (snap)=>{
      const q = qs('#search-teams')?.value||'';
      if(!snap || !snap.exists()) { renderCards([], q); return; }
      const val = snap.val();
      const arr = Array.isArray(val) ? val : (typeof val==='object' ? Object.values(val) : []);
      renderCards(arr, q);
    });
  }

  function bindUI(){
    qs('#team-form')?.addEventListener('submit', submitForm);
    qs('#reset-team')?.addEventListener('click', resetForm);
    qs('#cancel-edit')?.addEventListener('click', resetForm);
    bindLogoUpload();
    const search = qs('#search-teams');
    if(search){
      search.addEventListener('input', async ()=>{
        const list = await fetchTeams();
        renderCards(list, search.value||'');
      });
    }
  }

  async function init(){
    const list = await fetchTeams();
    renderCards(list);
    bindUI();
    bindLive();
  }

  document.addEventListener('DOMContentLoaded', init);
})();