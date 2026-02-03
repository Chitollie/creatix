const base = '';
function el(id){return document.getElementById(id)}

async function register(){
  const username = el('reg_user').value;
  const password = el('reg_pass').value;
  const r = await fetch(base + '/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  const j = await r.json();
  if (j.token) { localStorage.token = j.token; alert('Registered'); loadMe(); }
}

async function login(){
  const username = el('log_user').value;
  const password = el('log_pass').value;
  const r = await fetch(base + '/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  const j = await r.json();
  if (j.token) { localStorage.token = j.token; alert('Logged in'); loadMe(); }
}

async function loadMe(){
  const token = localStorage.token;
  if (!token) { el('me').innerText='Not logged in'; return; }
  const r = await fetch(base + '/me',{headers:{'Authorization':'Bearer '+token}});
  const j = await r.json();
  el('me').innerText = JSON.stringify(j.user);
}

async function loadParts(){
  const r = await fetch(base + '/avatar-parts');
  const j = await r.json();
  const partsDiv = el('parts'); partsDiv.innerHTML='';
  j.parts.forEach(p => {
    const d = document.createElement('div'); d.className='part'; d.innerText = `${p.slot} - ${p.gender} - ${p.name}`;
    d.dataset.id = p.id;
    d.onclick = ()=>{ d.classList.toggle('selected'); };
    partsDiv.appendChild(d);
  });
}

async function createAvatar(){
  const name = el('avatar_name').value || 'MyAvatar';
  const token = localStorage.token;
  const r = await fetch(base + '/avatars',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({name,data:{}})});
  const j = await r.json();
  alert('Avatar created id='+j.id);
  listAvatars();
}

async function listAvatars(){
  const r = await fetch(base + '/avatars');
  const j = await r.json();
  const a = el('avatars'); a.innerHTML='';
  j.avatars.forEach(av => {
    const d = document.createElement('div'); d.className='avatar';
    d.innerHTML = `<b>${av.name}</b><div>Owner:${av.owner}</div><pre>${JSON.stringify(av.data)}</pre>`;
    const btn = document.createElement('button'); btn.innerText='Select Part';
    btn.onclick = ()=> selectPartPrompt(av.id);
    d.appendChild(btn);
    a.appendChild(d);
  });
}

async function selectPartPrompt(avatarId){
  const slot = prompt('Slot (head/torso/leftArm/rightArm/leftLeg/rightLeg)');
  const assetId = prompt('Asset ID (number)');
  const token = localStorage.token;
  const r = await fetch(base + `/avatars/${avatarId}/select-part`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({slot,asset_id:parseInt(assetId,10)})});
  const j = await r.json();
  if (j.ok) { alert('Updated'); listAvatars(); }
  else alert(JSON.stringify(j));
}

// Play / chat
let socket;
function joinRoom(){
  const room = el('room').value;
  socket = io();
  socket.emit('joinRoom', room);
  socket.on('chatMessage', m => {
    const c = el('chat'); const eln = document.createElement('div'); eln.innerText = `${m.user||'anon'}: ${m.message}`; c.appendChild(eln); c.scrollTop = c.scrollHeight;
  });
}
function sendMsg(){
  const room = el('room').value; const msg = el('msg').value;
  socket.emit('chatMessage',{room,message:msg,user:localStorage.token? 'me':''});
  el('msg').value='';
}

// event listeners
el('btnRegister').onclick = register;
el('btnLogin').onclick = login;
el('btnLoadParts').onclick = loadParts;
el('btnCreateAvatar').onclick = createAvatar;
el('btnJoin').onclick = joinRoom;
el('btnSend').onclick = sendMsg;

loadMe(); listAvatars();
