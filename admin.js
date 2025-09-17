(function(){
  'use strict';

  // Evaluate Firebase availability at call time (avoids race with module loading)
  function hasFirebase(){
    return typeof window !== 'undefined' && !!window.firebaseAuth && typeof window.authSignIn === 'function';
  }

  const AdminAuth = {
    async getAdmins(){
      if(!hasFirebase()) return [];
      try{
        const snap = await window.dbGet('admins');
        if(snap.exists()){
          const data = snap.val();
          if(Array.isArray(data)) return data;
          if(typeof data === 'object') return Object.values(data);
        }
      }catch{}
      return [];
    },
    async isAdmin(user){
      if(!user) return false;
      const admins = await AdminAuth.getAdmins();
      return admins.includes(user.email);
    },
    isAuthed(){ return !!window.firebaseAuth?.currentUser; },
    async login(email, password){
      // Wait for Firebase to be ready
      let attempts = 0;
      while(!hasFirebase() && attempts < 50){ // wait up to 5 seconds
        await new Promise(res => setTimeout(res, 100));
        attempts++;
      }
      if(!hasFirebase()) throw new Error('Firebase غير مهيأ - تأكد من تحميل سكربتات Firebase وملف config.js');
      try{
        await window.authSignIn(String(email||'').trim(), String(password||'').trim());
        const user = window.firebaseAuth.currentUser;
        let admins = await AdminAuth.getAdmins();
        if(admins.length === 0){
          // First admin: add this user
          admins = [user.email];
          await window.dbSet('admins', admins);
        }
        if(!admins.includes(user.email)){
          await AdminAuth.logout();
          throw new Error('غير مصرح لك بالوصول إلى لوحة الإدارة');
        }
        return true;
      }
      catch(e){ throw e; }
    },
    async logout(){ try{ await window.authSignOut(); }catch{} },
    requireAuth(){
      // Allow running from file:// as well; rely solely on Firebase init
      const isLoginPage = /\/admin\/login\.html?$/.test(location.pathname);
      const isHttp = /^(http|https|file):$/i.test(location.protocol);
      if(!isHttp){
        console.warn('Running under a non-standard protocol; continuing anyway.');
      }
      if(!hasFirebase()){
        alert('Firebase غير مهيأ. تأكد من تحميل سكربتات Firebase وملف config.js.');
        if(!isLoginPage) location.href = './login.html';
        return false;
      }
      // Wait for Firebase auth state before deciding (prevents redirect flicker)
      try{
        if (typeof window.onAuthChanged === 'function') {
          let decided = false;
          window.onAuthChanged((u)=>{
            if (decided) return;
            decided = true;
            if (u) {
              if (isLoginPage) { location.href = './index.html'; }
            } else {
              if (!isLoginPage) { location.href = './login.html'; }
            }
          });
          return false;
        }
        // Fallback (if auth listener not available yet)
        const user = window.firebaseAuth?.currentUser;
        if(!user){ if(!isLoginPage){ location.href = './login.html'; } return false; }
        return true;
      }catch{ return true; }
    },

    // Bind UI for login, settings and common header
    bindLoginUI(){
      // Login page wiring
      const loginBtn = document.querySelector('#login');
      if(loginBtn){
        const userEl = document.querySelector('#user');
        const passEl = document.querySelector('#pass');
        const msgEl  = document.querySelector('#login-msg');
        const toggle = document.querySelector('#toggle');
        let busy = false;

        if(toggle && passEl){
          toggle.addEventListener('click', ()=>{ passEl.type = (passEl.type === 'password') ? 'text' : 'password'; });
        }

        // If already authed, redirect to dashboard
        if (typeof window.onAuthChanged === 'function') {
          try{ window.onAuthChanged(u=>{ if(u) location.href = './index.html'; }); }catch{}
        }

        const doLogin = async ()=>{
          if(busy) return;
          const u = String(userEl?.value||'').trim();
          const p = String(passEl?.value||'').trim();
          if(!u || !p){ if(msgEl){ msgEl.textContent = 'يرجى إدخال البريد وكلمة المرور'; msgEl.style.color = '#ff8b9d'; } return; }
          busy = true;
          loginBtn.disabled = true;
          loginBtn.style.opacity = '0.7';
          const prevTxt = loginBtn.textContent;
          loginBtn.textContent = 'جارٍ تسجيل الدخول...';
          if(msgEl){ msgEl.textContent = 'جارٍ تسجيل الدخول...'; msgEl.style.color = '#999'; }
          try{
            const ok = await AdminAuth.login(u,p);
            if(ok){
              if(msgEl){ msgEl.textContent = 'تم تسجيل الدخول، يتم تحويلك الآن...'; msgEl.style.color = '#00d4a6'; }
              setTimeout(()=> location.href = './index.html', 400);
            }else{
              if(msgEl){ msgEl.textContent = 'بيانات غير صحيحة أو حساب غير موجود'; msgEl.style.color = '#ff8b9d'; }
            }
          }catch(err){
            const code = err?.code || err?.message || '';
            if(msgEl){ msgEl.textContent = 'تعذر تسجيل الدخول: ' + code; msgEl.style.color = '#ff8b9d'; }
          }finally{
            busy = false;
            loginBtn.disabled = false;
            loginBtn.style.opacity = '';
            loginBtn.textContent = prevTxt;
          }
        };

        // Click handler (prevents layout jumps and double submits)
        loginBtn.addEventListener('click', async (e)=>{ e.preventDefault(); await doLogin(); });
        // Enter key support without form tag
        [userEl, passEl].forEach(el=> el&& el.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); doLogin(); } }));
      }

      // Settings page wiring
      const saveSiteBtn = document.querySelector('#save-site');
      if(saveSiteBtn){
        // Prefill from Firebase only
        const applyPrefill = async ()=>{
          let site = { nameAr:'بطولة ستارليغ', nameFr:'CHAMPIONNAT STARLiGUE', logo:'https://upload.wikimedia.org/wikipedia/fr/4/49/F%C3%A9d%C3%A9ration_royale_marocaine_de_football_%28logo%29.svg' };
          if(hasFirebase()){
            try{ const snap = await window.dbGet('site'); if(snap.exists()) site = snap.val(); }catch{}
          }
          const $ar = document.querySelector('#site-name-ar');
          const $fr = document.querySelector('#site-name-fr');
          const $lg = document.querySelector('#site-logo');
          if($ar) $ar.value = site.nameAr || '';
          if($fr) $fr.value = site.nameFr || '';
          if($lg) $lg.value = site.logo || '';
        };
        applyPrefill();

        saveSiteBtn.addEventListener('click', async ()=>{
          AdminAuth.requireAuth();
          const next = {
            nameAr: String(document.querySelector('#site-name-ar')?.value||'').trim() || ' ستارليغ',
            nameFr: String(document.querySelector('#site-name-fr')?.value||'').trim() || 'CHAMPIONNAT STARLiGUE',
            logo: String(document.querySelector('#site-logo')?.value||'').trim() || 'https://upload.wikimedia.org/wikipedia/fr/4/49/F%C3%A9d%C3%A9ration_royale_marocaine_de_football_%28logo%29.svg'
          };
          if(hasFirebase()){
            try{ await window.dbSet('site', next); }catch{}
          }
          alert('تم حفظ إعدادات الموقع');
        });
      }

      // Save admin credentials: create new admin user and add to admins list
      const saveBtn = document.querySelector('#save-admin');
      if(saveBtn){
        saveBtn.addEventListener('click', async ()=>{
          AdminAuth.requireAuth();
          const email = String(document.querySelector('#new-user')?.value||'').trim();
          const pass = String(document.querySelector('#new-pass')?.value||'').trim();
          if(!email || !pass){
            alert('يرجى إدخال البريد الإلكتروني وكلمة المرور الجديدة');
            return;
          }
          try{
            // Create the user in Firebase Auth
            await window.authCreateUser(email, pass);
            // Add email to admins list
            const admins = await AdminAuth.getAdmins();
            if(!admins.includes(email)){
              admins.push(email);
              await window.dbSet('admins', admins);
            }
            alert('تم إنشاء حساب الإدمن الجديد بنجاح');
            // Clear fields
            document.querySelector('#new-user').value = '';
            document.querySelector('#new-pass').value = '';
          }catch(err){
            alert('خطأ في إنشاء الحساب: ' + (err.message || err.code || 'غير معروف'));
          }
        });
      }

      // Logout button (common in sidebar)
      const lo = document.querySelector('#btn-logout');
      if(lo){ lo.addEventListener('click', async ()=>{ await AdminAuth.logout(); alert('تم تسجيل الخروج'); location.href='./login.html'; }); }
    }
  };

  window.AdminAuth = AdminAuth;

  // Hide logout and admin user only on login page
  function hideAuthElements(){
    const isLoginPage = /\/admin\/login\.html?$/.test(location.pathname);
    if(!isLoginPage) return;
    const logoutBtn = document.getElementById('btn-logout');
    if(logoutBtn) logoutBtn.style.display = 'none';
    const adminUser = document.querySelector('.admin-user');
    if(adminUser) adminUser.style.display = 'none';
  }

  // Init bindings after DOM is ready (also handle already-loaded DOM)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=>{ AdminAuth.bindLoginUI(); hideAuthElements(); });
  } else {
    AdminAuth.bindLoginUI();
    hideAuthElements();
  }
})();