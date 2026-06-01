---
description: 依測試計畫用 webwright 執行瀏覽器測試，截圖自我驗證每個 critical point，輸出測試報告。
argument-hint: <測試計畫，或要測的功能（會先請 qa-engineer 設計）>
---

請以**主 Agent** 身分，依測試計畫用 **webwright** 執行瀏覽器測試。

輸入：

$ARGUMENTS

步驟：

1. 先讀本 plugin `browser-qa` skill 的 `SKILL.md`。若上面只給了功能描述、還沒有測試計畫，
   先用 `qa-engineer` agent（或 `/qa-webwright:qa-plan`）產出計畫。
2. 確認前置：webwright plugin 已裝、`playwright install firefox` 完成、目標專案前後端服務起著。
3. 讀 **webwright skill 的 SKILL.md**，依其 workflow 執行：
   - 把測試計畫每條 TC 的預期結果抄成 `plan.md` 的 critical points
   - explore → 寫 `final_runs/run_<id>/final_script.py`（viewport 1280×1800、headless local Firefox、
     每個 CP 一張唯一命名截圖、關鍵動作一行 log、最終資料印進 log 尾）
   - 執行 → 逐項 self-verify（`Read` 截圖，證據明確才打勾）→ 失敗就修腳本在 `run_<id+1>/` 重跑
4. **能走 UI 就走 UI**，禁止直接打後端 API 繞過前端（例外：無 UI 入口的外部 callback、SQL 做資料準備/驗證/清理）。
5. 全部 CP 綠燈後，輸出 `SKILL.md` 規定格式的測試報告，每個 PASS/FAIL 引用截圖或 log 作證據。
