# 爱东日常 ✨

一个轻量的「爱东日常」小游戏网页：每天来一发，抽运势、写留言、连点应援、抽语录，温柔陪伴。

- **前端**：原生 HTML / CSS / JS（零构建）
- **后端**：Node.js + Express
- **数据存储**：本地 `data.json` 文件
- **多人**：每个用户用昵称隔离，数据互不干扰

## 已实现功能（v1）

- 🔮 **每日运势** —— 一天抽一次，给出星级、宜、忌、幸运色、幸运数字、今日心情、一句箴言。同一天再次进入仍是同一张卡。
- 💌 **给东东留言** —— 每天写一句话给东东，自动按日期归档，可在「📔 历史」里翻看。
- 🎤 **连点应援** —— 一个圆滚滚的按钮，点一下飞一个 +1，本日次数实时统计，跨天累计「总应援数」（为后续养成系统铺垫）。
- ✨ **每日语录** —— 抽一句「东东想对你说的话」，每天一次，温柔上头。
- 📔 **历史回看** —— 运势日历 + 留言时间线。

## 快速开始（本地运行）

需要先装好 [Node.js 18+](https://nodejs.org/zh-cn) 和 npm。

```bash
cd /Users/mengxuan1/code/daily-checkin
npm install
npm start
```

启动后访问 http://localhost:3000 即可使用。

> 开发模式（保存自动重启）：`npm run dev`
> 改端口：`PORT=8080 npm start`

## 项目结构

```
daily-checkin/
├── package.json        依赖与启动脚本
├── server.js           Express 后端 + 简易 JSON 数据库
├── content.js          所有可调内容（运势池 / 语录池）
├── data.json           数据文件（首次启动自动生成）
├── public/
│   ├── index.html      页面结构
│   ├── style.css       样式（蜜桃粉 + 奶油白）
│   └── app.js          前端交互
└── README.md
```

## 常见调整

- **改运势 / 语录内容**：编辑 `content.js`，里面所有数组都可以增删条目，不用动 `server.js`。
- **改主色 / 应援色**：编辑 `public/style.css` 顶部 `:root` 里的 `--primary` 等变量。
- **重置某用户数据**：直接编辑 `data.json` 的 `users[<昵称>]` 字段。
- **清空全部数据**：删掉 `data.json` 即可，下次启动自动重建。

## API 一览（供后续扩展）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/login` | 登录/建档（请求体：`{ nickname }`） |
| GET  | `/api/users/:nickname/today` | 拉取今日全部状态 |
| POST | `/api/users/:nickname/fortune` | 抽今日运势（一天一次） |
| GET  | `/api/users/:nickname/fortunes` | 历史运势（最近 30 天） |
| POST | `/api/users/:nickname/message` | 提交今日留言 |
| GET  | `/api/users/:nickname/messages` | 历史留言（最近 30 条） |
| POST | `/api/users/:nickname/cheer` | 上报今日连点数（取最大值） |
| POST | `/api/users/:nickname/quote` | 抽今日语录（一天一次） |

## 让别人也能访问（临时分享）

最快方式：用 [ngrok](https://ngrok.com) 做内网穿透，几秒拿到一个公网链接。

```bash
brew install ngrok
ngrok config add-authtoken <你的token>
ngrok http 3000
```

终端会显示一个形如 `https://xxxx.ngrok-free.app` 的公网地址，发给朋友就能直接打开。

## 路线图

- [x] **v1 — 每日运势 + 每日小任务**（当前版本）
- [ ] **v2 — 东东养成（电子宠物）**：基于 `stats.totalCheers` 解锁等级、形象、装扮、互动动作
- [ ] **v3 — 拼图 / 找不同 等微互动**：扩充小任务种类
- [ ] **v∞ — 内容运营**：节日皮肤、特殊抽卡、纪念日彩蛋

> 数据持久化进阶：`data.json` 简单可靠但不抗并发，未来如想多人同时使用、永久部署，可换成 SQLite / Supabase。
