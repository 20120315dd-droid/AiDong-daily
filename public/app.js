// 爱东日常 - 前端逻辑
const STORAGE_KEY = 'aidong_daily_nickname';

// ---------- 状态 ----------
let currentUser = null;
let todayData = null; // { date, fortune, message, cheers, quote, stats }
let cheerLocal = 0;   // 本地连点数（节流后同步到后端）
let cheerSyncTimer = null;

// ---------- DOM 快捷 ----------
const $ = (id) => document.getElementById(id);

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', () => {
  $('today-date').textContent = formatDate(new Date());

  bindEvents();

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    enterMain(saved);
  } else {
    showLogin();
  }
});

function bindEvents() {
  $('login-form').addEventListener('submit', onLogin);
  $('logout-btn').addEventListener('click', onLogout);

  $('draw-btn').addEventListener('click', drawFortune);

  $('msg-save').addEventListener('click', saveMessage);
  $('cheer-btn').addEventListener('click', onCheerClick);
  $('quote-btn').addEventListener('click', drawQuote);

  // 历史
  $('history-btn').addEventListener('click', openHistory);
  $('history-close').addEventListener('click', closeHistory);
  $('history-modal').addEventListener('click', (e) => {
    if (e.target.id === 'history-modal') closeHistory();
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchHistoryTab(btn.dataset.tab));
  });
}

// ---------- 登录 / 退出 ----------
async function onLogin(e) {
  e.preventDefault();
  const name = $('nickname-input').value.trim();
  if (!name) return;
  try {
    const res = await api('POST', '/api/login', { nickname: name });
    localStorage.setItem(STORAGE_KEY, res.nickname);
    enterMain(res.nickname);
  } catch (err) {
    showToast(err.message || '登录失败');
  }
}

function onLogout() {
  if (!confirm('确定要退出吗？数据会保留在服务器上，下次用同样的昵称还能继续。')) return;
  localStorage.removeItem(STORAGE_KEY);
  currentUser = null;
  showLogin();
}

function showLogin() {
  $('login-view').classList.remove('hidden');
  $('main-view').classList.add('hidden');
  $('nickname-input').value = '';
  setTimeout(() => $('nickname-input').focus(), 50);
}

async function enterMain(nickname) {
  currentUser = nickname;
  $('display-name').textContent = nickname;
  $('login-view').classList.add('hidden');
  $('main-view').classList.remove('hidden');
  await reloadToday();
}

// ---------- 拉取今日全部状态 ----------
async function reloadToday() {
  try {
    todayData = await api('GET', `/api/users/${encodeURIComponent(currentUser)}/today`);
    cheerLocal = todayData.cheers || 0;
    renderAll();
  } catch (err) {
    showToast('加载失败：' + err.message);
  }
}

function renderAll() {
  renderFortune();
  renderMessage();
  renderCheer();
  renderQuote();
}

// ---------- A: 今日运势 ----------
function renderFortune() {
  if (!todayData.fortune) {
    $('fortune-empty').classList.remove('hidden');
    $('fortune-card').classList.add('hidden');
    return;
  }
  const f = todayData.fortune;
  $('fortune-empty').classList.add('hidden');
  $('fortune-card').classList.remove('hidden');
  $('fc-mood-emoji').textContent = f.mood?.emoji || '✨';
  $('fc-mood-name').textContent = f.mood?.text || '今天';
  $('fc-stars').textContent = '⭐'.repeat(f.level) + '☆'.repeat(5 - f.level);
  $('fc-good').textContent = f.good;
  $('fc-bad').textContent = f.bad;
  $('fc-color-dot').style.background = f.color?.hex || '#ccc';
  $('fc-color-name').textContent = f.color?.name || '';
  $('fc-number').textContent = f.number;
  $('fc-motto').textContent = '「 ' + f.motto + ' 」';
}

async function drawFortune() {
  const btn = $('draw-btn');
  btn.disabled = true;
  btn.textContent = '揭晓中...';
  try {
    const res = await api('POST', `/api/users/${encodeURIComponent(currentUser)}/fortune`);
    todayData.fortune = res.fortune;
    todayData.stats = res.stats;
    // 翻牌动画：先显示卡片再触发动画
    $('fortune-empty').classList.add('hidden');
    $('fortune-card').classList.remove('hidden');
    $('fortune-card').classList.remove('flip-in');
    void $('fortune-card').offsetWidth; // 触发重绘
    $('fortune-card').classList.add('flip-in');
    renderFortune();
  } catch (err) {
    showToast('抽卡失败：' + err.message);
    btn.disabled = false;
    btn.textContent = '抽今日运势';
  }
}

// ---------- E.1: 留言 ----------
function renderMessage() {
  $('msg-input').value = todayData.message || '';
  setTaskStatus('task-msg', !!todayData.message, '已写');
}

async function saveMessage() {
  const text = $('msg-input').value.trim();
  if (!text) {
    showToast('写点什么再保存吧～');
    return;
  }
  try {
    const res = await api('POST', `/api/users/${encodeURIComponent(currentUser)}/message`, { content: text });
    todayData.message = res.content;
    setTaskStatus('task-msg', true, '已写');
    showToast('已保存 💌');
  } catch (err) {
    showToast('保存失败：' + err.message);
  }
}

// ---------- E.2: 连点应援 ----------
function renderCheer() {
  $('cheer-today').textContent = todayData.cheers || 0;
  $('cheer-total').textContent = (todayData.stats && todayData.stats.totalCheers) || 0;
  setTaskStatus('task-cheer', (todayData.cheers || 0) > 0, (todayData.cheers || 0) + ' 次');
}

const CHEER_FACES = ['🌟', '💖', '🎉', '✨', '🌸', '🍑', '🎀', '💫'];
function onCheerClick() {
  cheerLocal += 1;
  $('cheer-today').textContent = cheerLocal;
  // 表情随机切换
  const face = $('cheer-face');
  face.textContent = CHEER_FACES[Math.floor(Math.random() * CHEER_FACES.length)];
  // 弹跳动画
  const btn = $('cheer-btn');
  btn.classList.remove('boom');
  void btn.offsetWidth;
  btn.classList.add('boom');
  // 飞字
  spawnFloater(btn, '+1');
  // 节流同步到后端（500ms 后无新点击就提交）
  if (cheerSyncTimer) clearTimeout(cheerSyncTimer);
  cheerSyncTimer = setTimeout(syncCheer, 500);
}

async function syncCheer() {
  try {
    const res = await api('POST', `/api/users/${encodeURIComponent(currentUser)}/cheer`, { count: cheerLocal });
    todayData.cheers = res.count;
    todayData.stats = res.stats;
    $('cheer-total').textContent = res.stats.totalCheers || 0;
    setTaskStatus('task-cheer', cheerLocal > 0, cheerLocal + ' 次');
  } catch (err) {
    // 网络问题就静默，下次点会再触发
    console.warn('cheer sync failed', err);
  }
}

// 飞起来的"+1"
function spawnFloater(anchor, text) {
  const f = document.createElement('span');
  f.className = 'floater';
  f.textContent = text;
  const rect = anchor.getBoundingClientRect();
  f.style.left = (rect.left + rect.width / 2 + (Math.random() * 40 - 20)) + 'px';
  f.style.top = (rect.top + 10) + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 900);
}

// ---------- E.3: 抽今日语录 ----------
function renderQuote() {
  if (todayData.quote) {
    $('quote-empty').classList.add('hidden');
    const el = $('quote-content');
    el.classList.remove('hidden');
    el.textContent = '" ' + todayData.quote + ' "';
    setTaskStatus('task-quote', true, '已抽');
  } else {
    $('quote-empty').classList.remove('hidden');
    $('quote-content').classList.add('hidden');
    setTaskStatus('task-quote', false, '');
  }
}

async function drawQuote() {
  try {
    const res = await api('POST', `/api/users/${encodeURIComponent(currentUser)}/quote`);
    todayData.quote = res.quote;
    renderQuote();
  } catch (err) {
    showToast('抽取失败：' + err.message);
  }
}

// ---------- 任务状态徽标 ----------
function setTaskStatus(cardId, done, label) {
  const card = $(cardId);
  card.classList.toggle('done', done);
  const tag = card.querySelector('[data-status]');
  if (done) {
    tag.textContent = label ? '✓ ' + label : '✓';
    tag.classList.add('on');
  } else {
    tag.textContent = '';
    tag.classList.remove('on');
  }
}

// ---------- 历史 ----------
async function openHistory() {
  $('history-modal').classList.remove('hidden');
  switchHistoryTab('fortunes');
}
function closeHistory() {
  $('history-modal').classList.add('hidden');
}
async function switchHistoryTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  const list = $('history-list');
  list.innerHTML = '<p class="empty">加载中...</p>';
  try {
    if (tab === 'fortunes') {
      const data = await api('GET', `/api/users/${encodeURIComponent(currentUser)}/fortunes`);
      list.innerHTML = data.length
        ? data.map((f) => `
            <div class="hist-item">
              <div class="hist-date">${f.date} · ${'⭐'.repeat(f.level)}</div>
              <div class="hist-meta">
                <span>${f.mood?.emoji || ''} ${f.mood?.text || ''}</span>
                <span>幸运色：${f.color?.name || ''}</span>
              </div>
              <div class="hist-line"><b>宜：</b>${escapeHtml(f.good)}</div>
              <div class="hist-line"><b>忌：</b>${escapeHtml(f.bad)}</div>
              <div class="hist-motto">「${escapeHtml(f.motto)}」</div>
            </div>
          `).join('')
        : '<p class="empty">还没有抽过运势～</p>';
    } else {
      const data = await api('GET', `/api/users/${encodeURIComponent(currentUser)}/messages`);
      list.innerHTML = data.length
        ? data.map((m) => `
            <div class="hist-item">
              <div class="hist-date">${m.date}</div>
              <div class="hist-msg">${escapeHtml(m.content)}</div>
            </div>
          `).join('')
        : '<p class="empty">还没有写过留言～</p>';
    }
  } catch (err) {
    list.innerHTML = '<p class="empty">加载失败：' + escapeHtml(err.message) + '</p>';
  }
}

// ---------- 工具 ----------
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

function formatDate(d) {
  const w = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${w[d.getDay()]}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer;
function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
}
