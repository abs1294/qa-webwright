# delaylocal

把一段 prompt 排程到 **5 小時 quota 重置之後**，自動在本機**無人值守**執行，完成或中止後發 **LINE 通知**（選用，未設憑證則自動略過、不影響執行）。

- 鎖定**當前 session** 的 quota 重置時間（讀 `CLAUDE_CODE_SESSION_ID`）。
- 用 durable `CronCreate` 排程；final prompt 內建 **session 守衛**（只有原 session 會真正執行）。
- 內建**無人值守紀律**：不停下來問、持續做到無可執行項目、收尾前強制自問清單。

## 前置（一次性）

1. 需要 Node.js。
2. LINE 通知為**選用**（**有設就發、沒設就自動略過、不影響任務執行**）。要啟用就設定其一，憑證**不進 git**：
   - 複製 `skills/delaylocal/notify-line.config.example.json` → `notify-line.config.json`（同目錄），填入
     你的 LINE Channel Access Token 與 userId；**或**
   - 設環境變數 `LINE_TOKEN`、`LINE_USER_ID`。

## 用法

```
/delaylocal <要排程的 prompt 原文>
# 或自然語言：「把這個任務排到 quota 重置後再跑」
```

排程成功後會回報 Cron Job ID、觸發時間、綁定 session；取消用 `CronDelete <id>`。

> ⚠️ durable cron 需要 Claude Code process 活著且 REPL idle 時才會 fire。
