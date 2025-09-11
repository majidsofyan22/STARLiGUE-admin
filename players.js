(function(){
  'use strict';
  // Read-only players view for Admin. Data is collected from public qualify page and saved under 'sl_players'.

  const storage = {
    get(k, f){ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;} }
  };
  const KEY = 'sl_players';

  function escapeHtml(str){
    return String(str||'').replace(/[&<>"]/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[s]));
  }

  function load(){ return storage.get(KEY, []); }
  function save(list){ localStorage.setItem(KEY, JSON.stringify(list)); }

  function genPassword(len=6){
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  function setPassword(id){
    const list = load();
    const idx = list.findIndex(p=>String(p.id)===String(id));
    if(idx===-1) return;
    list[idx].password = genPassword(8);
    save(list);
    return list[idx].password;
  }

  function renderTable(rows){
    const tbody = document.querySelector('#players-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    rows.forEach((p, i)=>{
      const tr = document.createElement('tr');
      const photoCell = p.photo ? `<img src="${p.photo}" alt="player" style="width:40px;height:40px;border-radius:50%;object-fit:cover">` : '—';
      const hasAnyAttach = p.attachments && (p.attachments.document || p.attachments.school || p.attachments.residence || p.attachments.passport);
      const attachCell = hasAnyAttach ? '✔️' : '—';
      const pwd = p.password ? `<code>${escapeHtml(p.password)}</code>` : '<span class="muted">—</span>';
      const actions = `<button class="btn" data-action="gen" data-id="${escapeHtml(p.id)}">توليد/تحديث</button>`;
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${escapeHtml(p.club)}</td>
        <td>${escapeHtml(p.position)}</td>
        <td>${photoCell}</td>
        <td>${escapeHtml(p.birth)}</td>
        <td>${p.medical === 'valid' ? 'صالحة' : 'غير صالحة'}</td>
        <td>${attachCell}</td>
        <td>${pwd}</td>
        <td>${actions}</td>`;
      tbody.appendChild(tr);
    });
  }

  function filterBy(q){
    const list = load();
    if(!q) return list;
    q = q.toLowerCase();
    return list.filter(p =>
      (p.name||'').toLowerCase().includes(q) ||
      (p.club||'').toLowerCase().includes(q) ||
      (p.category||'').toLowerCase().includes(q) ||
      (p.position||'').toLowerCase().includes(q) ||
      (p.season||'').toLowerCase().includes(q)
    );
  }

  function bind(){
    const search = document.querySelector('#players-search');
    const table = document.querySelector('#players-table');
    const doRender = ()=> renderTable(filterBy(search?.value||''));

    search?.addEventListener('input', doRender);

    table?.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-action="gen"]');
      if(!btn) return;
      const id = btn.getAttribute('data-id');
      const newPwd = setPassword(id);
      if(newPwd){
        alert('تم توليد كلمة السر: ' + newPwd);
        doRender();
      }
    });

    // Initial
    doRender();

    // Update live if data changes from public page (another tab)
    window.addEventListener('storage', (e)=>{ if(e.key === KEY) doRender(); });
  }

  document.addEventListener('DOMContentLoaded', bind);
})();