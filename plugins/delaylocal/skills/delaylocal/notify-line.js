#!/usr/bin/env node
// LINE push 通知工具。用法：
//   node notify-line.js "訊息內容（可含中文與 emoji）"
//   echo "很長的內容..." | node notify-line.js          // 從 stdin 讀（適合長 response）
//
// 長訊息自動拆多則：LINE 單則上限 5000 字、單次 push 最多 5 則 message。
// 超過 5 則（約 24000 字）會把完整內容寫到暫存檔，並在最後一則附上檔案路徑。
// 走 node https 處理 UTF-8（git-bash curl -d 內聯中文會 400）。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

// LINE 憑證來源（優先序）：環境變數 > 同目錄 notify-line.config.json。
// config 檔已被 .gitignore 排除，不進 git；範本見 notify-line.config.example.json。
let LINE_TOKEN = process.env.LINE_TOKEN || '';
let LINE_USER_ID = process.env.LINE_USER_ID || '';
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'notify-line.config.json'), 'utf8'));
  LINE_TOKEN = LINE_TOKEN || cfg.token || '';
  LINE_USER_ID = LINE_USER_ID || cfg.userId || '';
} catch (_) {}
if (!LINE_TOKEN || !LINE_USER_ID) {
  console.error('缺 LINE 憑證：複製 notify-line.config.example.json 成 notify-line.config.json 並填入 token/userId，或設環境變數 LINE_TOKEN / LINE_USER_ID。');
  process.exit(2);
}

const PER_MSG = 4800;   // 單則保守上限（LINE 5000，留 buffer）
const MAX_MSGS = 5;     // 單次 push 最多 5 則

// --- 取訊息：優先參數，否則 stdin ---
let msg = process.argv.slice(2).join(' ').trim();
if (!msg) {
  try { msg = fs.readFileSync(0, 'utf8').trim(); } catch (_) { msg = ''; }
}
if (!msg) {
  console.error('usage: node notify-line.js "<message>"  或  echo "<long>" | node notify-line.js');
  process.exit(2);
}

// --- 用 Array.from 以 code point 切（避免切壞 emoji / 中文）---
const chars = Array.from(msg);
let chunks = [];
for (let i = 0; i < chars.length; i += PER_MSG) {
  chunks.push(chars.slice(i, i + PER_MSG).join(''));
}

let savedPath = null;
if (chunks.length > MAX_MSGS) {
  // 超過 5 則 → 完整內容寫檔，LINE 只發前 (MAX_MSGS-1) 則 + 最後一則附檔案路徑
  savedPath = path.join(os.tmpdir(), `delaylocal-line-${Date.now()}.txt`);
  fs.writeFileSync(savedPath, msg, 'utf8');
  chunks = chunks.slice(0, MAX_MSGS - 1);
  chunks.push(`（內容過長已截斷，完整 ${chars.length} 字內容存於本機：\n${savedPath}）`);
}

// 加頁碼（多則時）
const total = chunks.length;
const messages = chunks.map((text, idx) => ({
  type: 'text',
  text: total > 1 ? `(${idx + 1}/${total})\n${text}`.slice(0, 5000) : text.slice(0, 5000)
}));

const body = JSON.stringify({ to: LINE_USER_ID, messages });

const req = https.request(
  'https://api.line.me/v2/bot/message/push',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  },
  (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => {
      console.log(`LINE ${res.statusCode} | 訊息則數=${total}${savedPath ? ' | 完整內容存檔:' + savedPath : ''} | ${d}`);
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
  }
);
req.on('error', (e) => { console.error('LINE request error:', e.message); process.exit(1); });
req.write(body);
req.end();
