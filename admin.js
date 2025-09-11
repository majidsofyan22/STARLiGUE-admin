(function(){
  'use strict';
  const storage = {
    get(k, f){ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;} },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  };
  const session = {
    get(k, f){ try{return JSON.parse(sessionStorage.getItem(k)) ?? f;}catch{return f;} },
    set(k, v){ sessionStorage.setItem(k, JSON.stringify(v)); },
    del(k){ sessionStorage.removeItem(k); }
  };
  const AdminAuth = {
    storage,
    getAdmin(){ return storage.get('sl_admin', { username:'admin', password:'123456' }); },
    saveAdmin(a){ storage.set('sl_admin', a); },
    isAuthed(){ return !!session.get('sl_authed', false); },
    login(user, pass){
      const a = AdminAuth.getAdmin();
      const ok = (String(user).trim()===a.username && String(pass).trim()===a.password);
      session.set('sl_authed', ok);
      return ok;
    },
    logout(){ session.del('sl_authed'); },
    requireAuth(){ if(!AdminAuth.isAuthed()){ location.href = './login.html'; throw new Error('not authed'); } return true; },
    // Bind to optional login UI if exists on page
    bindLoginUI(){
      const u = document.querySelector('#user');
      const p = document.querySelector('#pass');
      const b = document.querySelector('#login');
      const msg = document.querySelector('#login-msg');
      if(b){ b.addEventListener('click', ()=>{
        const ok = AdminAuth.login(u?.value||'', p?.value||'');
        if(msg){ msg.textContent = ok? 'تم تسجيل الدخول' : 'بيانات غير صحيحة'; msg.style.color = ok? '#00d4a6' : '#ff5d73'; }
      }); }
      const saveBtn = document.querySelector('#save-admin');
      if(saveBtn){ saveBtn.addEventListener('click', ()=>{
        AdminAuth.requireAuth();
        const a = AdminAuth.getAdmin();
        const nu = String(document.querySelector('#new-user')?.value||'').trim();
        const np = String(document.querySelector('#new-pass')?.value||'').trim();
        if(nu) a.username = nu; if(np) a.password = np; AdminAuth.saveAdmin(a);
        alert('تم تحديث بيانات الإدمن');
      }); }
      const lo = document.querySelector('#btn-logout');
      if(lo){ lo.addEventListener('click', ()=>{ AdminAuth.logout(); alert('تم تسجيل الخروج'); location.href='./login.html'; }); }

      // Site settings (name/logo)
      const saveSiteBtn = document.querySelector('#save-site');
      if(saveSiteBtn){
        // Prefill on load
        const site = storage.get('sl_site', { nameAr:'بطولة ستارليغ', nameFr:'CHAMPIONNAT STARLiGUE', logo:'https://upload.wikimedia.org/wikipedia/fr/4/49/F%C3%A9d%C3%A9ration_royale_marocaine_de_football_%28logo%29.svg' });
        const $ar = document.querySelector('#site-name-ar');
        const $fr = document.querySelector('#site-name-fr');
        const $lg = document.querySelector('#site-logo');
        if($ar) $ar.value = site.nameAr || '';
        if($fr) $fr.value = site.nameFr || '';
        if($lg) $lg.value = site.logo || '';
        saveSiteBtn.addEventListener('click', ()=>{
          AdminAuth.requireAuth();
          const next = {
            nameAr: String($ar?.value||'').trim() || 'بطولة ستارليغ',
            nameFr: String($fr?.value||'').trim() || 'CHAMPIONNAT STARLiGUE',
            logo: String($lg?.value||'').trim() || 'https://upload.wikimedia.org/wikipedia/fr/4/49/F%C3%A9d%C3%A9ration_royale_marocaine_de_football_%28logo%29.svg'
          };
          storage.set('sl_site', next);
          alert('تم حفظ إعدادات الموقع');
        });
      }
    }
  };
  window.AdminAuth = AdminAuth;
  document.addEventListener('DOMContentLoaded', ()=> AdminAuth.bindLoginUI());
})();