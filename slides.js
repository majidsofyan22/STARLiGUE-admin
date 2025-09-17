(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const hasFB = typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet;

  const state = {
    slides: [],
    settings: { autoplay:true, interval:6 }
  };

  // Generate a stable id (used for storage path and record id)
  function genId(){
    return String(Date.now()) + '-' + Math.random().toString(36).slice(2,8);
  }

  async function load(){
    if(!hasFB){ state.slides=[]; state.settings={ autoplay:true, interval:6 }; return; }
    try{
      const [slidesSnap, settingsSnap] = await Promise.all([ window.dbGet('slides'), window.dbGet('slider_settings') ]);
      state.slides = slidesSnap.exists()? (slidesSnap.val()||[]) : [];
      state.settings = settingsSnap.exists()? (settingsSnap.val()||state.settings) : state.settings;
    }catch{
      state.slides=[]; state.settings={ autoplay:true, interval:6 };
    }
  }
  async function saveSlides(){ if(hasFB){ try{ await window.dbSet('slides', state.slides); }catch{} } }

  // Helpers
  function resetForm(){
    qs('#slide-id').value = '';
    qs('#slide-storage-path').value = '';
    qs('#slide-url').value = '';
    qs('#slide-file').value = '';
    qs('#slide-caption').value = '';
    qs('#slide-link').value = '';
  }

  function render(){
    const tbody = qs('#slides-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    state.slides.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.className = 'sortable-row';
      tr.draggable = true;
      tr.dataset.id = s.id;
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><span class="thumb">${s.url? `<img src="${s.url}" alt="">`: ''}</span></td>
        <td>${s.caption||''}</td>
        <td>${s.link||''}</td>
        <td class="actions-cell">
          <button class="btn" data-edit="${s.id}">تعديل</button>
          <button class="btn" data-up="${s.id}">▲</button>
          <button class="btn" data-down="${s.id}">▼</button>
          <button class="btn danger" data-del="${s.id}">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    });

    // Actions
    qsa('[data-edit]').forEach(b=> b.onclick = ()=> openEdit(b.getAttribute('data-edit')));
    qsa('[data-del]').forEach(b=> b.onclick = ()=> del(b.getAttribute('data-del')));
    qsa('[data-up]').forEach(b=> b.onclick = ()=> move(b.getAttribute('data-up'), -1));
    qsa('[data-down]').forEach(b=> b.onclick = ()=> move(b.getAttribute('data-down'), 1));

    // Drag & Drop reorder
    let dragEl = null;
    qsa('.sortable-row').forEach(row => {
      row.addEventListener('dragstart', ()=>{ dragEl = row; row.style.opacity = '0.5'; });
      row.addEventListener('dragend', ()=>{ dragEl = null; row.style.opacity = ''; });
      row.addEventListener('dragover', (e)=>{ e.preventDefault(); const target = row; if(!dragEl || dragEl===target) return; const tbody = target.parentElement; const nodes = Array.from(tbody.children); const dragIdx = nodes.indexOf(dragEl); const tgtIdx = nodes.indexOf(target); if(dragIdx < tgtIdx) tbody.insertBefore(dragEl, target.nextSibling); else tbody.insertBefore(dragEl, target); });
      row.addEventListener('drop', ()=>{ persistOrder(); });
    });
  }

  async function persistOrder(){
    const ids = qsa('#slides-table tbody tr').map(tr => tr.dataset.id);
    const map = new Map(state.slides.map(s=> [String(s.id), s]));
    state.slides = ids.map(id => map.get(String(id))).filter(Boolean);
    await saveSlides();
    render();
  }

  async function move(id, dir){
    const idx = state.slides.findIndex(s=> String(s.id)===String(id));
    if(idx<0) return;
    const ni = idx + dir; if(ni<0 || ni>=state.slides.length) return;
    const [it] = state.slides.splice(idx,1);
    state.slides.splice(ni,0,it);
    await saveSlides();
    render();
  }

  async function del(id){
    const s = state.slides.find(x=> String(x.id)===String(id));
    if(!s) return;
    const ok = window.confirm('هل تريد حذف هذه الصورة نهائيًا؟');
    if(!ok) return;
    // Remove storage file if it exists
    if(s.storagePath && typeof window.deleteFromStorage === 'function'){
      try{ await window.deleteFromStorage(String(s.storagePath)); }catch{}
    }
    state.slides = state.slides.filter(x=> String(x.id)!==String(id));
    await saveSlides();
    render();
    try{ alert('تم الحذف نهائيًا'); }catch{}
  }

  function openEdit(id){
    const s = state.slides.find(x=> String(x.id)===String(id)); if(!s) return;
    qs('#slide-id').value = s.id;
    qs('#slide-storage-path').value = s.storagePath || '';
    qs('#slide-url').value = s.url || '';
    qs('#slide-file').value = '';
    qs('#slide-caption').value = s.caption || '';
    qs('#slide-link').value = s.link || '';
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function fileToDataUrl(file){
    return new Promise((res, rej)=>{
      const rd = new FileReader();
      rd.onload = ()=> res(rd.result);
      rd.onerror = rej;
      rd.readAsDataURL(file);
    });
  }

  function setupForm(){
    const form = qs('#form-slide');
    const resetBtn = qs('#btn-reset');
    resetBtn?.addEventListener('click', resetForm);

    // Auto-upload on file select -> fill URL & storage path automatically
    const fileInput = qs('#slide-file');
    fileInput?.addEventListener('change', async ()=>{
      const file = fileInput.files && fileInput.files[0];
      if(!file) return;
      // Ensure we have a stable id before upload (for new records)
      let id = qs('#slide-id').value.trim();
      if(!id){ id = genId(); qs('#slide-id').value = id; }
      const ext = (file.name||'jpg').split('.').pop();
      const storagePath = `slides/${id}/image.${ext}`;
      try{
        const url = await window.uploadFile(storagePath, file);
        qs('#slide-url').value = url;                 // auto fill URL
        qs('#slide-storage-path').value = storagePath; // keep link for delete/update
      }catch(err){ alert('تعذر رفع الصورة: ' + (err.message || '')); }
    });

    form?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      let id = qs('#slide-id').value.trim();
      let finalUrl = qs('#slide-url').value.trim();
      const file = qs('#slide-file').files[0];
      const caption = qs('#slide-caption').value.trim();
      const link = qs('#slide-link').value.trim();
      let storagePath = qs('#slide-storage-path').value.trim();

      // If no id yet, create one (keeps consistent storage path)
      if(!id){ id = genId(); qs('#slide-id').value = id; }

      // If URL empty but file selected and no auto-upload happened (fallback)
      if(!finalUrl && file){
        const ext = (file.name||'jpg').split('.').pop();
        storagePath = `slides/${id}/image.${ext}`;
        try{ finalUrl = await window.uploadFile(storagePath, file); }catch{}
      }
      if(!finalUrl){ alert('الرجاء إدخال رابط الصورة أو اختيار ملف'); return; }

      if(id){
        const s = state.slides.find(x=> String(x.id)===String(id));
        if(s){
          // If updating and new path differs, clean old
          if(s.storagePath && storagePath && s.storagePath !== storagePath && typeof window.deleteFromStorage === 'function'){
            try{ await window.deleteFromStorage(String(s.storagePath)); }catch{}
          }
          s.url = finalUrl; s.caption = caption; s.link = link; s.storagePath = storagePath || s.storagePath || '';
        } else {
          // New record path
          state.slides.push({ id, url: finalUrl, caption, link, storagePath });
        }
      }
      await saveSlides(); resetForm(); render();
    });
  }

  function setupSettings(){
    const autoSel = qs('#set-autoplay');
    const interval = qs('#set-interval');

    // Fill inputs from current state
    function fill(){
      if(autoSel) autoSel.value = (state.settings?.autoplay !== false) ? 'true' : 'false';
      if(interval) interval.value = String(Math.max(2, Math.min(30, Number(state.settings?.interval)||6)));
    }
    fill();

    // Save settings to DB
    qs('#save-settings')?.addEventListener('click', async ()=>{
      const settings = {
        autoplay: (autoSel?.value === 'true'),
        interval: (Number.isFinite(Number(interval?.value)) ? Math.max(2, Math.min(30, Number(interval?.value))) : 6)
      };
      try{
        await window.dbSet('slider_settings', settings);
        state.settings = settings;
        fill();
        alert('تم حفظ الإعدادات');
      }catch{}
    });
  }

  async function seed(){
    if(state.slides.length===0){
      state.slides = [
        { id:'s1', url:'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&q=80', caption:'كرة القدم المغربية' },
        { id:'s2', url:'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&q=80', caption:'المنافسات الوطنية' },
        { id:'s3', url:'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=1600&q=80', caption:'المنتخبات الوطنية' }
      ];
      await saveSlides();
    }
  }

  async function init(){ await load(); /* seed removed to prevent auto re-adding deleted slides */ setupForm(); setupSettings(); render(); }

  if(hasFB && window.dbOnValue){
    window.dbOnValue('slides', (snap)=>{ if(snap.exists()){ state.slides = snap.val()||[]; render(); } });
    window.dbOnValue('slider_settings', (snap)=>{ if(snap.exists()){ state.settings = snap.val()||state.settings; } });
  }

  document.addEventListener('DOMContentLoaded', init);
})();