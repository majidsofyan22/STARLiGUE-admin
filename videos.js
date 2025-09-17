(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const hasFB = typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet;

  let videos = [];

  function youtubeEmbed(url){
    try{
      const u = new URL(url);
      if(u.hostname.includes('youtu')){
        // Handle youtu.be/ID or youtube.com/watch?v=ID
        let id = '';
        if(u.hostname === 'youtu.be'){ id = u.pathname.slice(1); }
        else { id = u.searchParams.get('v') || ''; }
        if(id){ return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" title="YouTube video" frameborder="0" allowfullscreen></iframe>`; }
      }
    }catch{}
    return '';
  }

  function vimeoEmbed(url){
    try{
      const u = new URL(url);
      if(u.hostname.includes('vimeo.com')){
        const id = (u.pathname.split('/').filter(Boolean).pop()) || '';
        if(id){ return `<iframe src="https://player.vimeo.com/video/${id}" width="560" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`; }
      }
    }catch{}
    return '';
  }

  function buildEmbedFromUrl(url){
    if(!url) return '';
    return youtubeEmbed(url) || vimeoEmbed(url) || '';
  }

  async function load(){
    if(!hasFB){ videos = []; return; }
    try{ const snap = await window.dbGet('videos'); videos = snap.exists()? (snap.val()||[]) : []; }
    catch{ videos = []; }
  }
  async function save(){ if(hasFB){ try{ await window.dbSet('videos', videos); }catch{} } }
  function resetForm(){ qs('#video-id').value=''; qs('#video-title').value=''; qs('#video-url').value=''; qs('#video-embed').value=''; }

  function render(){
    const tbody = qs('#videos-table tbody'); if(!tbody) return; tbody.innerHTML='';
    videos.forEach((v,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${v.title||''}</td>
        <td><span class="thumb">${v.embed|| buildEmbedFromUrl(v.url) || ''}</span></td>
        <td class="actions-cell">
          <button class="btn" data-edit="${v.id}">تعديل</button>
          <button class="btn danger" data-del="${v.id}">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    });
    qsa('[data-edit]').forEach(b=> b.onclick = ()=> openEdit(b.getAttribute('data-edit')));
    qsa('[data-del]').forEach(b=> b.onclick = ()=> del(b.getAttribute('data-del')));
  }

  function openEdit(id){ window.AdminAuth.requireAuth(); const v = videos.find(x=> String(x.id)===String(id)); if(!v) return; qs('#video-id').value=v.id; qs('#video-title').value=v.title||''; qs('#video-url').value=v.url||''; qs('#video-embed').value=v.embed||''; }
  async function del(id){ window.AdminAuth.requireAuth(); videos = videos.filter(v=> String(v.id)!==String(id)); await save(); render(); }

  async function setup(){
    qs('#reset-video')?.addEventListener('click', resetForm);
    const form = qs('#video-form');
    form?.addEventListener('submit', async (e)=>{
      e.preventDefault(); window.AdminAuth.requireAuth();
      const id = qs('#video-id').value.trim();
      const title = qs('#video-title').value.trim();
      const url = qs('#video-url').value.trim();
      let embed = qs('#video-embed').value.trim();
      if(!embed) embed = buildEmbedFromUrl(url);
      if(!title){ alert('العنوان مطلوب'); return; }
      if(id){ const v = videos.find(x=> String(x.id)===String(id)); if(!v) return; Object.assign(v, { title, url, embed }); }
      else { videos.push({ id: Date.now(), title, url, embed }); }
      await save(); resetForm(); render();
    });
  }

  async function seed(){ if(videos.length===0){ videos=[ { id:'v1', title:'لقطات مختارة', url:'https://youtu.be/dQw4w9WgXcQ', embed:'' } ]; await save(); } }

  async function init(){ await load(); await seed(); render(); await setup(); }

  if(hasFB && window.dbOnValue){ window.dbOnValue('videos', (snap)=>{ if(snap.exists()){ videos = snap.val()||[]; render(); } }); }

  document.addEventListener('DOMContentLoaded', init);
})();