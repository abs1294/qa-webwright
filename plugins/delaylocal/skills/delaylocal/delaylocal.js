#!/usr/bin/env node
// delaylocal 主工具：算當前 session 的 5h quota 重置時間，組裝排程用的 final prompt。
//
// 用法：
//   echo "<使用者要排的 prompt 原文>" | node delaylocal.js [bufferSeconds]
//   node delaylocal.js [bufferSeconds] --prompt-file <path>
//   node delaylocal.js [bufferSeconds] --prompt-file <path> --goal "<可測量完成條件>"
//
// 兩種模式：
//   - 預設：final_prompt 內建「session 守衛 + 無人值守文字紀律 + 任務 + 發 LINE」。
//   - --goal：final_prompt 第一行為 `/goal <完成條件>`（含「已發 LINE」），靠 Claude Code 的
//     goal 引擎 + Haiku 檢查器持續做到達成；session 守衛改成工作清單第①項（不搶第一行）。
//     已實測：durable cron fire 進活著的 REPL 時，開頭的 /goal 會被解析成 slash command。
//
// 輸出：JSON { ok, sessionId, snapshotKey, resets_at_local, target_local, cron, fire_in_minutes, buffer_seconds, mode, final_prompt }
// skill 拿 cron + final_prompt 去 CronCreate({ recurring:false, durable:true })。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

function fail(msg) {
  console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
  process.exit(1);
}

// --- 1. 當前 session id ---
const envId = process.env.CLAUDE_CODE_SESSION_ID || '';
if (!envId) fail('CLAUDE_CODE_SESSION_ID 環境變數不存在，無法鎖定當前 session');
const snapshotKey = envId.replace(/-/g, '').slice(0, 24);

// --- 2. 讀參數與使用者 prompt（stdin 優先，否則 --prompt-file）---
const args = process.argv.slice(2);
let bufferSeconds = 900; // 預設緩衝 15 分鐘
let promptFile = null;
let goalCondition = null; // 完成條件（預設 goal 模式必填；由 Claude propose、使用者確認後填入）
let plainMode = false;    // --plain 才退回舊的文字紀律模式
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--prompt-file') promptFile = args[++i];
  else if (args[i] === '--goal') goalCondition = args[++i];
  else if (args[i] === '--plain') plainMode = true;
  else if (/^\d+$/.test(args[i])) bufferSeconds = parseInt(args[i], 10);
}
let userPrompt = '';
if (promptFile) {
  userPrompt = fs.readFileSync(promptFile, 'utf8');
  // 中繼檔是一次性消耗品：讀完立刻刪除，避免殘留被其他流程誤讀 / 覆寫競態。
  try { fs.unlinkSync(promptFile); } catch (_) {}
} else {
  try { userPrompt = fs.readFileSync(0, 'utf8'); } catch (_) { userPrompt = ''; }
}
userPrompt = (userPrompt || '').trim();
if (!userPrompt) fail('沒有收到要排程的 prompt（請用 stdin 或 --prompt-file 傳入）');
if (!plainMode && !goalCondition) fail('delaylocal 預設為 goal 模式：需提供完成條件 --goal "<可測量完成條件>"。請先把完成條件 propose 給使用者、確認後再排程。若確實要用無目標的文字紀律模式，加 --plain。');

// --- 3. 讀 quota 重置時間（鎖定當前 session）---
const snapFile = path.join(os.homedir(), '.claude', 'rate-limit-snapshots.json');
let snaps;
try { snaps = JSON.parse(fs.readFileSync(snapFile, 'utf8')); } catch (e) { fail('讀 rate-limit-snapshots.json 失敗: ' + e.message); }
const now = Math.floor(Date.now() / 1000);

let base;
const entry = snaps[snapshotKey];
if (entry && entry.five_hour && typeof entry.five_hour.resets_at === 'number') {
  base = entry.five_hour.resets_at;
} else {
  // fallback：當前 session 沒快照 → 取所有 session 最晚的未來 resets_at（最保守）
  const future = Object.values(snaps)
    .map((s) => s && s.five_hour && s.five_hour.resets_at)
    .filter((x) => typeof x === 'number' && x > now);
  base = future.length ? Math.max(...future) : now;
}
// 若 resets_at 已過期 → 用 now（quota 應已重置）
if (base < now) base = now;

const target = base + bufferSeconds;
const d = new Date(target * 1000);
const cron = `${d.getMinutes()} ${d.getHours()} ${d.getDate()} ${d.getMonth() + 1} *`;

// notify-line.js 與本檔同目錄；用 __dirname 取絕對路徑，plugin 裝在哪都能找到。
const notifyPath = path.join(__dirname, 'notify-line.js');
const reportPath = 'C:\\Users\\User\\AppData\\Local\\Temp\\delaylocal-report.txt';

// 固定報告格式（兩種模式共用）
const REPORT_FORMAT = `[delaylocal 完成] <一句話結論>

■ 任務
<一句話描述這次做了什麼專案 / 修了什麼>

■ 執行結果
- <項目>：<完成 / Pass / Fail / 未做原因>

■ 決策記錄
- <做了什麼決策>：<理由>（沒有就寫「無」）

■ 發現問題
- BUG-1 [Critical/Major/Minor]：<描述>（沒有就寫「無」）

■ 產出
- <檔案路徑 / commit / PR / 啟動方式>

■ 下一步建議
- <建議>（沒有就寫「無」）`;

// --- 4. 組裝 final prompt ---
let finalPrompt;
if (!plainMode) {
  // === goal 模式（預設）===
  // 第一行 = /goal <完成條件>，把「已發 LINE」納入條件（goal 達成後自動清除、不接後續，
  // 所以發 LINE 必須是達成條件的一部分，goal 引擎才會強迫自己發完才停）。
  // session 守衛改成工作清單第①項（不搶 /goal 的第一行位置）。
  finalPrompt = `/goal ${goalCondition}；並且已將完整報告寫入暫存檔、執行 notify-line.js 成功發出 LINE 總結（LINE 回應 200）

（上面第一行是 goal 完成條件。下面是達成它要依序完成的工作清單，當作你的執行指引；全程繁體中文、無人值守：不停下來問使用者、需要決定時自己選風險最小做法、做到完成。）

工作清單（依序）：
1. [Session 守衛] 確認環境變數 CLAUDE_CODE_SESSION_ID 是否等於 ${envId}。
   - 不等於 → 這是別的 session 誤觸發本排程：不要執行任務、不要發 LINE，直接視為本目標達成（本 session 無事可做）。
   - 等於 → 繼續下面步驟。
2. [執行任務] 完成以下任務（持續做到完成；遇真正 blocker 先把其餘能做的做完再記錄）：
${userPrompt}
3. [收尾發 LINE] 把依「報告格式」填好的報告寫進 "${reportPath}"，再執行：
   cat "${reportPath}" | node "${notifyPath}"
   （notify-line.js 走 node https，自動拆多則、可帶中文/emoji；需先設好 notify-line.config.json 或 LINE_TOKEN/LINE_USER_ID。）

報告格式（步驟 3 用，嚴格照填、不增不減）：

${REPORT_FORMAT}`;
} else {
  // === 文字紀律模式（--plain，選用 fallback）===
  finalPrompt = `[delaylocal 排程任務 — 綁定 session ${envId}]

== Session 守衛（第一步，務必先做）==
這個排程綁定建立它的 session（${envId}）。多 session 環境下其他 session 可能也會 fire 到本任務。
請先確認環境變數 CLAUDE_CODE_SESSION_ID 是否等於 ${envId}：
  - 若「不等於」→ 立刻停止，不執行任何後續、不發 LINE（這是別的 session 誤觸發）。
  - 若「等於」→ 繼續往下執行。

== 執行模式：無人值守（UNATTENDED，嚴格遵守）==
前提假設：使用者「不在線、不會看訊息、不會回覆」。整個任務期間沒有任何人可以問、可以確認。
1. 假設無人值守：絕不停下來問使用者問題、絕不等待回覆或確認。需要做決定時，自己選最合理、風險最小的做法繼續，事後在報告 / LINE 說明。
2. 持續執行直到「再也沒有任何可執行項目」為止——把任務拆到底、逐項做完，包含實作、驗證 / 測試、收尾。
3. 【結束前的強制自問】每一次你想收尾 / 結束前，都必須先把下列問題問自己一遍，全部答「否（沒有了）」才可以結束：
   - 原始需求的每一項都完成了嗎？有沒有漏掉的子項？
   - 還有沒有「下一個可執行的項目」、未驗證 / 未測試的部分、寫了一半的 TODO？
   - 有沒有「想留到之後再做」、但其實現在就能做的事？
   只要任何一項答案是「還有」，就回去繼續做，不可結束。確認真的全部做完才進入結束流程。
4. 唯一可結束的另一種情況＝遇到「真正的 blocker」：需使用者明確授權的破壞性操作、外部系統不可用、缺少只有使用者能提供的祕密 / 決策。遇到時也不是停著乾等，而是先把不受該 blocker 影響、所有還能做的事做完，再把 blocker 寫進報告後結束。
5. 全程繁體中文；若專案有 CLAUDE.md 規範務必全部遵守。

== 實際任務 ==
${userPrompt}

== 結束時必做：發 LINE 完整 response ==
無論「全部完成」或「遇到 blocker 中止」，最後一步把報告寫進暫存檔，再用 stdin 管道發 LINE：
  cat "${reportPath}" | node "${notifyPath}"
（notify-line.js 走 node https，自動把長內容拆多則，每則 4800 字、最多 5 則；超過則完整內容存本機並附路徑。可直接帶中文 / emoji。需先設好 notify-line.config.json 或 LINE_TOKEN/LINE_USER_ID 環境變數。）

報告**必須嚴格照以下固定格式**填寫，只填這些區塊、不增不減：

${REPORT_FORMAT}`;
}

console.log(JSON.stringify({
  ok: true,
  sessionId: envId,
  snapshotKey,
  resets_at_local: new Date(base * 1000).toLocaleString(),
  target_local: d.toLocaleString(),
  cron,
  fire_in_minutes: Math.round((target - now) / 60),
  buffer_seconds: bufferSeconds,
  mode: plainMode ? 'plain' : 'goal',
  final_prompt: finalPrompt
}, null, 2));
