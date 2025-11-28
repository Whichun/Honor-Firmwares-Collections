// debug 版 app.js — 在页面上显示加载/解析错误，便于定位
const DATA_PATH = 'data/files.json'
let DATA = { folders: [] }
let currentFolderId = null

async function loadData(){
  try{
    const res = await fetch(DATA_PATH + '?t=' + Date.now())
    if(!res.ok){
      throw new Error('HTTP ' + res.status + ' ' + res.statusText + ' — 请求 URL: ' + res.url)
    }
    const txt = await res.text()
    try{
      DATA = JSON.parse(txt)
    }catch(parseErr){
      // 抛出包含部分响应内容的错误，方便定位 JSON 语法问题
      const snippet = txt ? txt.slice(0, 1000).replace(/</g,'&lt;') : '(empty)'
      throw new Error('JSON 解析错误: ' + parseErr.message + '\\nJSON 片段: ' + snippet)
    }
  }catch(e){
    console.error('loadData error:', e)
    const fileList = document.getElementById('fileList')
    if(fileList){
      fileList.innerHTML = '<div class="no-data">加载 <code>data/files.json</code> 失败：' + escapeHtml(e.message) + '</div>'
    } else {
      alert('加载 data/files.json 失败：' + e.message)
    }
    // 保证 DATA 有默认结构，不让后续渲染崩溃
    DATA = { folders: [] }
    return
  }
}

function el(tag, cls, txt){ const node = document.createElement(tag); if(cls) node.className = cls; if(txt!==undefined) node.textContent = txt; return node }

function renderSidebar(){
  const sb = document.getElementById('sidebar')
  if(!sb) return
  sb.innerHTML = ''
  const h = el('div','side-head','目录')
  sb.appendChild(h)

  DATA.folders.forEach(f => {
    const item = el('div','folder-item', f.title)
    item.title = f.description || ''
    item.onclick = ()=>{ openFolder(f.id) }
    if(f.id === currentFolderId) item.classList.add('active')
    sb.appendChild(item)
  })
}

function openFolder(id){
  currentFolderId = id
  const folder = DATA.folders.find(f=>f.id===id)
  document.getElementById('breadcrumb').textContent = folder ? folder.title : '首页'
  document.getElementById('folderTitle').textContent = folder ? (folder.description || '') : ''

  const fileList = document.getElementById('fileList')
  fileList.innerHTML = ''
  if(!folder || !folder.items || folder.items.length===0){
    fileList.innerHTML = '<div class="no-data">该文件夹为空 — 你可以通过编辑 data/files.json 添加条目。</div>'
    renderSidebar();
    return
  }

  folder.items.forEach(it=>{
    const card = el('div','card')
    const name = el('div','name', it.name)
    const subtitle = el('div','subtitle', it.subtitle || '')
    const meta = el('div','meta', it.size ? ('大小：' + it.size) : '')
    const tagsWrap = el('div','tags')
    if(it.tags && it.tags.length) it.tags.forEach(t=>{ const tg = el('span','tag', t); tagsWrap.appendChild(tg) })
    const openBtn = el('a','', '打开')
    openBtn.href = it.link || '#'
    openBtn.target = '_blank'
    openBtn.rel = 'noopener'
    card.appendChild(name)
    card.appendChild(subtitle)
    card.appendChild(tagsWrap)
    card.appendChild(meta)
    card.appendChild(openBtn)
    fileList.appendChild(card)
  })

  renderSidebar()
}

function renderAll(){
  if(DATA.folders.length>0){ openFolder(DATA.folders[0].id) } else { openFolder(null) }
}

function setupSearch(){
  const input = document.getElementById('search')
  if(!input) return
  input.addEventListener('input', ()=>{
    const q = input.value.trim().toLowerCase()
    if(!q){ renderAll(); return }

    const results = []
    DATA.folders.forEach(f=>{
      f.items && f.items.forEach(it=>{
        if((it.name && it.name.toLowerCase().includes(q)) || (it.subtitle && it.subtitle.toLowerCase().includes(q)) || (it.tags && it.tags.join(' ').toLowerCase().includes(q))){
          results.push(Object.assign({ folderTitle: f.title }, it))
        }
      })
    })

    const fileList = document.getElementById('fileList')
    fileList.innerHTML = ''
    if(results.length===0){ fileList.innerHTML = '<div class="no-data">未找到匹配项</div>'; return }

    results.forEach(it=>{
      const card = document.createElement('div'); card.className='card'
      card.innerHTML = `<div class="name">${escapeHtml(it.name)}</div><div class="subtitle">${escapeHtml(it.subtitle||'')} — <em>${escapeHtml(it.folderTitle||'')}</em></div>`
      const openBtn = document.createElement('a'); openBtn.href = it.link || '#'; openBtn.target = '_blank'; openBtn.rel='noopener'; openBtn.textContent='打开'
      card.appendChild(openBtn)
      fileList.appendChild(card)
    })
  })
}

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

async function init(){
  await loadData()
  renderSidebar()
  renderAll()
  setupSearch()
}

window.addEventListener('DOMContentLoaded', init)
