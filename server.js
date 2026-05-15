// 爱东日常 - 后端服务
// 极简全栈：Express + JSON 文件存储
// 提供：每日运势抽卡、每日留言、连点应援、每日语录
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const content = require('./content');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// ---------- 中间件 ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 数据读写工具（极简 JSON 数据库） ----------
function readDB() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    console.error('数据文件损坏，已重置：', e.message);
    return { users: {} };
  }
}

function writeDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

// 确保某个用户存在；不存在则初始化
function ensureUser(db, nickname) {
  if (!db.users[nickname]) {
    db.users[nickname] = {
      createdAt: new Date().toISOString(),
      fortunes: {}, // { 'YYYY-MM-DD': fortuneObj }
      messages: {}, // { 'YYYY-MM-DD': '今天对东东说的话' }
      cheers: {},   // { 'YYYY-MM-DD': number }
      quotes: {},   // { 'YYYY-MM-DD': '今日语录' }
      stats: {
        totalCheers: 0, // 累计应援数（跨天，养成系统铺垫）
        drawDays: 0,    // 累计抽卡天数
      },
    };
  }
  // 兼容老数据补字段
  const u = db.users[nickname];
  u.fortunes ||= {};
  u.messages ||= {};
  u.cheers ||= {};
  u.quotes ||= {};
  u.stats ||= { totalCheers: 0, drawDays: 0 };
  return u;
}

// ---------- 工具函数 ----------
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 基于"用户名 + 日期 + 类型"做一个稳定但每天不同的 hash，避免抽卡每次刷新都变
function dailySeed(nickname, date, salt) {
  const h = crypto.createHash('sha256').update(`${nickname}|${date}|${salt}`).digest();
  // 取前 6 字节转成数字
  return h.readUIntBE(0, 6);
}
function pick(arr, seed) {
  return arr[seed % arr.length];
}

// 生成一张今日运势卡（确定性的：同一天同一用户拿到相同结果）
function generateFortune(nickname, date) {
  const s1 = dailySeed(nickname, date, 'level');
  const s2 = dailySeed(nickname, date, 'good');
  const s3 = dailySeed(nickname, date, 'bad');
  const s4 = dailySeed(nickname, date, 'color');
  const s5 = dailySeed(nickname, date, 'number');
  const s6 = dailySeed(nickname, date, 'motto');
  const s7 = dailySeed(nickname, date, 'mood');

  return {
    date,
    level: (s1 % 5) + 1,        // 1~5 星
    good: pick(content.GOODS, s2),
    bad: pick(content.BADS, s3),
    color: pick(content.COLORS, s4),
    number: (s5 % 9) + 1,        // 1~9
    motto: pick(content.MOTTOS, s6),
    mood: pick(content.MOODS, s7),
  };
}

// ---------- API: 登录 ----------
app.post('/api/login', (req, res) => {
  const { nickname } = req.body || {};
  if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
    return res.status(400).json({ error: '昵称不能为空' });
  }
  const name = nickname.trim().slice(0, 20);
  const db = readDB();
  ensureUser(db, name);
  writeDB(db);
  res.json({ success: true, nickname: name });
});

// ---------- API: 一次拉取今日全部状态 ----------
app.get('/api/users/:nickname/today', (req, res) => {
  const date = req.query.date || todayStr();
  const db = readDB();
  const user = ensureUser(db, req.params.nickname);
  writeDB(db);

  res.json({
    date,
    fortune: user.fortunes[date] || null, // null 表示今日还没抽卡
    message: user.messages[date] || '',
    cheers: user.cheers[date] || 0,
    quote: user.quotes[date] || null,
    stats: user.stats,
  });
});

// ---------- API: 每日运势 ----------
// 抽今日运势（一天一次；已抽过则直接返回旧的）
app.post('/api/users/:nickname/fortune', (req, res) => {
  const date = (req.body && req.body.date) || todayStr();
  const db = readDB();
  const user = ensureUser(db, req.params.nickname);

  if (!user.fortunes[date]) {
    user.fortunes[date] = generateFortune(req.params.nickname, date);
    user.stats.drawDays = (user.stats.drawDays || 0) + 1;
    writeDB(db);
  }
  res.json({ fortune: user.fortunes[date], alreadyDrawn: false, stats: user.stats });
});

// 历史运势（按日期倒序，最多近 30 天）
app.get('/api/users/:nickname/fortunes', (req, res) => {
  const db = readDB();
  const user = ensureUser(db, req.params.nickname);
  writeDB(db);
  const dates = Object.keys(user.fortunes).sort().reverse().slice(0, 30);
  res.json(dates.map((d) => user.fortunes[d]));
});

// ---------- API: 给东东的每日留言 ----------
app.post('/api/users/:nickname/message', (req, res) => {
  const { content: text, date } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: '留言不能为空' });
  }
  const d = date || todayStr();
  const db = readDB();
  const user = ensureUser(db, req.params.nickname);
  user.messages[d] = text.trim().slice(0, 200);
  writeDB(db);
  res.json({ success: true, date: d, content: user.messages[d] });
});

// 历史留言（最近 30 条）
app.get('/api/users/:nickname/messages', (req, res) => {
  const db = readDB();
  const user = ensureUser(db, req.params.nickname);
  writeDB(db);
  const dates = Object.keys(user.messages).sort().reverse().slice(0, 30);
  res.json(dates.map((d) => ({ date: d, content: user.messages[d] })));
});

// ---------- API: 连点应援 ----------
// 每次提交本日最新应援数；取本日最大值（防止刷新丢分）
// 同时累加到 stats.totalCheers（增量 = 本次 - 之前最大值）
app.post('/api/users/:nickname/cheer', (req, res) => {
  const { count, date } = req.body || {};
  const n = Math.max(0, Math.min(99999, parseInt(count, 10) || 0));
  const d = date || todayStr();
  const db = readDB();
  const user = ensureUser(db, req.params.nickname);
  const prev = user.cheers[d] || 0;
  if (n > prev) {
    user.stats.totalCheers = (user.stats.totalCheers || 0) + (n - prev);
    user.cheers[d] = n;
    writeDB(db);
  }
  res.json({ success: true, date: d, count: user.cheers[d] || 0, stats: user.stats });
});

// ---------- API: 抽每日语录 ----------
app.post('/api/users/:nickname/quote', (req, res) => {
  const date = (req.body && req.body.date) || todayStr();
  const db = readDB();
  const user = ensureUser(db, req.params.nickname);
  if (!user.quotes[date]) {
    const seed = dailySeed(req.params.nickname, date, 'quote');
    user.quotes[date] = pick(content.QUOTES, seed);
    writeDB(db);
  }
  res.json({ quote: user.quotes[date] });
});

// ---------- 启动 ----------
app.listen(PORT, () => {
  console.log(`\n  爱东日常 服务已启动`);
  console.log(`  本机访问:    http://localhost:${PORT}`);
  console.log(`  数据文件:    ${DATA_FILE}\n`);
});
