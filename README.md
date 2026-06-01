# fulin-plugins

fulin 的 Claude Code 工具集 marketplace。目前含兩個獨立 plugin：

| plugin | 用途 |
|--------|------|
| **qa-webwright** | webwright 驅動的 QA 測試框架：QA Agent 設計測試計畫，主 Agent 用 code-as-action 執行 + 截圖自我驗證。 |
| **delaylocal** | 把 prompt 排程到 5h quota 重置後，自動在本機無人值守執行，完成發 LINE 通知。 |

## 安裝

先加入這個 marketplace：

```text
/plugin marketplace add abs1294/qa-webwright
```

再依需要安裝 plugin（marketplace 名是 `fulin-plugins`）：

```text
/plugin install qa-webwright@fulin-plugins
/plugin install delaylocal@fulin-plugins
```

安裝後**重開一個 Claude Code session**（plugin 在 session 啟動時載入）。

## 各 plugin 的前置依賴

- **qa-webwright**：需先裝 webwright plugin（`/plugin install webwright@webwright`）+ `playwright install firefox`。詳見 `plugins/qa-webwright/README.md`。
- **delaylocal**：需 Node.js；LINE 憑證放本機 `notify-line.config.json` 或環境變數（**不進 git**）。詳見 `plugins/delaylocal/README.md`。

## 結構

```
.claude-plugin/marketplace.json     列出下列 plugin（pluginRoot: ./plugins）
plugins/
├─ qa-webwright/                     QA 測試框架 plugin
└─ delaylocal/                       排程 plugin（LINE 憑證以 .gitignore 排除）
```

## 作者

fulin
