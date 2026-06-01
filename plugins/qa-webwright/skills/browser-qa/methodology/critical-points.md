# 從「TC 預期結果」到「webwright critical point」＋ assert（方法論）

本 plugin 的核心對映：QA Agent 設計的每條測試案例預期結果 → webwright `plan.md` 一個
**可被單一證據獨立驗證**的 critical point → `final_script.py` 裡**一行 `assert`**。

最後這一步（落成 assert）是讓腳本「寫一次、以後 `python final_script.py` 直接跑、
無 agent、不花 token、可進 CI」的關鍵——沒有 assert，腳本只會存截圖，仍要人/agent 看圖判定。

## 對映規則

| 測試計畫 | webwright plan.md | final_script.py |
|----------|-------------------|-----------------|
| TC 的一個「預期結果」 | 一個 critical point（CP） | 一行 `assert` + 一張證據截圖 |
| 步驟的【證據】說明 | 該 CP 的證據截圖檔名 | 截圖 + 對應斷言 |
| 需檢查項目 | 額外 CP | 額外 assert（無 console error 等） |

每個 CP 必須**獨立可驗證**：光看一個證據（截圖或 log 行）就能判定 pass/fail，
不依賴「我記得剛剛點了什麼」。

## 好 / 壞 critical point

✅ **好**（具體、可斷言）：
```
- [ ] CP2: 列表第一列出現名稱「測試品名A」、狀態欄顯示「待處理」
      → assert page.locator("table tr").first.inner_text() 含「測試品名A」與「待處理」
- [ ] CP5: 必填「聯絡信箱」留空時送出鈕為 disabled
      → assert page.get_by_role("button", name="送出").is_disabled()
```

❌ **壞**（模糊、無法斷言）：
```
- [ ] 表單運作正常        ← 斷言什麼？
- [ ] 資料有存進去        ← 從哪看出來？
- [ ] 沒有 bug
```

## final_script.py 的斷言規範

- **每個 CP 對應至少一行 `assert`**，斷言失敗時印出清楚訊息（哪個 CP、預期 vs 實際）。
- **斷言 + 截圖並存**：assert 給機器判定（exit code），截圖給人/agent 複查與留證。
- 斷言要打在**穩定、語意化的條件**上（可見文字、role、狀態），不要打在脆弱的 xpath index。
- 腳本最後把要回報的最終資料（單號 / 狀態 / 關鍵值）印進 `final_script_log.txt` 尾端。
- 全部 assert 通過 → 腳本 exit 0；任一失敗 → 非 0，CI 即可據此擋。

## 證據規範（self-verify 時嚴格把關）

- 每個 CP 至少對應一張 `final_runs/run_<id>/screenshots/` 截圖，**或**一行 log。
- `Read` 該截圖，確認證據**明確無歧義**：狀態可見、值完全相符、列表確實反映該條件。
- 對「狀態在 modal / drawer / dropdown 關閉後被藏起來」的情況：**重開**它，或在關閉前先截一張可見的摘要。
- 對「UI 看不到」的 CP（如資料真的寫進某來源）：用 log 印出查詢結果作證，並對應一行 assert。
- 模糊、被遮擋、只套用一半的狀態 → 一律當 FAIL，不放水。

## 截圖命名與 log（沿用 webwright contract）

- 截圖：`final_execution_<step>_<action>.png`（如 `final_execution_2_submit.png`），一個 CP 一張、唯一命名。
- log：每個 constraint-relevant 動作寫一行 `step <n> action: <reason and action>`；最終資料印在尾端。
- 每次乾淨重跑（`run_<id+1>/`）重置 log。
- 截圖硬規則：`viewport={"width":1280,"height":1800}`，**禁止** `full_page=True`，headless local Firefox。
