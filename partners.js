(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const S = window.AdminAuth.storage;
  let partners = S.get('sl_partners', []);

  function save(){ S.set('sl_partners', partners); }
  function resetForm(){ qs('#partner-id').value=''; qs('#partner-name').value=''; qs('#partner-logo').value=''; }

  function render(){
    const tbody = qs('#partners-table tbody'); tbody.innerHTML='';
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
  function del(i){ window.AdminAuth.requireAuth(); partners.splice(i,1); save(); render(); }

  function setup(){
    qs('#reset-partner').addEventListener('click', resetForm);
    const form = qs('#partner-form');
    form.addEventListener('submit', (e)=>{
      e.preventDefault(); window.AdminAuth.requireAuth();
      const idx = qs('#partner-id').value.trim();
      const name = qs('#partner-name').value.trim();
      const logo = qs('#partner-logo').value.trim();
      if(!name){ alert('الاسم مطلوب'); return; }
      if(idx){ const i = Number(idx); if(Number.isFinite(i) && partners[i]){ partners[i].name=name; partners[i].logo=logo; } }
      else { partners.push({ name, logo }); }
      save(); resetForm(); render();
    });
  }

  function seed(){ if(partners.length===0){ partners=[ { name:'FRMF', logo:'https://upload.wikimedia.org/wikipedia/fr/4/49/F%C3%A9d%C3%A9ration_royale_marocaine_de_football_%28logo%29.svg' } ]; save(); } }

  function init(){ seed(); render(); setup(); }
  document.addEventListener('DOMContentLoaded', init);
})();