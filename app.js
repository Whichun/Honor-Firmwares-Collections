// robust app.js for Honor-Firmwares-Collections
// - 自动检测/创建回退 DOM 节点，避免因缺少 id 导致的 TypeError
// - 兼容“表格风格”（tableBody）和“卡片风格”（fileList）两种 UI
// - 点击文件名会打开它的 link（新标签）
// - 若 data/files.json 加载失败，会在页面上显示错误信息和 console 输出

const DATA_PATH = 'data/files.json';
let DATA = { folders: [] };
let currentFolderId = null;

// --- DOM helpers ---
function getEl(id) { return document.getElementById(id); }
function createEl(id, tag='div', className='') {
  const el = document.createElement(tag);
  el.id = id;
  if (className) el.className = className;
  return el;
}
function ensureContainer(id, tag='div', className='') {
  let el = getEl(id);
  if (el) return el;
  // find reasonable parent: .content, main, body
  const parent = document.querySelector('.content') || document.querySelector('main') || document.body;
  el = createEl(id, tag, className);
  // minimal styling to avoid layout break
  if(tag==='div') el.style.padding = '8px';
  parent.insertBefore(el, parent.firstChild || null);
  console.warn(`[app.js] 自动创建回退元素 #${id}，插入到 <${parent.tagName.toLowerCase()}>`);
  return el;
}

// --- UI detection helpers ---
function isTableUI() {
  return !!getEl('tableBody') || !!document.querySelector('.file-table') || !!document.querySelector('#fileTable');
}
function isCardUI() {
  return !!getEl('fileList') || !!document.querySelector('.file-list');
}

// --- JSON loader ---
async function loadData() {
  try {
    const res = await fetch(DATA_PATH + '?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
    const txt = await res.text();
    DATA = JSON.parse(txt || '{}');
    if (!Array.isArray(DATA.folders)) DATA.folders = [];
    normalize(DATA);
    console.info('[app.js] data/files.json 加载成功');
  } catch (e) {
    console.error('[app.js] 加载 data/files.json 失败：', e);
    showErrorOnPage('加载 data/files.json 失败：' + e.message);
    DATA = { folders: [] };
  }
}

function normalize(data) {
  if(!data) return;
  if(!Array.isArray(data.folders)) data.folders = [];
  const rec = (arr) => {
    arr.forEach(f => {
      if(!Array.isArray(f.items)) f.items = [];
      if(!Array.isArray(f.folders)) f.folders = [];
      rec(f.folders);
    });
  };
  rec(data.folders);
}

// --- find folder by id in tree ---
function findFolder(id) {
  let found = null;
  function walk(list, parent) {
    for (const f of list) {
      if (f.id === id) { found = { folder: f, parent }; return true; }
      if (f.folders && f.folders.length) {
        if (walk(f.folders, f)) return true;
      }
    }
    return false;
  }
  walk(DATA.folders, null);
  return found;
}

// --- rendering ---
function showErrorOnPage(msg) {
  if (isTableUI()) {
    const rows = ensureContainer('tableBody', 'tbody');
    rows.innerHTML = `<tr><td colspan="3" style="padding:18px;color:#a33;background:#fff7f7;border-radius:8px">${escapeHtml(msg)}</td></tr>`;
  } else {
    const fl = ensureContainer('fileList','div','file-list');
    fl.innerHTML = `<div class="no-data" style="color:#a33;padding:18px;background:#fff7f7;border-radius:8px">${escapeHtml(msg)}</div>`;
  }
}

function escapeHtml(s){ if(s===undefined||s===null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderSidebar() {
  const sb = ensureContainer('sidebar','aside','sidebar');
  sb.innerHTML = '';
  const head = document.createElement('div');
  head.textContent = '目录';
  head.style.fontWeight = '600';
  head.style.marginBottom = '8px';
  sb.appendChild(head);
  (DATA.folders || []).forEach(f => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.textContent = f.title + ' ' + (f.items && f.items.length ? '('+f.items.length+')' : '');
    div.onclick = ()=> openFolder(f.id);
    if(f.id === currentFolderId) div.classList.add('active');
    sb.appendChild(div);
  });
}

function renderAsTable() {
  // ensure tableBody exists
  const tbody = ensureContainer('tableBody', 'tbody');
  // if table is defined in DOM, place tbody inside it
  const realTable = document.querySelector('.file-table') || getEl('fileTable');
  if (realTable && !realTable.querySelector('tbody')) {
    realTable.appendChild(tbody);
  }
  tbody.innerHTML = '';
  const noDataDiv = ensureContainer('noData','div','no-data');
  noDataDiv.style.display = 'none';

  const info = currentFolderId ? findFolder(currentFolderId) : null;
  const subfolders = info ? (info.folder.folders || []) : (DATA.folders || []);
  const items = info ? (info.folder.items || []) : [];

  if(subfolders.length === 0 && items.length === 0) {
    noDataDiv.style.display = 'block';
    noDataDiv.textContent = '该文件夹为空';
    return;
  }

  subfolders.forEach(sf => {
    const tr = document.createElement('tr');
    const tdName = document.createElement('td');
    tdName.className = 'col-name';
    const a = document.createElement('a'); a.href='#'; a.textContent = '📁 ' + (sf.title || 'untitled');
    a.onclick = (e)=>{ e.preventDefault(); openFolder(sf.id); };
    tdName.appendChild(a);
    const tdDate = document.createElement('td'); tdDate.className='col-date'; tdDate.textContent = sf.mtime || '';
    const tdSize = document.createElement('td'); tdSize.className='col-size'; tdSize.textContent = sf.size || '';
    tr.appendChild(tdName); tr.appendChild(tdDate); tr.appendChild(tdSize);
    tbody.appendChild(tr);
  });

  items.forEach(it => {
    const tr = document.createElement('tr');
    const tdName = document.createElement('td');
    tdName.className = 'col-name';
    const a = document.createElement('a');
    a.href = it.link || '#';
    a.textContent = it.name || (it.id || 'unnamed');
    a.target = '_blank';
    a.rel = 'noopener';
    // allow click anywhere in name cell to open
    tdName.appendChild(a);
    tdName.onclick = (e) => {
      if(e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'a') return;
      if(it.link) window.open(it.link, '_blank', 'noopener');
    };
    const tdDate = document.createElement('td'); tdDate.className='col-date'; tdDate.textContent = it.mtime || '';
    const tdSize = document.createElement('td'); tdSize.className='col-size'; tdSize.textContent = it.size || '';
    tr.appendChild(tdName); tr.appendChild(tdDate); tr.appendChild(tdSize);
    tbody.appendChild(tr);
  });
}

function renderAsCards() {
  const fl = ensureContainer('fileList', 'div', 'file-list');
  fl.innerHTML = '';
  const info = currentFolderId ? findFolder(currentFolderId) : null;
  const folders = info ? (info.folder.folders || []) : (DATA.folders || []);
  const items = info ? (info.folder.items || []) : [];

  if(folders.length === 0 && items.length === 0) {
    fl.innerHTML = '<div class="no-data">该文件夹为空</div>';
    return;
  }

  folders.forEach(sf => {
    const card = document.createElement('div'); card.className = 'card';
    const name = document.createElement('div'); name.innerHTML = `<a href="#" class="name-link">📁 ${escapeHtml(sf.title)}</a>`;
    name.querySelector('a').onclick = (e)=>{ e.preventDefault(); openFolder(sf.id); };
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = sf.description || '';
    card.appendChild(name); card.appendChild(meta); fl.appendChild(card);
  });

  items.forEach(it => {
    const card = document.createElement('div'); card.className='card';
    const name = document.createElement('div');
    const a = document.createElement('a'); a.href = it.link || '#'; a.textContent = it.name || (it.id||'unnamed');
    a.target = '_blank'; a.rel='noopener';
    name.appendChild(a);
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = (it.size ? '大小: ' + it.size : '') + (it.mtime ? ' · ' + it.mtime : '');
    const tags = document.createElement('div'); tags.className='tags'; tags.textContent = (it.tags||[]).join(', ');
    card.appendChild(name); card.appendChild(tags); card.appendChild(meta);
    fl.appendChild(card);
  });
}

// render current view depending on detected UI
function renderCurrent() {
  // breadcrumb and folderTitle ensure
  const breadcrumb = ensureContainer('breadcrumb','div','breadcrumb');
  const folderTitle = ensureContainer('folderTitle','div','folder-title');

  const path = buildBreadCrumbPath(currentFolderId);
  breadcrumb.innerHTML = path.map((p, i) => {
    if(i>0) return ` › <a href="#" data-id="${p.id}">${escapeHtml(p.title)}</a>`;
    return `<a href="#" data-id="${p.id || ''}">${escapeHtml(p.title)}</a>`;
  }).join('');
  // attach click handlers on breadcrumb anchors
  breadcrumb.querySelectorAll('a[data-id]').forEach(a=>{
    a.onclick = (e)=>{ e.preventDefault(); const id = a.getAttribute('data-id'); if(!id) openFolder(null); else openFolder(id); };
  });

  const cur = currentFolderId ? findFolder(currentFolderId) : null;
  folderTitle.textContent = cur ? (cur.folder.title + (cur.folder.description ? ' — ' + cur.folder.description : '')) : '全部文件';

  if(isTableUI()) renderAsTable();
  else renderAsCards();
}

// build breadcrumb path array (root + intermediates)
function buildBreadCrumbPath(id) {
  // if id null -> return [{id:null,title:'全部文件'}]
  const out = [{id:null,title:'全部文件'}];
  if(!id) return out;
  // DFS to find path
  let path = null;
  function walk(list, acc) {
    for(const f of list) {
      const cur = acc.concat([{id:f.id,title:f.title}]);
      if(f.id === id) { path = cur; return true; }
      if(f.folders && f.folders.length) {
        if(walk(f.folders, cur)) return true;
      }
    }
    return false;
  }
  walk(DATA.folders, []);
  if(path) out.push(...path);
  return out;
}

// open folder
function openFolder(id) {
  currentFolderId = id || null;
  try {
    renderSidebar();
    renderCurrent();
  } catch (e) {
    console.error('[app.js] openFolder 渲染出错：', e);
    showErrorOnPage('渲染错误：' + e.message);
  }
}

// search: if input exists, wire it
function setupSearch() {
  const s = getEl('search') || document.querySelector('.search') || document.querySelector('input[placeholder*="搜索"]');
  if(!s) return;
  s.addEventListener('input', ()=>{
    const q = s.value.trim().toLowerCase();
    if(!q) { renderCurrent(); return; }
    // flat search across tree
    const matches = [];
    function walk(list, curPath) {
      list.forEach(f=>{
        const path = curPath.concat([f.title]).join(' / ');
        if((f.title||'').toLowerCase().includes(q) || (f.description||'').toLowerCase().includes(q)) {
          matches.push({type:'folder', folder:f, path});
        }
        (f.items||[]).forEach(it=>{
          const hay = ((it.name||'') + ' ' + (it.subtitle||'') + ' ' + (it.tags||[]).join(' ')).toLowerCase();
          if(hay.includes(q)) matches.push({type:'item', item:it, path});
        });
        if(f.folders && f.folders.length) walk(f.folders, curPath.concat([f.title]));
      });
    }
    walk(DATA.folders, []);
    // render matches as table/card
    if(isTableUI()){
      const tbody = ensureContainer('tableBody','tbody');
      tbody.innerHTML = '';
      if(matches.length===0){ ensureContainer('noData','div').textContent='未找到匹配项'; return; }
      matches.forEach(m=>{
        const tr = document.createElement('tr');
        const tdName = document.createElement('td');
        tdName.className = 'col-name';
        if(m.type==='folder'){
          const a = document.createElement('a'); a.href='#'; a.textContent = '📁 ' + (m.folder.title || '') + ' — ' + m.path;
          a.onclick = (e)=>{ e.preventDefault(); openFolder(m.folder.id); };
          tdName.appendChild(a);
        } else {
          const a = document.createElement('a'); a.href = m.item.link || '#'; a.textContent = m.item.name + ' — ' + m.path;
          a.target = '_blank'; a.rel='noopener';
          tdName.appendChild(a);
        }
        const tdDate = document.createElement('td'); tdDate.className='col-date'; tdDate.textContent = (m.item && m.item.mtime) || (m.folder && m.folder.mtime) || '';
        const tdSize = document.createElement('td'); tdSize.className='col-size'; tdSize.textContent = (m.item && m.item.size) || (m.folder && m.folder.size) || '';
        tr.appendChild(tdName); tr.appendChild(tdDate); tr.appendChild(tdSize);
        tbody.appendChild(tr);
      });
    } else {
      const fl = ensureContainer('fileList','div');
      fl.innerHTML = '';
      if(matches.length===0){ fl.innerHTML = '<div class="no-data">未找到匹配项</div>'; return; }
      matches.forEach(m=>{
        const card = document.createElement('div'); card.className='card';
        if(m.type==='folder'){
          const a = document.createElement('a'); a.href='#'; a.textContent = '📁 ' + m.folder.title + ' — ' + m.path;
          a.onclick = (e)=>{ e.preventDefault(); openFolder(m.folder.id); };
          card.appendChild(a);
        } else {
          const a = document.createElement('a'); a.href = m.item.link || '#'; a.textContent = m.item.name + ' — ' + m.path;
          a.target='_blank'; a.rel='noopener';
          card.appendChild(a);
        }
        fl.appendChild(card);
      });
    }
  });
}

// init
window.addEventListener('DOMContentLoaded', async ()=>{
  // ensure minimal nodes exist so script never does document.getElementById(...).textContent on null
  ensureContainer('sidebar','aside','sidebar');
  ensureContainer('breadcrumb','div','breadcrumb');
  ensureContainer('folderTitle','div','folder-title');
  // tableBody may belong inside a table; we create tbody but if page has table we append it later in renderAsTable
  ensureContainer('tableBody','tbody');
  ensureContainer('fileList','div','file-list');
  ensureContainer('noData','div','no-data');

  await loadData();
  // default to first top-level folder if present
  if(DATA.folders && DATA.folders.length) openFolder(DATA.folders[0].id);
  else openFolder(null);
  setupSearch();
});
