async function api(path, opts={}){
  const headers = Object.assign({}, opts.headers || {});
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = 'Bearer '+token;
  const res = await fetch(path, Object.assign({}, opts, { headers }));
  try { return await res.json(); } catch(e){ return { ok: false, error: 'invalid-json' }; }
}

async function loadParts(){
  const j = await api('/avatar-parts');
  const container = document.getElementById('recent-parts'); if (!container) return;
  container.innerHTML = '';
  const bySlot = {};
  (j.parts||[]).forEach(p => { bySlot[p.slot] = bySlot[p.slot] || []; bySlot[p.slot].push(p); });
  Object.keys(bySlot).forEach(slot=>{
    const h = document.createElement('h4'); h.innerText = slot; container.appendChild(h);
    bySlot[slot].forEach(p => {
      const d = document.createElement('div'); d.className='part-card'; d.innerText = `${p.name} (${p.gender})`; d.dataset.id = p.id; d.dataset.slot = p.slot;
      d.onclick = ()=> selectPartUI(d);
      container.appendChild(d);
    });
  });
}

let currentAvatarId = null;
let currentAvatarData = null; // cached avatar data object
let autosaveTimer = null;
let saveSeq = 0;

async function loadAvatars(){
  const j = await api('/avatars');
  const avs = document.getElementById('avatars'); avs.innerHTML='';
  (j.avatars||[]).forEach(a => {
    const d = document.createElement('div'); d.className='avatar-card';
    d.dataset.avatarId = a.id;
    d.innerHTML = `<b>${a.name}</b>`;
    d.addEventListener('click', ()=> selectAvatar(a.id));
    avs.appendChild(d);
  });
}

async function selectAvatar(id){
  // visually mark
  document.querySelectorAll('.avatar-card').forEach(c=>c.style.background='');
  const card = document.querySelector(`.avatar-card[data-avatar-id='${id}']`);
  if (card) card.style.background = '#eef7ff';
  currentAvatarId = id;
  const j = await api('/avatars');
  const av = (j.avatars||[]).find(x=>x.id===id);
  if (!av) return;
  currentAvatarData = av;
  // populate color inputs
  const colors = (av.data && av.data.colors) || {};
  ['head','torso','leftArm','rightArm','leftLeg','rightLeg'].forEach(s=>{
    const el = document.getElementById('color-'+s);
    if (el) el.value = colors[s] || '#d9d9d9';
  });
  renderPreview();
}

function scheduleAutosave(delay=700){
  if (!currentAvatarId || !currentAvatarData) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(()=> autosaveNow(), delay);
}

async function autosaveNow(){
  if (!currentAvatarId || !currentAvatarData) return;
  const seq = ++saveSeq;
  const statusEl = document.getElementById('save-status'); if (statusEl) statusEl.innerText = 'Saving…';
  try{
    const token = localStorage.getItem('token');
    const r = await fetch(`/avatars/${currentAvatarId}`, { method: 'PUT', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer '+token }, body: JSON.stringify({ name: currentAvatarData.name, data: currentAvatarData.data || {} }) });
    const j = await r.json().catch(()=>({ok:false}));
    if (j && j.ok){ if (statusEl) statusEl.innerText = 'Saved'; setTimeout(()=>{ if (statusEl) statusEl.innerText = ''; },1200); }
    else { if (statusEl) statusEl.innerText = 'Save failed'; }
  }catch(e){ const statusEl2 = document.getElementById('save-status'); if (statusEl2) statusEl2.innerText = 'Save error'; }
}

// Tabs logic
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.panel').forEach(p=>p.style.display='none');
    document.getElementById('panel-'+tab).style.display = '';
  });
});

// Color palette (predefined colors from user snippet)
const palette = [
  'rgb(90, 76, 66)','rgb(124, 92, 70)','rgb(175, 148, 131)','rgb(204, 142, 105)','rgb(234, 184, 146)','rgb(86, 66, 54)','rgb(105, 64, 40)','rgb(188, 155, 93)','rgb(199, 172, 120)','rgb(215, 197, 154)','rgb(149, 121, 119)','rgb(163, 75, 75)','rgb(218, 134, 122)','rgb(255, 201, 201)','rgb(255, 152, 220)','rgb(116, 134, 157)','rgb(82, 124, 174)','rgb(128, 187, 220)','rgb(177, 167, 255)','rgb(167, 94, 155)','rgb(0, 143, 156)','rgb(91, 154, 76)','rgb(124, 156, 107)','rgb(161, 196, 140)','rgb(226, 155, 64)','rgb(245, 205, 48)','rgb(248, 217, 109)','rgb(99, 95, 98)','rgb(205, 205, 205)','rgb(248, 248, 248)'
];

function hexFromRgbString(rgb){
  const m = rgb.match(/\d+/g);
  if (!m) return '#ffffff';
  return '#'+m.map(n=>parseInt(n,10).toString(16).padStart(2,'0')).join('');
}

function buildPalette(){
  const container = document.getElementById('bodycolors-list');
  if (!container) return;
  container.innerHTML = '';
  palette.forEach(c=>{
    const d = document.createElement('div'); d.className='color-dot'; d.style.backgroundColor = c;
    d.onclick = ()=>{
      const active = document.activeElement;
      if (active && active.type === 'color') active.value = hexFromRgbString(c);
      else {
        const head = document.getElementById('color-head'); if (head) head.value = hexFromRgbString(c);
      }
    };
    container.appendChild(d);
  });
}
// listen for color input changes and autosave
['head','torso','leftArm','rightArm','leftLeg','rightLeg'].forEach(s=>{
  const el = document.getElementById('color-'+s);
  if (el){
    el.addEventListener('input', ()=>{
      if (!currentAvatarData) return;
      currentAvatarData.data = currentAvatarData.data || {};
      currentAvatarData.data.colors = currentAvatarData.data.colors || {};
      currentAvatarData.data.colors[s] = el.value;
      renderPreview();
      scheduleAutosave();
    });
  }
});

// select part: update local avatar data and autosave
async function selectPartUI(elem){
  if (!currentAvatarId || !currentAvatarData){ alert('Select an avatar to edit first'); return; }
  const slot = elem.dataset.slot; const asset_id = parseInt(elem.dataset.id,10);
  currentAvatarData.data = currentAvatarData.data || {};
  currentAvatarData.data.parts = currentAvatarData.data.parts || {};
  currentAvatarData.data.parts[slot] = asset_id;
  // visual feedback
  document.querySelectorAll('.part-card').forEach(d=>d.style.outline='');
  elem.style.outline = '3px solid rgba(45,136,255,0.6)';
  // render preview and autosave
  renderPreview();
  scheduleAutosave(500);
}

// Render a simple cuboid R6 preview in SVG using current colors
function renderPreview(){
  const svg = document.getElementById('avatar-svg'); if (!svg) return;
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  const colors = (currentAvatarData && currentAvatarData.data && currentAvatarData.data.colors) || {};
  const get = (k, fallback) => (colors[k] || fallback || '#d9d9d9');
  // head
  const ns = 'http://www.w3.org/2000/svg';
  function rect(x,y,w,h,fill,rx){
    const r = document.createElementNS(ns,'rect'); r.setAttribute('x',x); r.setAttribute('y',y); r.setAttribute('width',w); r.setAttribute('height',h); r.setAttribute('fill',fill); r.setAttribute('stroke','#333'); r.setAttribute('stroke-width','1'); if (rx) r.setAttribute('rx',rx);
    svg.appendChild(r);
  }
  function text(x,y,str){ const t=document.createElementNS(ns,'text'); t.setAttribute('x',x); t.setAttribute('y',y); t.setAttribute('font-size',10); t.setAttribute('fill','#222'); t.textContent=str; svg.appendChild(t); }
  rect(70,20,80,60,get('head','#f2d0c9'));
  rect(60,90,100,90,get('torso','#cfcfcf'));
  rect(20,90,40,80,get('leftArm','#cfcfcf'));
  rect(160,90,40,80,get('rightArm','#cfcfcf'));
  rect(70,190,40,100,get('leftLeg','#cfcfcf'));
  rect(110,190,40,100,get('rightLeg','#cfcfcf'));
  // overlay small labels for parts
  text(80,55,'Head'); text(78,140,'Torso'); text(24,140,'L Arm'); text(164,140,'R Arm'); text(78,255,'L Leg'); text(112,255,'R Leg');
}

document.getElementById('btnLogout').onclick = ()=>{ localStorage.removeItem('token'); location.href='/login'; };

// initial load
loadParts(); loadAvatars(); buildPalette();
