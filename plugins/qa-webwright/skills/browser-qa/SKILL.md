---
name: browser-qa
description: >
  webwright 驅動的瀏覽器功能測試。當開發完成、需要對「新互動 / 新畫面 / 新流程」做功能驗證時觸發。
  兩階段：QA Agent 設計測試計畫（含 critical points），主 Agent 用 webwright code-as-action
  執行（寫帶 assert 的 final_script.py + 截圖 + 自我驗證）並輸出測試報告。
---

# Browser QA Skill（webwright 版）

把測試計畫的每條「預期結果」對映成 webwright 的一個 **critical point**，再落成
`final_script.py` 裡**一行 `assert` + 一張截圖**。**不使用 Playwright MCP 的逐步點擊。**

這條設計的好處：腳本**寫一次**（agent 花 token），之後 `python final_script.py` 直接跑——
有 assert 就能自動判 pass/fail、無 agent、不花 token、可掛 CI。

| Phase | 執行者 | 職責 |
|-------|--------|------|
| Phase 1 | QA Agent（本 plugin 的 `qa-engineer` agent） | 設計測試計畫、定義 critical points 與輸出格式 |
| Phase 2 | 主 Agent | 用 webwright 執行、讀截圖自我驗證、輸出測試報告 |

本 skill 分三層，分開維護：
- **方法論** `methodology/` — 怎麼做測試，穩定、不綁技術棧。
- **知識庫** `knowledge/` — 踩過的雷與領域知識，**會長大**、依專案技術棧選用。
- **執行契約** webwright skill 的 `reference/` — 瀏覽器啟動、截圖、log 格式。

---

## 前置（一次性 / 每次）

**一次性（每台開發機）：**
- 已安裝 **webwright plugin**：`/plugin install webwright@webwright`，重開 session。
- webwright runtime：`playwright install firefox`（webwright 用 Firefox，headless local；Claude adaptation 模式不需任何 model API key）。

**每次測試前：**
- 目標專案要能在本機跑起來（啟動方式見該專案的 CLAUDE.md / README；Windows 背景啟動雷見 `knowledge/pitfalls.md` D 段）。
- 確認 webwright skill 可用（Phase 2 會讀它的 SKILL.md 與 reference）。

---

## Phase 1：設計測試計畫（QA Agent）

由 `qa-engineer` agent 負責，依 `methodology/test-plan-design.md` 產出：

1. **覆蓋矩陣**（窮舉狀態維度，每格對應 TC）
2. **測試案例**（每步標【證據】+ 預期結果）
3. **需求 ↔ TC 對照表**
4.（大型功能）紅隊漏測複查一次

**關鍵交接規則**：每條 TC 的每個「預期結果」都要寫成「可被單一證據獨立驗證」的形式
—— 這就是 Phase 2 要落進 `plan.md` 的 critical point、再落成腳本一行 assert。
詳見 `methodology/critical-points.md`。

---

## Phase 2：執行測試（主 Agent，走 webwright）

主 Agent 嚴格按測試計畫，用 **webwright workflow** 執行，不得自行增減步驟。

1. **建 plan.md**：把測試計畫**每條預期結果**抄成 webwright `plan.md` 的 critical points
   （每個 CP 要能被一張截圖 / 一行 log 獨立驗證）。

2. **Explore**：用 scratch Playwright 腳本探索穩定 selector、確認控制項存在
   （webwright `reference/playwright_patterns.md`）。

3. **Author `final_script.py`**（在新的 `final_runs/run_<id>/`）：可重跑腳本，依計畫操作，
   **每個 critical point 落成一行 `assert` + 一張唯一命名截圖**，關鍵動作寫一行 log，
   最終資料印進 log 尾。斷言規範見 `methodology/critical-points.md`。

4. **Execute**：跑一次，擷取 stdout/stderr（assert 失敗 → 非 0 exit）。

5. **Self-verify**：逐項走 `plan.md`，`Read` 每張截圖確認證據明確才打勾。
   任一 CP 失敗 → 診斷具體原因 → 修腳本 → 在 `run_<id+1>/` 重跑重驗。

6. **輸出測試報告**（格式見下）。

### 測試哲學（通用，少數鐵則）

- **能走 UI 就走 UI**：模擬使用者操作要點畫面、填表、按鈕，不要繞過前端直接打資料來源
  （例外與細節見 `knowledge/pitfalls.md` A 段）。UI 上跑通才算 PASS。
- 排名語意（最新 / 最便宜 / 評價最高）要用畫面實際的排序/篩選控制，不能用自己對結果的排序。
- 數字 / 日期 / 數量 / 單位是**精確**比對。
- 技術棧專屬的「怎麼驗 / 怎麼點 / 哪裡有雷」一律查 `knowledge/pitfalls.md`，**不要靠記憶猜 UI**。

---

## 測試報告格式

```
## 測試報告
測試範圍：{功能}　測試日期：{YYYY-MM-DD}　run：final_runs/run_<id>/

### 結果摘要
| 測試案例總數 | PASS | FAIL |
|---|---|---|
| N | N | N |

### 案例明細
| 編號 | 功能 | 結果 | 證據（截圖檔名 / log 行 / assert） | 備註 |
|------|------|------|-----------------------------------|------|
| TC-001 | {功能} | PASS/FAIL | final_execution_2_submit.png | {若 FAIL 說明差異} |

### 發現問題（若有 FAIL）
BUG-{編號}｜嚴重度：Critical/Major/Minor｜對應 TC-{編號}
重現步驟 / 預期 / 實際 / 證據截圖

### 結論
通過 / 需修正後重測（列出 BUG 編號）
```

**每個 PASS/FAIL 都必須引用一張截圖、一行 log 或一行 assert 作證據**，不得用「看起來正常」這種模糊判定。

---

## 文件地圖

- `methodology/test-plan-design.md` — 覆蓋矩陣、可追溯、必測 checklist、TC 格式、測試資料原則
- `methodology/critical-points.md` — TC 預期 → critical point → assert 的對映與證據規範
- `knowledge/pitfalls.md` — 踩過的雷與領域知識（後端驗證、日期時區、壞值、Windows 啟動、元件 portal、state 同步、webwright 操作）；**持續 append**
- webwright skill 的 `reference/playwright_patterns.md` / `workflow.md` — 瀏覽器啟動 heredoc、aria snapshot、截圖命名、log 格式
