document.addEventListener('DOMContentLoaded', () => {
  async function postJSON(path, body){
    const r = await fetch(path, {method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)});
    return r.json();
  }

  function setStatus(s, ok){
    const el = document.getElementById('status'); if (!el) return; el.innerText = s || '';
    el.style.color = ok ? '#080' : '#b00';
  }

  const btnToRegister = document.getElementById('btnToRegister');
  if (btnToRegister) btnToRegister.onclick = ()=>{
    const box = document.getElementById('registerBox'); if (!box) return; box.style.display = box.style.display === 'none' ? 'block' : 'none';
  };

  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) btnLogin.onclick = async ()=>{
    const usernameEl = document.getElementById('login_username');
    const passwordEl = document.getElementById('login_password');
    const username = usernameEl ? usernameEl.value : '';
    const password = passwordEl ? passwordEl.value : '';
    setStatus('Logging in...');
    try{
      const res = await postJSON('/login',{username,password});
      if (res && res.token){ localStorage.token = res.token; setStatus('Logged in', true); window.location.href = '/home.html'; }
      else setStatus((res && res.error) || 'Login failed');
    }catch(e){ setStatus('Network error'); }
  };

  const btnRegister = document.getElementById('btnRegister');
  if (btnRegister) btnRegister.onclick = async ()=>{
    const usernameEl = document.getElementById('reg_username');
    const passwordEl = document.getElementById('reg_password');
    const username = usernameEl ? usernameEl.value : '';
    const password = passwordEl ? passwordEl.value : '';
    setStatus('Registering...');
    try{
      const res = await postJSON('/register',{username,password});
      if (res && res.token){ localStorage.token = res.token; setStatus('Registered', true); window.location.href = '/home.html'; }
      else setStatus((res && res.error) || 'Register failed');
    }catch(e){ setStatus('Network error'); }
  };
});
