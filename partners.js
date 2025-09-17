(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const hasFB = typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet;

  let partners = [];

  async function load(){
    if(!hasFB){ partners = []; return; }
    try{ const snap = await window.dbGet('partners'); partners = snap.exists()? (snap.val()||[]) : []; }
    catch{ partners = []; }
  }
  async function save(){ if(hasFB){ try{ await window.dbSet('partners', partners); }catch{} } }
  function resetForm(){ qs('#partner-id').value=''; qs('#partner-name').value=''; qs('#partner-logo').value=''; qs('#partner-file').value=''; }
  function fileToDataUrl(file){ return new Promise((res, rej)=>{ const rd = new FileReader(); rd.onload = ()=> res(rd.result); rd.onerror = rej; rd.readAsDataURL(file); }); }

  function render(){
    const tbody = qs('#partners-table tbody'); if(!tbody) return; tbody.innerHTML='';
    partners.forEach((p,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${p.logo? `<img src="${p.logo}" alt="" style="height:36px">`: ''}</td>
        <td>${p.name||''}</td>
        <td class="actions-cell">
          <button class="btn" data-edit="${i}">تعديل</button>
          <button class="btn danger" data-del="${i}">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    });
    qsa('[data-edit]').forEach(b=> b.onclick = ()=> openEdit(Number(b.getAttribute('data-edit'))));
    qsa('[data-del]').forEach(b=> b.onclick = ()=> del(Number(b.getAttribute('data-del'))));
  }

  function openEdit(i){ window.AdminAuth.requireAuth(); const p = partners[i]; if(!p) return; qs('#partner-id').value=String(i); qs('#partner-name').value=p.name||''; qs('#partner-logo').value=p.logo||''; }
  async function del(i){ window.AdminAuth.requireAuth(); partners.splice(i,1); await save(); render(); }

  function setup(){
    qs('#reset-partner')?.addEventListener('click', resetForm);
    const file = qs('#partner-file');
    const logoInput = qs('#partner-logo');
    file?.addEventListener('change', async ()=>{
      const f = file.files && file.files[0];
      if(!f) return;
      const data = await fileToDataUrl(f);
      logoInput.value = data || logoInput.value;
    });

    const form = qs('#partner-form');
    form?.addEventListener('submit', async (e)=>{
      e.preventDefault(); window.AdminAuth.requireAuth();
      const idx = qs('#partner-id').value.trim();
      const name = qs('#partner-name').value.trim();
      let logo = qs('#partner-logo').value.trim();
      if(!name){ alert('الاسم مطلوب'); return; }

      // Upload logo if DataURL
      const targetId = idx ? String(idx) : String(Date.now());
      if(logo && logo.startsWith('data:') && window.uploadDataURL){
        try{ logo = await window.uploadDataURL(`partners/${targetId}/logo.jpg`, logo); }catch{}
      }

      if(idx){ const i = Number(idx); if(Number.isFinite(i) && partners[i]){ partners[i].name=name; partners[i].logo=logo; } }
      else { partners.push({ name, logo }); }
      await save(); resetForm(); render();
    });
  }

  async function seed(){ if(partners.length===0){ partners=[ { name:'FRMF', logo:'https://upload.wikimedia.org/wikipedia/fr/4/49/F%C3%A9d%C3%A9ration_royale_marocaine_de_football_%28logo%29.svg' } ]; await save(); } }

  async function init(){ await load(); await seed(); render(); setup(); }

  if(hasFB && window.dbOnValue){ window.dbOnValue('partners', (snap)=>{ if(snap.exists()){ partners = snap.val()||[]; render(); } }); }

  document.addEventListener('DOMContentLoaded', init);
})();