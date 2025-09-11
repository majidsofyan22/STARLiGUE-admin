(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const STORAGE_KEY = 'sl_registrations';

  function getList(){ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }
  function saveList(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

  function ensureStatus(list){
    // Add default status 'pending' if missing for backward compatibility
    return list.map(r => ({ status: 'pending', ...r }));
  }

  function uniqueCities(list){
    return Array.from(new Set(list.map(r=> (r.city||'').trim()).filter(Boolean)));
  }

  function applyFilters(list){
    const q = (qs('#q')?.value||'').trim().toLowerCase();
    const city = (qs('#city')?.value||'').trim();
    const status = (qs('#status')?.value||'').trim();
    return list.filter(r=>{
      const text = `${r.team||''} ${r.city||''} ${r.email||''}`.toLowerCase();
      const okQ = !q || text.includes(q);
      const okCity = !city || (String(r.city||'')===city);
      const okStatus = !status || (String(r.status||'pending')===status);
      return okQ && okCity && okStatus;
    });
  }

  function updateSummary(list){
    const total = list.length;
    const today = list.filter(r=>{
      const d = new Date(r.ts||Date.now());
      const now = new Date();
      return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
    }).length;
    const pending = list.filter(r=> (r.status||'pending')==='pending').length;
    const approved = list.filter(r=> r.status==='approved').length;
    const rejected = list.filter(r=> r.status==='rejected').length;
    const set = (id,val)=>{ const el = qs('#'+id); if(el) el.textContent = String(val); };
    set('count-total', total); set('count-today', today); set('count-pending', pending); set('count-approved', approved); set('count-rejected', rejected);
  }

  function renderTable(list){
    const tbody = qs('#registrations tbody'); if(!tbody) return;
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
        <td>${date.toLocaleString('ar-MA')}</td>
        <td><span class="badge ${r.status||'pending'}">${labelStatus(r.status)}</span></td>
        <td>
          <button class="btn primary btn-approve" data-i="${i}">قبول</button>
          <button class="btn danger btn-reject" data-i="${i}">رفض</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  function renderCards(list){
    const cont = qs('#cards-view'); if(!cont) return;
    cont.innerHTML = '';
    list.forEach((r,i)=>{
      const d = new Date(r.ts||Date.now());
      const el = document.createElement('div');
      el.className = 'reg-card';
      el.innerHTML = `
        <div class="reg-head">
          <div>
            <div class="reg-team">${escapeHtml(r.team||'—')}</div>
            <div class="reg-city">${escapeHtml(r.city||'')}</div>
          </div>
          <span class="badge ${r.status||'pending'}">${labelStatus(r.status)}</span>
        </div>
        <div class="reg-meta">
          <div>📧 ${escapeHtml(r.email||'')}</div>
          <div>📞 ${escapeHtml(r.phone||'')}</div>
          <div>🗓️ ${d.toLocaleString('ar-MA')}</div>
        </div>
        <div class="reg-actions">
          <button class="btn primary btn-approve" data-i="${i}">قبول</button>
          <button class="btn danger btn-reject" data-i="${i}">رفض</button>
        </div>`;
      cont.appendChild(el);
    });
  }

  function labelStatus(s){
    switch(s){
      case 'approved': return 'مقبول';
      case 'rejected': return 'مرفوض';
      default: return 'قيد المراجعة';
    }
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"]+/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s]));
  }

  function bindActions(list){
    // Approve/Reject buttons
    qsa('.btn-approve').forEach(b=> b.addEventListener('click', ()=>{
      const i = Number(b.getAttribute('data-i'));
      list[i].status = 'approved'; saveList(list); refresh();
    }));
    qsa('.btn-reject').forEach(b=> b.addEventListener('click', ()=>{
      const i = Number(b.getAttribute('data-i'));
      list[i].status = 'rejected'; saveList(list); refresh();
    }));
  }

  function refresh(){
    let list = ensureStatus(getList());
    // Fill city select
    const citySel = qs('#city');
    if(citySel && citySel.options.length <= 1){
      uniqueCities(list).forEach(c=>{
        const opt = document.createElement('option'); opt.value = c; opt.textContent = c; citySel.appendChild(opt);
      });
    }
    const filtered = applyFilters(list);
    updateSummary(list);

    const useCards = qs('#cards-view') && qs('#cards-view').style.display !== 'none';
    if(useCards){ renderCards(filtered); }
    if(qs('#table-view') && qs('#table-view').style.display !== 'none'){ renderTable(filtered); }
    bindActions(list);
  }

  function initToggles(){
    const cardsBtn = qs('#view-cards'); const tableBtn = qs('#view-table');
    const cards = qs('#cards-view'); const table = qs('#table-view');
    if(cardsBtn && tableBtn && cards && table){
      cardsBtn.addEventListener('click', ()=>{ cards.style.display='grid'; table.style.display='none'; refresh(); });
      tableBtn.addEventListener('click', ()=>{ cards.style.display='none'; table.style.display='block'; refresh(); });
    }
  }

  function initFilters(){
    ['q','city','status'].forEach(id=>{ const el = qs('#'+id); if(el){ el.addEventListener('input', refresh); el.addEventListener('change', refresh); } });
  }

  document.addEventListener('DOMContentLoaded', ()=>{ initToggles(); initFilters(); refresh(); });
})();