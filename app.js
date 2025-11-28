// 防守/调试版 app.js
// 当页面缺少期望的 DOM 节点时会自动创建回退节点并在页面可见区域输出错误信息。
// 兼容最常见的数据结构：{ folders: [ { id, title, description, items: [...], folders: [...] } ] }

const DATA_PATH = 'data/files.json';
let DATA = { folders: [] };
let currentFolderId = null;

// helper: get element or create one inside .content (or body)
function getOrCreate(id, tag = 'div', className = '') {
  let el = document.getElementById(id);
  if (el) return el;

  // try to find a sensible parent
  let parent = document.querySelector('.content') || document.body;
  el = document.createElement(tag);
  el.id = id;
  if (className) el.className = className;
  // minimal styles so created elements are visible
  if (tag === 'div') {
    el.style.padding = '8px';
  }
  parent.insertBefore(el, parent.firstChild);
  console.warn(`自动创建回退元素 #${id} 并插入到 ${parent.tagName.toLowerCase()}`);
  return el;
}

// render helpers (simple card/list UI similar to早期版本)
function el(tag, cls, txt) { const node = document.createElement(tag); if (cls) node.className = cls; if (txt !== undefined) node.textContent = txt; return node; }

function showPageMessage(msg, isError = false) {
  const fileList = getOrCreate('fileList', 'div', 'file-list');
  const box = document.createElement('div');
  box.style.padding = '12px';
  box.style.borderRadius = '8px';
  box.style.margin = '8px 0';
  box.style.background = isError ? '#fff1f1' : '#f2f7ff';
  box.style.color = isError ? '#8a1b1b' : '#0b3a8a';
  box.textContent = msg;
  fileList.innerHTML = '';
  fileList.appendChild(box);
  console.log(msg);
}

// load JSON with cache bust
async function loadData() {
  try {
    const res = await fetch(DATA_PATH + '?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const txt = await res.text();
    DATA = JSON.parse(txt);
    // normalize
    if (!Array.isArray(DATA.folders)) DATA.folders = [];
    normalizeFolders(DATA.folders);
  } catch (e) {
    console.error('加载 files.json 失败:', e);
    showPageMessage('加载 data/files.json 失败：' + e.message, true);
    DATA = { folders: [] };
  }
}

function normalizeFolders(arr) {
  (arr || []).forEach(f => {
    if (!Array.isArray(f.items)) f.items = [];
    if (!Array.isArray(f.folders)) f.folders = [];
    normalizeFolders(f.folders);
  });
}

// find folder by id (search tree)
function findFolder(id) {
  let result = null;
  function walk(list, parent) {
    for (const f of list) {
      if (f.id === id) { result = { folder: f, parent }; return true; }
      if (f.folders && f.folders.length) {
        if (walk(f.folders, f)) return true;
      }
    }
    return false;
  }
  walk(DATA.folders, null);
  return result;
}

// render sidebar (top-level folders)
function renderSidebar() {
  const sb = getOrCreate('sidebar', 'aside', 'sidebar');
  sb.innerHTML = '';
  const head = el('div', 'side-head', '目录');
  sb.appendChild(head);
  (DATA.folders || []).forEach(f => {
    const item = el('div', 'folder-item', `${f.title} (${(f.items||[]).length})`);
    item.title = f.description || '';
    item.onclick = () => openFolder(f.id);
    if (f.id === currentFolderId) item.classList.add('active');
    sb.appendChild(item);
  });
}

// render current folder - compatible with simple UI (fileList) used earlier
function renderCurrent() {
  const breadcrumb = getOrCreate('breadcrumb', 'div', 'breadcrumb');
  const folderTitle = getOrCreate('folderTitle', 'div', 'folder-title');
  const fileList = getOrCreate('fileList', 'div', 'file-list');

  const info = currentFolderId ? findFolder(currentFolderId) : null;
  breadcrumb.textContent = info ? (info.folder.title) : '首页';
  folderTitle.textContent = info ? (info.folder.description || '') : '';

  fileList.innerHTML = '';

  if (!info || (!info.folder.items || info.folder.items.length === 0) && (!info.folder.folders || info.folder.folders.length === 0)) {
    fileList.innerHTML = '<div class="no-data">该文件夹为空</div>';
    return;
  }

  // show subfolders first
  (info ? info.folder.folders : DATA.folders).forEach(sf => {
    const card = el('div', 'card');
    const name = el('div', 'name');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = '📁 ' + sf.title;
    a.onclick = (e) => { e.preventDefault(); openFolder(sf.id); };
    name.appendChild(a);
    const meta = el('div', 'meta', sf.description || '');
    card.appendChild(name); card.appendChild(meta);
    fileList.appendChild(card);
  });

  // show items
  (info ? info.folder.items : []).forEach(it => {
    const card = el('div', 'card');
    const name = el('div', 'name');
    const a = document.createElement('a');
    a.href = it.link || '#';
    a.textContent = it.name;
    // open in new tab to preserve site
    a.target = '_blank';
    a.rel = 'noopener';
    name.appendChild(a);
    const subtitle = el('div', 'subtitle', it.subtitle || '');
    const meta = el('div', 'meta', (it.size ? '大小：' + it.size : '') + (it.mtime ? '  ·  ' + it.mtime : ''));
    const tagsWrap = el('div', 'tags', (it.tags || []).join(', '));
    card.appendChild(name); card.appendChild(subtitle); card.appendChild(tagsWrap); card.appendChild(meta);
    fileList.appendChild(card);
  });
}

// open folder
function openFolder(id) {
  currentFolderId = id || null;
  // protect against missing DOM: getOrCreate will create fallback nodes if needed
  try {
    renderSidebar();
    renderCurrent();
  } catch (e) {
    console.error('openFolder 内部渲染错误：', e);
    showPageMessage('渲染错误：' + e.message, true);
  }
}

function renderAll() {
  if (DATA.folders && DATA.folders.length > 0) {
    openFolder(DATA.folders[0].id);
  } else {
    openFolder(null);
  }
}

// search - simple (if you have a search UI), otherwise keep stub
function setupSearch() {
  const input = document.getElementById('search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    // simple implementation: if empty, show folder; else show flat matches
    if (!q) { renderAll(); return; }
    const fileList = getOrCreate('fileList', 'div', 'file-list');
    fileList.innerHTML = '';
    const matches = [];
    function walk(list, path) {
      for (const f of list) {
        const curPath = path ? (path + ' / ' + f.title) : f.title;
        if ((f.title || '').toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q)) {
          matches.push({ type: 'folder', title: f.title, path: curPath, id: f.id });
        }
        (f.items || []).forEach(it => {
          const hay = ((it.name || '') + ' ' + (it.subtitle || '') + ' ' + (it.tags || []).join(' ')).toLowerCase();
          if (hay.includes(q)) matches.push({ type: 'item', item: it, path: curPath, folderId: f.id });
        });
        if (f.folders && f.folders.length) walk(f.folders, curPath);
      }
    }
    walk(DATA.folders, '');
    if (matches.length === 0) { fileList.innerHTML = '<div class="no-data">未找到匹配项</div>'; return; }
    matches.forEach(m => {
      const row = el('div', 'card');
      if (m.type === 'folder') {
        const a = document.createElement('a'); a.href = '#'; a.textContent = '📁 ' + m.title + '  — ' + m.path;
        a.onclick = (e) => { e.preventDefault(); openFolder(m.id); };
        row.appendChild(a);
      } else {
        const a = document.createElement('a'); a.href = m.item.link || '#'; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = m.item.name + '  — ' + m.path;
        row.appendChild(a);
      }
      fileList.appendChild(row);
    });
  });
}

// init
window.addEventListener('DOMContentLoaded', async () => {
  // ensure minimal expected containers exist so code never sets textContent on null
  getOrCreate('sidebar', 'aside', 'sidebar');
  getOrCreate('breadcrumb', 'div', 'breadcrumb');
  getOrCreate('folderTitle', 'div', 'folder-title');
  getOrCreate('fileList', 'div', 'file-list');

  await loadData();
  renderSidebar();
  renderAll();
  setupSearch();
});
