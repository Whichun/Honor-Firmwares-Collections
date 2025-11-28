// 简单的静态文件浏览器---从 data/files.json 加载数据并渲染


const DATA_PATH = 'data/files.json'
let DATA = { folders: [] }
let currentFolderId = null


async function loadData(){
try{
const res = await fetch(DATA_PATH + '?t=' + Date.now())
DATA = await res.json()
}catch(e){
console.error('加载 data/files.json 失败：', e)
DATA = { folders: [] }
}
}


function el(tag, cls, txt){ const node = document.createElement(tag); if(cls) node.className = cls; if(txt!==undefined) node.textContent = txt; return node }


function renderSidebar(){
const sb = document.getElementById('sidebar')
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


window.addEventListener('DOMContentLoaded', init)