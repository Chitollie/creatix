async function postJSON(path, body){
  const r = await fetch(path, {method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)});
  return r.json();
}

function setStatus(s, ok){
  const el = document.getElementById('status'); el.innerText = s || '';
  el.style.color = ok ? '#080' : '#b00';
}

document.getElementById('btnToRegister').onclick = ()=>{
  const box = document.getElementById('registerBox'); box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

document.getElementById('btnLogin').onclick = async ()=>{
  const username = document.getElementById('login_username').value;
  const password = document.getElementById('login_password').value;
  setStatus('Logging in...');
  try{
    const res = await postJSON('/login',{username,password});
    if (res.token){ localStorage.token = res.token; setStatus('Logged in', true); window.location.href = '/home.html'; }
    else setStatus(res.error || 'Login failed');
  }catch(e){ setStatus('Network error'); }
};

document.getElementById('btnRegister').onclick = async ()=>{
  const username = document.getElementById('reg_username').value;
  const password = document.getElementById('reg_password').value;
  setStatus('Registering...');
  try{
    const res = await postJSON('/register',{username,password});
    if (res.token){ localStorage.token = res.token; setStatus('Registered', true); window.location.href = '/home.html'; }
    else setStatus(res.error || 'Register failed');
  }catch(e){ setStatus('Network error'); }
};
