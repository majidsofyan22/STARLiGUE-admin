(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  const storage = {
    get(k, f){ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;} },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  };

  const state = {
    slides: storage.get('sl_slides', []),
    settings: storage.get('sl_slider_settings', { autoplay:true, interval:6 })
  };
  function save(){
    storage.set('sl_slides', state.slides);
  }

  // Helpers
  function resetForm(){
    qs('#slide-id').value = '';
    qs('#slide-url').value = '';
    qs('#slide-file').value = '';
    qs('#slide-caption').value = '';
    qs('#slide-link').value = '';
  }

  function render(){
    const tbody = qs('#slides-table tbody');
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

  function persistOrder(){
    const ids = qsa('#slides-table tbody tr').map(tr => tr.dataset.id);
    const map = new Map(state.slides.map(s=> [String(s.id), s]));
    state.slides = ids.map(id => map.get(String(id))).filter(Boolean);
    save();
    render();
  }

  function move(id, dir){
    const idx = state.slides.findIndex(s=> String(s.id)===String(id));
    if(idx<0) return;
    const ni = idx + dir; if(ni<0 || ni>=state.slides.length) return;
    const [it] = state.slides.splice(idx,1);
    state.slides.splice(ni,0,it);
    save(); render();
  }

  function del(id){
    state.slides = state.slides.filter(s=> String(s.id)!==String(id));
    save(); render();
  }

  function openEdit(id){
    const s = state.slides.find(x=> String(x.id)===String(id)); if(!s) return;
    qs('#slide-id').value = s.id;
    qs('#slide-url').value = s.url || '';
    qs('#slide-file').value = '';
    qs('#slide-caption').value = s.caption || '';
    qs('#slide-link').value = s.link || '';
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  // File -> DataURL
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
    resetBtn.addEventListener('click', resetForm);

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const id = qs('#slide-id').value.trim();
      const urlInput = qs('#slide-url').value.trim();
      const file = qs('#slide-file').files[0];
      const caption = qs('#slide-caption').value.trim();
      const link = qs('#slide-link').value.trim();

      let finalUrl = urlInput;
      if(!finalUrl && file){ finalUrl = await fileToDataUrl(file); }
      if(!finalUrl){ alert('الرجاء إدخال رابط الصورة أو اختيار ملف'); return; }

      if(id){
        const s = state.slides.find(x=> String(x.id)===String(id)); if(!s) return;
        s.url = finalUrl; s.caption = caption; s.link = link;
      } else {
        state.slides.push({ id: Date.now(), url: finalUrl, caption, link });
      }
      save(); resetForm(); render();
    });
  }

  function setupSettings(){
    const autoSel = qs('#set-autoplay');
    const interval = qs('#set-interval');
    autoSel.value = String(!!state.settings.autoplay);
    interval.value = Number(state.settings.interval || 6);

    qs('#save-settings').addEventListener('click', ()=>{
      state.settings.autoplay = (autoSel.value === 'true');
      const n = Number(interval.value); state.settings.interval = (Number.isFinite(n) && n>=2 && n<=30) ? n : 6;
      storage.set('sl_slider_settings', state.settings);
      alert('تم حفظ الإعدادات');
    });
  }

  function seed(){
    if(state.slides.length===0){
      state.slides = [
        { id:'s1', url:'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&q=80', caption:'كرة القدم المغربية' },
        { id:'s2', url:'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&q=80', caption:'المنافسات الوطنية' },
        { id:'s3', url:'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=1600&q=80', caption:'المنتخبات الوطنية' }
      ];
      save();
    }
  }

  function init(){
    seed();
    setupForm();
    setupSettings();
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();