$ErrorActionPreference = "Stop"
Set-Location "E:\My project\singapore\singapore_food_site-master"

git add -A
Write-Host "Staged all files"

$tree = git write-tree
Write-Host "Tree: $tree"

$parent = git rev-parse HEAD
Write-Host "Parent: $parent"

$env:GIT_AUTHOR_NAME = "admin"
$env:GIT_AUTHOR_EMAIL = "admin@example.com"
$env:GIT_COMMITTER_NAME = "admin"
$env:GIT_COMMITTER_EMAIL = "admin@example.com"

$commitMsg = "Login required: gate marketplace and WhatsApp contact behind login modal"
$commitHash = ($commitMsg | git commit-tree $tree -p $parent)
Write-Host "Commit: $commitHash"

Set-Content -Path ".git\refs\heads\main" -Value "$commitHash`n" -NoNewline -Encoding ascii
Write-Host "Updated refs/heads/main to $commitHash"

$newHead = git rev-parse HEAD
Write-Host "HEAD now: $newHead"

git push origin main 2>&1
Write-Host "Push complete"
