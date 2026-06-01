# qa-webwright

webwright 驅動的 QA 測試框架，包成可安裝的 Claude Code plugin。

把一套成熟的 QA 方法論（測試計畫設計、覆蓋矩陣、必測 checklist、測試資料建立規範、
日期欄位跨 UI/API/DB 三點驗證）**通用化**後，疊在 [webwright](https://github.com/microsoft/Webwright)
的 **code-as-action** 執行流程上：QA Agent 設計計畫 → 主 Agent 用 webwright 寫 `final_script.py`、
截圖、自我驗證每個 critical point。**不使用 Playwright MCP 的逐步點擊。**

## 內容

```
qa-webwright/
├─ .claude-plugin/
│   ├─ plugin.json              plugin manifest
│   └─ marketplace.json         讓別人 /plugin marketplace add
├─ agents/
│   └─ qa-engineer.md           QA Agent：設計測試計畫（含 critical points）
├─ commands/
│   ├─ qa-plan.md               /qa-webwright:qa-plan — 設計測試計畫
│   └─ qa-run.md                /qa-webwright:qa-run — 用 webwright 執行 + 驗證
└─ skills/
    └─ browser-qa/
        ├─ SKILL.md             方法論：兩階段流程、critical-point 對映、報告格式
        ├─ methodology/         方法論（穩定、不綁技術棧）
        │   ├─ test-plan-design.md   覆蓋矩陣 / 必測 checklist / TC 格式 / 測試資料原則
        │   └─ critical-points.md    TC 預期 → critical point → assert 對映
        └─ knowledge/           知識庫（踩過的雷與領域知識，持續 append）
            └─ pitfalls.md           後端驗證 / 日期時區 / 壞值 / Windows 啟動 / 元件雷 / state 同步
```

> **方法論 vs 知識庫**：`methodology/` 是穩定、跨專案不變的「怎麼做」；`knowledge/` 是會長大的
> 「踩過的雷」，每測一次踩到新坑就 append 一條，並依目標專案技術棧選用。兩者分開維護。

## 前置依賴（重要）

本 plugin 是「QA 方法論層」，執行引擎是 **webwright**。安裝本 plugin 前，每台開發機要先備妥：

```text
# 1. 裝 webwright plugin（執行引擎）
/plugin marketplace add microsoft/Webwright
/plugin install webwright@webwright
# 2. 裝 webwright runtime（webwright 用 Firefox）
playwright install firefox
```

> Claude Code adaptation 模式下，主 Agent 自己讀 PNG 驗證，**不需要** OPENAI_API_KEY 等任何 model API key。

## 安裝本 plugin

### 從 git repo（給別人用）

把這個資料夾推上一個 git repo（repo root 要含 `.claude-plugin/marketplace.json` 與 `.claude-plugin/plugin.json`），然後：

```text
/plugin marketplace add <你的-git-repo>     # 例：/plugin marketplace add your-org/qa-webwright
/plugin install qa-webwright@qa-webwright
```

安裝後**重開一個 Claude Code session**（plugin 在 session 啟動時載入）。

### 本機測試（不需 git）

```text
/plugin marketplace add ./qa-webwright       # 指向這個資料夾
/plugin install qa-webwright@qa-webwright
```

驗證 manifest：

```bash
claude plugin validate ./qa-webwright
```

## 使用

裝好後，在**任何專案**裡：

```text
# 設計測試計畫
/qa-webwright:qa-plan 供應商主檔新增頁的「通知財務」流程

# 依計畫用 webwright 執行 + 截圖驗證 + 出報告
/qa-webwright:qa-run <貼上計畫，或直接給功能描述>
```

或直接用自然語言（skill / agent 會依描述自動觸發）：「請 QA 測試這個新增流程」。

## 移植到新專案要補的「專案專屬」資訊

本 plugin 的方法論是通用的；**只有「啟動服務」那段是專案專屬**。在目標專案的 `CLAUDE.md`
或 README 補上：前後端各自的 port、啟動指令、健康檢查 URL、登入方式。`browser-qa` skill 的
Phase 2 會引用這些來起服務（Windows 背景啟動的 `npm.cmd` 雷已寫在 SKILL.md）。

## 作者

fulin
