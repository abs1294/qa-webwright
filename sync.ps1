# 一鍵同步：把本 repo 的改動 commit + push 到 GitHub。
# 用法： .\sync.ps1 "這次改了什麼"
param([Parameter(Mandatory = $true)][string]$Message)

git add -A
git commit -m $Message
git push
Write-Host "已同步到遠端。" -ForegroundColor Green
