// Table-style file browser — supports nested folders (folders[].folders) and items.
// Click file name to open external link (download if direct file URL).
const DATA_PATH = 'data/files.json';
let DATA = { folders: [] };
let currentFolderId = null;

// Load JSON (with cache-bust)
async function loadData(){
  try {
    const r = await fetch(DATA_PATH + '?t=' + Date.now());
    if(!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);
    const txt = await r.text();
    DATA = JSON.parse(txt);
    normalize(DATA);
  } catch (e) {
    console.error('loadData error', e);
    showError('加载 data/files.json 失败：' + e.message);
    DATA = { folders: [] };
  }
}

function normalize(data){
  if(!data || !Array.isArray(data.folders)) data.folders = [];
  const norm = (arr) => {
    arr.forEach(f => {
      if(!Array.isArray(f.folders)) f.folders = [];
      if(!Array.isArray(f.items)) f.items = [];
      norm(f.folders);
    });
  };
  norm(data.folders);
}

// Find folder by id and return { folder, parent }
function findFolder(id){
  let found = null;
  function walk(list, parent){
    for(const f of list){
      if(f.id === id) { found = { folder: f, parent }; return true; }
      if(f.folders && f.folders.length){
        if(walk(f.folders, f)) return true;
      }
    }
    return false;
  }
  walk(DATA.folders, null);
  return found;
}

// get path array of folder ids/titles to build breadcrumb
function getPathTo(id){
  const path = [];
  function walk(list, parents){
    for(const f of list){
      const curPath = parents.concat([{id:f.id, title:f.title}]);
      if(f.id === id) { path.push(...curPath); return true; }
      if(f.folders && f.folders.length){
        if(walk(f.folders, curPath)) return true;
      }
    }
    return false;
  }
  if(id === null){
    return [];
  }
  walk(DATA.folders, []);
  return path;
}

// Render sidebar tree (simple flat list of top-level folders)
function renderSidebar(){
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';
  const list = DATA.folders || [];
  list.forEach(f=>{
    const el = document.createElement('div');
    el.className = 'folder-item' + (f.id === currentFolderId ? ' active' : '');
    el.textContent = f.title + (f.items ? ` (${f.items.length})` : '');
    el.onclick = ()=> { openFolder(f.id); };
    sb.appendChild(el);
  });
}

// Render breadcrumb & table rows
function renderCurrent(){
  const breadcrumb = document.getElementById('breadcrumb');
  const rows = document.getElementById('tableBody');
  const noData = document.getElementById('noData');
  rows.innerHTML = '';
  noData.style.display = 'none';

  const info = findFolder(currentFolderId);
  const folder = info ? info.folder : null;

  // breadcrumb
  const path = getPathTo(currentFolderId);
  const bc = ['全部文件'].concat(path.map(p=>p.title));
  breadcrumb.innerHTML = '';
  const frag = document.createDocumentFragment();
  // make clickable path
  const rootLink = document.createElement('a'); rootLink.href = '#'; rootLink.textContent = '全部文件';
  rootLink.onclick = (e)=>{ e.preventDefault(); openFolder(null); };
  frag.appendChild(rootLink);
  path.forEach((p, idx) => {
    const sep = document.createElement('span'); sep.textContent = '  ›  '; frag.appendChild(sep);
    const a = document.createElement('a'); a.href='#'; a.textContent = p.title;
    a.onclick = (e)=>{ e.preventDefault(); openFolder(p.id); };
    frag.appendChild(a);
  });
  breadcrumb.appendChild(frag);

  // show subfolders first
  const subfolders = folder ? (folder.folders || []) : DATA.folders || [];
  const items = folder ? (folder.items || []) : [];

  if(subfolders.length === 0 && items.length === 0){
    noData.style.display = 'block';
    return;
  }

  // render subfolders rows
  subfolders.forEach(sf=>{
    const tr = document.createElement('tr'); tr.className = 'row-folder';
    const tdName = document.createElement('td'); tdName.className='col-name';
    const nameLink = document.createElement('a'); nameLink.className='name-link'; nameLink.href = '#';
    nameLink.innerHTML = `<span class="icon folder">📁</span>${escapeHtml(sf.title)}`;
    nameLink.onclick = (e)=>{ e.preventDefault(); openFolder(sf.id); };
    tdName.appendChild(nameLink);
    const tdDate = document.createElement('td'); tdDate.className='col-date'; tdDate.textContent = sf.mtime || '';
    const tdSize = document.createElement('td'); tdSize.className='col-size'; tdSize.textContent = (sf.size || '');
    tr.appendChild(tdName); tr.appendChild(tdDate); tr.appendChild(tdSize);
    rows.appendChild(tr);
  });

  // render item rows (files)
  items.forEach(it=>{
    const tr = document.createElement('tr'); tr.className = 'row-file';
    const tdName = document.createElement('td'); tdName.className='col-name';
    const a = document.createElement('a'); a.className = 'name-link'; a.href = it.link || '#';
    a.textContent = it.name;
    a.target = '_blank'; a.rel = 'noopener';
    // If you prefer click opens directly (and not open new tab), comment the previous two lines and use below:
    // a.onclick = (e) => { e.preventDefault(); window.location.href = it.link || '#'; };
    tdName.innerHTML = `<span class="icon file">📄</span>`;
    tdName.appendChild(a);

    // also allow clicking the whole name cell to open
    tdName.onclick = (e)=> {
      // avoid double-handling when clicking the anchor itself
      if(e.target && e.target.tagName.toLowerCase() === 'a') return;
      if(it.link) window.open(it.link, '_blank', 'noopener');
    };

    const tdDate = document.createElement('td'); tdDate.className='col-date'; tdDate.textContent = it.mtime || '';
    const tdSize = document.createElement('td'); tdSize.className='col-size'; tdSize.textContent = it.size || '';
    tr.appendChild(tdName); tr.appendChild(tdDate); tr.appendChild(tdSize);
    rows.appendChild(tr);
  });
}

// Escape html
function escapeHtml(s){ if(!s && s!==0) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Open folder (id or null->root)
function openFolder(id){
  currentFolderId = id || null;
  renderSidebar();
  renderCurrent();
}

// Search (global across titles / items / tags) — simple filter: if search active, show filtered items across tree
function setupSearch(){
  const input = document.getElementById('search');
  input.addEventListener('input', ()=> {
    const q = input.value.trim().toLowerCase();
    if(!q){ renderSidebar(); renderCurrent(); return; }
    // collect matches (items and folders) and render them in table as flat results
    const rows = document.getElementById('tableBody'); rows.innerHTML = '';
    const noData = document.getElementById('noData'); noData.style.display='none';
    const matches = [];
    // folders
    function walkFolder(arr, parentPath){
      arr.forEach(f=>{
        const pathTitle = parentPath.concat([f.title]).join(' / ');
        if((f.title||'').toLowerCase().includes(q) || (f.description||'').toLowerCase().includes(q)){
          matches.push({type:'folder', title:f.title, id:f.id, mtime:f.mtime || '', size:f.size || '', path: pathTitle});
        }
        (f.items||[]).forEach(it=>{
          const hay = ((it.name||'') + ' ' + (it.subtitle||'') + ' ' + (it.tags||[]).join(' ')).toLowerCase();
          if(hay.includes(q)) matches.push({type:'item', item:it, path: pathTitle, folderId:f.id});
        });
        if(f.folders && f.folders.length) walkFolder(f.folders, parentPath.concat([f.title]));
      });
    }
    walkFolder(DATA.folders, []);

    if(matches.length === 0){ noData.style.display='block'; return; }
    // render matches
    matches.forEach(m=>{
      const tr = document.createElement('tr');
      const tdName = document.createElement('td'); tdName.className='col-name';
      if(m.type === 'folder'){
        const a = document.createElement('a'); a.href='#'; a.textContent = '📁 ' + m.title + '  — ' + m.path;
        a.onclick = (e)=>{ e.preventDefault(); openFolder(m.id); };
        tdName.appendChild(a);
      } else {
        const a = document.createElement('a'); a.href = m.item.link || '#'; a.textContent = m.item.name + '  — ' + m.path;
        a.target = '_blank'; a.rel='noopener';
        tdName.appendChild(a);
      }
      const tdDate = document.createElement('td'); tdDate.className='col-date'; tdDate.textContent = m.mtime || (m.item && m.item.mtime) || '';
      const tdSize = document.createElement('td'); tdSize.className='col-size'; tdSize.textContent = m.size || (m.item && m.item.size) || '';
      tr.appendChild(tdName); tr.appendChild(tdDate); tr.appendChild(tdSize);
      rows.appendChild(tr);
    });
  });
}

// Show error on page
function showError(msg){
  const rows = document.getElementById('tableBody');
  rows.innerHTML = `<tr><td colspan="3" style="padding:20px;color:#a33;background:#fff1f1;border-radius:8px">${escapeHtml(msg)}</td></tr>`;
  document.getElementById('noData').style.display = 'none';
}

// init
(async function init(){
  await loadData();
  // try to open first top-level folder, otherwise root
  if(DATA.folders && DATA.folders.length) openFolder(DATA.folders[0].id);
  else openFolder(null);
  setupSearch();
})();
