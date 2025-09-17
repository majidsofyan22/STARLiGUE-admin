(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const hasFB = typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet;

  let news = [];

  async function load(){
    if(!hasFB){ news = []; return; }
    try{ const snap = await window.dbGet('news'); news = snap.exists()? (snap.val()||[]) : []; }
    catch{ news = []; }
  }
  async function save(){ if(hasFB){ try{ await window.dbSet('news', news); }catch{} } }
  function resetForm(){ qs('#news-id').value=''; qs('#news-title').value=''; qs('#news-date').value=''; qs('#news-image').value=''; qs('#news-file').value=''; }
  function fileToDataUrl(file){ return new Promise((res, rej)=>{ const rd = new FileReader(); rd.onload = ()=> res(rd.result); rd.onerror = rej; rd.readAsDataURL(file); }); }

  function render(){
    const tbody = qs('#news-table tbody'); if(!tbody) return; tbody.innerHTML='';
    news.forEach((n,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><span class="thumb">${n.image? `<img src="${n.image}" alt="">`: ''}</span></td>
        <td>${n.title}</td>
        <td>${n.date||''}</td>
        <td class="actions-cell">
          <button class="btn" data-edit="${n.id}">تعديل</button>
          <button class="btn danger" data-del="${n.id}">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    });
    qsa('[data-edit]').forEach(b=> b.onclick = ()=> openEdit(b.getAttribute('data-edit')));
    qsa('[data-del]').forEach(b=> b.onclick = ()=> del(b.getAttribute('data-del')));
  }

  function openEdit(id){ window.AdminAuth.requireAuth(); const n = news.find(x=> String(x.id)===String(id)); if(!n) return; qs('#news-id').value=n.id; qs('#news-title').value=n.title; qs('#news-date').value=n.date||''; qs('#news-image').value=n.image||''; qs('#news-file').value=''; }
  async function del(id){ window.AdminAuth.requireAuth(); news = news.filter(n=> String(n.id)!==String(id)); await save(); render(); }

  async function setup(){
    qs('#reset-news')?.addEventListener('click', resetForm);
    const form = qs('#news-form');
    form?.addEventListener('submit', async (e)=>{
      e.preventDefault(); window.AdminAuth.requireAuth();
      const id = qs('#news-id').value.trim();
      const title = qs('#news-title').value.trim();
      const date = qs('#news-date').value.trim();
      let image = qs('#news-image').value.trim();
      const file = qs('#news-file').files[0];
      if(!image && file){ image = await fileToDataUrl(file); }
      if(image && image.startsWith('data:') && window.uploadDataURL){
        const targetId = id || String(Date.now());
        try{ image = await window.uploadDataURL(`news/${targetId}/image.jpg`, image); }catch{}
      }
      if(!title){ alert('العنوان مطلوب'); return; }
      if(id){ const n = news.find(x=> String(x.id)===String(id)); if(!n) return; Object.assign(n, { title, date, image }); }
      else { news.push({ id: Date.now(), title, date, image }); }
      await save(); resetForm(); render();
    });
  }

  async function seed(){ if(news.length===0){ news=[ { id:'n1', title:'إعلان برمجة الجولة القادمة', date:'2025-09-05' } ]; await save(); } }

  async function init(){ await load(); await seed(); render(); await setup(); }

  if(hasFB && window.dbOnValue){ window.dbOnValue('news', (snap)=>{ if(snap.exists()){ news = snap.val()||[]; render(); } }); }

  document.addEventListener('DOMContentLoaded', init);
})();