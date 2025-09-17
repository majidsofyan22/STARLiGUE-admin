(function(){
  'use strict';
  // Read-only players view for Admin. Data is collected from public qualify page and saved under 'players' in Firebase (fallback 'sl_players' locally).

  const storage = {
    get(k, f){ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;} },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  };
  const LOCAL_KEY = 'sl_players';
  const hasFirebase = typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet;

  // Serial number map (admin-side)
  let serialMap = {};
  function loadSerialMap(){
    try { return JSON.parse(localStorage.getItem('sl_player_serials')) || {}; } catch { return {}; }
  }
  function saveSerialMap(map){
    try { localStorage.setItem('sl_player_serials', JSON.stringify(map)); } catch {}
  }
  function ensureSerials(list){
    // Build/update map without mutating backend
    const map = loadSerialMap();
    // Seed with any existing serials from data
    let maxSerial = 0;
    (list || []).forEach(p=>{
      const sid = String(p.id || '');
      const s = Number(p.serial || map[sid] || 0);
      if(s > 0){
        map[sid] = s;
        if(s > maxSerial) maxSerial = s;
      }
    });
    // Assign serials for players without one
    (list || []).forEach(p=>{
      const sid = String(p.id || '');
      if(!map[sid]){
        maxSerial += 1;
        map[sid] = maxSerial;
      }
    });
    serialMap = map;
    saveSerialMap(map);
  }

  function removeSerial(id){
    try{
      const map = loadSerialMap();
      delete map[String(id)];
      serialMap = map;
      saveSerialMap(map);
    }catch{}
  }

  async function load(){
    // Firebase-only: no localStorage fallback
    if(!hasFirebase){ throw new Error('Firebase غير متاح'); }
    try{
      const snap = await window.dbGet('players');
      if(!snap || !snap.exists()) return [];
      const val = snap.val();
      if(Array.isArray(val)) return val || [];
      if(val && typeof val === 'object'){
        // keyed object (when using push)
        return Object.values(val);
      }
      return [];
    } catch(e){ throw e; }
  }
  async function save(list){
    // Firebase-only save
    if(!hasFirebase) throw new Error('Firebase غير متاح');
    await window.dbSet('players', list);
  }

  // Permanently delete a player by id from DB/local
  async function deletePlayerById(id){
    if(!id) return false;
    if(!hasFirebase) throw new Error('Firebase غير متاح');
    let ok = false;
    try{
      const snap = await window.dbGet('players');
      if(snap.exists()){
        const val = snap.val();
        if(Array.isArray(val)){
          const next = (val||[]).filter(p => String(p?.id) !== String(id));
          await window.dbSet('players', next);
          ok = true;
        } else if (val && typeof val === 'object'){
          const obj = { ...val };
          const key = Object.keys(obj).find(k => String(obj[k]?.id) === String(id));
          if(key){ delete obj[key]; await window.dbSet('players', obj); ok = true; }
        }
      }
    }catch{/* ignore, will return false if not deleted */}
    // Remove admin-side serial mapping regardless
    removeSerial(id);
    return ok;
  }

  // QR lib is loaded via HTML <script> tag. No runtime injection needed.
  function injectQrLib(){ /* no-op */ }

  // Render QR codes for all .qr placeholders in the table
  function renderQRCodes(){
    const nodes = document.querySelectorAll('#players-table .qr[data-qr]');
    nodes.forEach(node => {
      // Avoid double-rendering
      if(node.dataset.rendered === '1') return;
      const payload = decodeURIComponent(node.getAttribute('data-qr')||'');
      // If library not ready yet, retry shortly, then fallback to an <img>-based QR
      if(typeof window.QRCode !== 'function'){
        if(!renderQRCodes._t0){ renderQRCodes._t0 = Date.now(); }
        if(Date.now() - renderQRCodes._t0 > 2000){
          try{
            const img = document.createElement('img');
            img.width = 64; img.height = 64; img.alt = 'QR';
            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=' + encodeURIComponent(payload);
            node.innerHTML = '';
            node.appendChild(img);
            node.dataset.rendered = '1';
          }catch{}
        } else {
          setTimeout(renderQRCodes, 200);
        }
        return;
      }
      try{
        node.innerHTML = '';
        const data = payload;
        new window.QRCode(node, { text: data, width: 64, height: 64, correctLevel: window.QRCode.CorrectLevel.M });
        node.dataset.rendered = '1';
      }catch{}
    });
  }

  function escapeHtml(str){
    return String(str||'').replace(/[&<>"]/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[s]));
  }

  async function genPassword(len=8){
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  async function setPassword(id){
    const list = await load();
    const idx = list.findIndex(p=>String(p.id)===String(id));
    if(idx===-1) return;
    list[idx].password = await genPassword(8);
    await save(list);
    return list[idx].password;
  }

  function renderTable(rows, teamMap){
    const tbody = document.querySelector('#players-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    rows.forEach((p, i)=>{
      const tr = document.createElement('tr');
      const photoCell = p.photo ? `<img src="${p.photo}" alt="player" class="js-photo" data-photo="${escapeHtml(p.photo)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;cursor:pointer">` : '—';
      const hasAnyAttach = p.attachments && (p.attachments.document || p.attachments.school || p.attachments.residence || p.attachments.passport);
      const attachCell = hasAnyAttach ? `<button class="btn js-attach" data-player-index="${i}">عرض</button>` : '—';
      const clubName = (p.club && String(p.club).trim()) || (teamMap && teamMap[String(p.teamId)]) || '';
      const serial = (p && p.serial) ? p.serial : (serialMap[String(p.id)] || '');
      // Prepare QR payload: only name, category, club, birth, license + photo URL (if remote)
      // Build QR payload from scratch per requirements
      const qrPayload = {
        "الاسم": String(p.name||''),
        "الفئة": String(p.category||''),
        "النادي": String(clubName||''),
        "تاريخ_الميلاد": String(p.birth||''),
        "رقم_الرخصة": String(p.licenseNumber||'')
      };
      // Include photo URL only if remote (to keep QR size reasonable)
      const photoUrl = (p.photo && /^https?:\/\//i.test(String(p.photo))) ? String(p.photo) : '';
      if(photoUrl){ qrPayload["الصورة"] = photoUrl; }
      // Encode both JSON payload (للاطلاع) ورابط تحقق يفتح مباشرة عند السكان
      const qrJson = encodeURIComponent(JSON.stringify(qrPayload));
      // Build absolute verify URL. If PUBLIC_BASE_URL is provided (e.g. https://domain/app/), use it; otherwise derive from current page.
      const publicBase = (window.PUBLIC_BASE_URL || '').trim();
      let baseUrl;
      if(publicBase){
        const normalized = publicBase.endsWith('/') ? publicBase : (publicBase + '/');
        baseUrl = new URL('verify.html', normalized).toString();
      } else {
        baseUrl = new URL('../verify.html', location.href).toString();
      }
      const lic = encodeURIComponent(String(p.licenseNumber||''));
      const verifyUrl = `${baseUrl}?lic=${lic}`;
      const qrData = encodeURIComponent(verifyUrl);
      const qrCell = `<div class="qr" data-qr="${qrData}" title="${verifyUrl}" style="width:64px;height:64px"></div><div style="margin-top:6px"><a href="${verifyUrl}" target="_blank" class="btn" style="padding:2px 6px;font-size:12px">تحقق</a></div>`;

      tr.innerHTML = `
        <td>${serial}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${escapeHtml(clubName)}</td>
        <td>${escapeHtml(p.licenseNumber || '')}</td>
        <td>${photoCell}</td>
        <td>${escapeHtml(p.birth)}</td>
        <td>${attachCell}</td>
        <td>${qrCell}</td>
        <td><button class="btn danger js-del" data-id="${escapeHtml(p.id)}">حذف</button></td>`;
      // Keep a hidden JSON payload for attachments
      tr.dataset.player = JSON.stringify(p);
      tbody.appendChild(tr);
    });

    // Render QRs after rows appended
    renderQRCodes();
  }

  function filterBy(list, q){
    if(!q) return list;
    q = q.toLowerCase();
    return list.filter(p =>
      (p.name||'').toLowerCase().includes(q) ||
      (p.club||'').toLowerCase().includes(q) ||
      (p.category||'').toLowerCase().includes(q) ||
      (p.season||'').toLowerCase().includes(q)
    );
  }

  async function loadTeams(){
    if(!hasFirebase) throw new Error('Firebase غير متاح');
    try{
      const snap = await window.dbGet('teams');
      if(!snap || !snap.exists()) return [];
      const val = snap.val();
      return Array.isArray(val) ? val : (val && typeof val === 'object' ? Object.values(val) : []);
    }catch(e){ throw e; }
  }

  function populateTeamFilter(teams){
    const sel = document.querySelector('#filter-team');
    if(!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">كل الفرق</option>';
    teams.forEach(t=>{
      const opt = document.createElement('option');
      opt.value = String(t.id);
      opt.textContent = t.name || ('فريق #' + t.id);
      sel.appendChild(opt);
    });
    if(current && Array.from(sel.options).some(o=>o.value===current)) sel.value = current;
  }

  async function bind(){
    // Enforce Firebase availability before proceeding
    if(!hasFirebase){
      alert('Firebase غير متاح. يرجى التأكد من تحميل سكربتات Firebase وتهيئة config.js على الاستضافة.');
      return;
    }
    let all = await load();
    let teams = await loadTeams();

    // Ensure serials are assigned once data is loaded
    ensureSerials(all);

    const search = document.querySelector('#players-search');
    const table = document.querySelector('#players-table');
    const teamSel = document.querySelector('#filter-team');
    const catSel = document.querySelector('#filter-category');

    // Inject QR library dynamically once (qrcodejs)
    injectQrLib();

    populateTeamFilter(teams);

    const doRender = ()=>{
      let rows = all.slice();
      const q = (search?.value||'');
      const teamId = (teamSel?.value||'').trim();
      const cat = (catSel?.value||'').trim();
      if(teamId){ rows = rows.filter(p => String(p.teamId) === String(teamId)); }
      if(cat){ rows = rows.filter(p => String(p.category).toLowerCase() === String(cat).toLowerCase()); }
      rows = filterBy(rows, q);
      const teamMap = Object.fromEntries((teams||[]).map(t => [String(t.id), t.name || ('فريق #' + t.id)]));
      // Inject serial numbers into rows for rendering
      rows = rows.map(p => ({ ...p, serial: (p && (p.serial || serialMap[String(p.id)])) ? (p.serial || serialMap[String(p.id)]) : undefined }));
      renderTable(rows, teamMap);
    };

    search?.addEventListener('input', doRender);
    teamSel?.addEventListener('change', doRender);
    catSel?.addEventListener('change', doRender);

    // تعامل مع عرض الصورة والتنزيل
    document.addEventListener('click', (e)=>{
      const img = e.target.closest('img.js-photo');
      if(!img) return;
      const url = img.getAttribute('data-photo') || img.getAttribute('src');
      const modal = document.getElementById('photo-modal');
      const large = document.getElementById('photo-large');
      const down  = document.getElementById('photo-download');
      const close = document.getElementById('photo-close');
      if(!modal || !large || !down) return;
      large.src = url;
      down.href = url;
      // Try to set a filename if it's a data URL
      if(String(url).startsWith('data:')){
        down.setAttribute('download', 'player.jpg');
      } else {
        down.setAttribute('download', 'player.jpg');
      }
      modal.style.display = 'flex';
      const hide = ()=>{ modal.style.display = 'none'; large.src=''; };
      modal.addEventListener('click', (ev)=>{ if(ev.target === modal) hide(); }, { once:true });
      close && close.addEventListener('click', hide, { once:true });
    });

    // تعامل مع عرض المرفقات + التحميل
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('.js-attach');
      if(!btn) return;
      const tr = btn.closest('tr');
      if(!tr) return;
      let player = null;
      try { player = JSON.parse(tr.dataset.player || '{}'); } catch {}
      if(!player || !player.attachments) return;

      const modal = document.getElementById('attach-modal');
      const list  = document.getElementById('attach-list');
      const prev  = document.getElementById('attach-preview');
      const down  = document.getElementById('attach-download');
      const close = document.getElementById('attach-close');
      if(!modal || !list || !prev || !down) return;

      // Build list of available attachments
      const items = [];
      const at = player.attachments || {};
      if(at.document) items.push({ key:'document', label:'الوثيقة' , url: at.document });
      if(at.school)   items.push({ key:'school'  , label:'شهادة مدرسية', url: at.school });
      if(at.residence)items.push({ key:'residence', label:'شهادة السكن', url: at.residence });
      if(at.passport) items.push({ key:'passport' , label:'جواز السفر', url: at.passport });
      list.innerHTML = '';

      const show = (url)=>{
        prev.innerHTML = '';
        // Show image directly, PDF in iframe
        if(String(url).startsWith('data:application/pdf') || /\.pdf(\?|$)/i.test(url)){
          const ifr = document.createElement('iframe');
          ifr.src = url;
          ifr.style.width = '80vw';
          ifr.style.height = '70vh';
          ifr.style.border = 'none';
          prev.appendChild(ifr);
          down.href = url;
          down.setAttribute('download', 'document.pdf');
        } else {
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'attachment';
          img.style.maxWidth = '80vw';
          img.style.maxHeight = '70vh';
          img.style.objectFit = 'contain';
          img.style.borderRadius = '8px';
          img.style.background = '#f6f6f6';
          prev.appendChild(img);
          down.href = url;
          down.setAttribute('download', 'attachment.jpg');
        }
      };

      items.forEach((it, idx)=>{
        const a = document.createElement('button');
        a.className = 'btn';
        a.type = 'button';
        a.textContent = it.label;
        a.addEventListener('click', ()=> show(it.url));
        list.appendChild(a);
        if(idx === 0) show(it.url);
      });

      modal.style.display = 'flex';
      const hide = ()=>{ modal.style.display = 'none'; prev.innerHTML = ''; list.innerHTML=''; };
      modal.addEventListener('click', (ev)=>{ if(ev.target === modal) hide(); }, { once:true });
      close && close.addEventListener('click', hide, { once:true });
    });

    // Initial
    doRender();

    // Live update when data changes
    if(hasFirebase && window.dbOnValue){
      window.dbOnValue('players', async ()=>{ all = await load(); ensureSerials(all); doRender(); });
      window.dbOnValue('teams', async ()=>{ teams = await loadTeams(); populateTeamFilter(teams); });
    }
    window.addEventListener('storage', async (e)=>{
      if(e.key === LOCAL_KEY){ all = await load(); ensureSerials(all); doRender(); }
      if(e.key === 'sl_teams'){ teams = await loadTeams(); populateTeamFilter(teams); }
    });

    // Handle delete clicks (event delegation)
    document.addEventListener('click', async (e)=>{
      const btn = e.target.closest('.js-del');
      if(!btn) return;
      const id = btn.getAttribute('data-id');
      if(!id) return;
      if(!confirm('هل أنت متأكد من حذف هذا اللاعب؟ لا يمكن التراجع.')) return;
      try{
        const ok = await deletePlayerById(id);
        if(ok){
          // Refresh local cache and UI
          all = await load();
          ensureSerials(all);
          doRender();
        } else {
          alert('تعذر حذف اللاعب.');
        }
      }catch{
        alert('حدث خطأ أثناء الحذف.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', bind);
})();