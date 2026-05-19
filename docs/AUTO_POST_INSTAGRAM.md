# Auto-Post & Instagram 連携セットアップガイド

`auto_post.py` は **シンガポール F&B ニュース** を毎日収集し、サイト
（[The Kitchen Connection](https://www.instagram.com/the_kitchen_connection_sg)）
の `news_articles` テーブルに保存、さらに **1 日 1 件を Instagram Business
アカウントに自動投稿** するスクリプトです。手動で管理画面から作成した記事も
同じ Instagram キューに自動で乗ります。

---

## 0. 全体像

```
┌──────────────────────────────────────────────────────────────────────┐
│  毎日 09:00 SGT  ─  GitHub Actions: .github/workflows/auto-post.yml │
│                                                                      │
│  ┌─ collect ─────────────┐    ┌─ instagram ────────────────────┐    │
│  │ RSS/static 取得        │    │ 今日の曜日カテゴリを決定         │    │
│  │ ↓ OpenAI で英日要約    │ →  │ 未投稿×公開×画像有 の記事を抽出  │    │
│  │ ↓ 画像 og or DALL·E +  │    │ ↓ Graph API で投稿             │    │
│  │   ロゴ合成 → Storage   │    │ ↓ 投稿済フラグ更新             │    │
│  │ ↓ Supabase に INSERT   │    │ ↓ Slack 通知                    │    │
│  └────────────────────────┘    └─────────────────────────────────┘    │
│                                                                      │
│        Slack 通知（成功・失敗・致命的エラー）                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. データベース移行（1 回のみ）

Supabase Dashboard → SQL Editor で
[`supabase/auto_post_migration.sql`](../supabase/auto_post_migration.sql) を実行。

追加される列：

| 列 | 型 | 用途 |
|---|---|---|
| `tags` | `text[]` | 既定値 `{F&B News, Singapore}`、site 側のタグ表示にも使用可 |
| `display_date` | `timestamptz` | 表示用に backdate 可能 |
| `instagram_caption` | `text` | OpenAI が生成した IG 用キャプション |
| `instagram_posted` | `boolean` | 投稿済フラグ（重複投稿防止） |
| `instagram_post_id` | `text` | Graph API が返した media ID |
| `instagram_posted_at` | `timestamptz` | 投稿日時 |
| `instagram_attempts` | `integer` | リトライ回数（`IG_MAX_RETRY_ATTEMPTS` で打ち止め） |
| `instagram_last_error` | `text` | 直近のエラー文 |

GIN インデックス `news_articles_instagram_queue_idx` も付与され、ピッカー
が高速化されます。

---

## 2. Meta Developer 側セットアップ

クライアント回答「Meta Developer アカウント／アプリ無し」のため、ゼロから作成します。

### 2-1. Meta Developer アカウント作成
<https://developers.facebook.com/> → "Get Started" → Facebook アカウントでログイン。

### 2-2. アプリ作成
1. **My Apps → Create App**
2. ユースケース：**Other** → **Next**
3. アプリタイプ：**Business**
4. アプリ名：`Kitchen Connection Auto Post`
5. ビジネスポートフォリオ：既存の Facebook Business に紐付け（無ければ作成）

### 2-3. プロダクト追加
**Add Products** → **Instagram Graph API** を **Set Up** → **Facebook Login for Business** も Add。

### 2-4. 権限（Permissions）
**App Review → Permissions and Features** で以下を申請：

- `instagram_basic`
- `instagram_content_publish` ← **本番運用に必須**
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

**App Review の `instagram_content_publish` は通常 1〜2 週間** かかります。承認待ちの
あいだはアプリ管理者本人の Facebook アカウントでのみテスト投稿が可能です。

### 2-5. App ID / App Secret を控える
**Settings → Basic** → `IG_APP_ID` と `IG_APP_SECRET` に設定。

---

## 3. アクセストークンの取得

### 3-1. 短期 User Token
<https://developers.facebook.com/tools/explorer/> →
右上 Application で作成したアプリ → **Generate Access Token**。
権限はすべてチェック。

### 3-2. 長期 User Token（60日）に交換
```bash
curl -sG "https://graph.facebook.com/v21.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=${IG_APP_ID}" \
  --data-urlencode "client_secret=${IG_APP_SECRET}" \
  --data-urlencode "fb_exchange_token=<short_token>"
```

### 3-3. 無期限 Page Access Token を取得
```bash
curl -sG "https://graph.facebook.com/v21.0/me/accounts" \
  --data-urlencode "access_token=<long_user_token>"
```
`the_kitchen_connection_sg` と連携するページ ID とその `access_token` を控える。
この **Page Token は権限取り消し等が無い限り無期限**。これを `IG_ACCESS_TOKEN` に。

### 3-4. Instagram Business アカウント ID
```bash
curl -sG "https://graph.facebook.com/v21.0/<page_id>" \
  --data-urlencode "fields=instagram_business_account" \
  --data-urlencode "access_token=<page_token>"
```
返ってきた `instagram_business_account.id` を `IG_USER_ID` に。

### 3-5. ローテーション
```bash
python auto_post.py refresh-token
```
を月 1〜2 回実行すると新しいトークンが標準出力＋Slack に出ます。
新トークンを GitHub Secrets / `.env.auto-post` の `IG_ACCESS_TOKEN` に貼り替えてください。

---

## 4. 環境変数

`.env.auto-post.example` をコピーして `.env.auto-post` を作成、値を埋めます。
ローカル実行時は `.env.local` の Supabase 値もそのまま読まれます。

GitHub Actions の場合は Repo → Settings → Secrets and variables → Actions に：

| Secret 名 | 値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role キー |
| `OPENAI_API_KEY` | OpenAI API キー |
| `IG_USER_ID` | Instagram Business Account ID |
| `IG_ACCESS_TOKEN` | 無期限 Page Access Token |
| `IG_APP_ID` | Meta App ID |
| `IG_APP_SECRET` | Meta App Secret |
| `SLACK_WEBHOOK_URL` | クライアント提供の Slack webhook URL |

---

## 5. 依存インストール
```bash
pip install -r requirements.txt
```

---

## 6. 実行
```bash
python auto_post.py run             # 通常運用（ニュース収集 + IG 1 件投稿）
python auto_post.py collect         # ニュース収集のみ
python auto_post.py instagram       # 在庫から IG 投稿のみ（管理画面で手動投稿した記事もここに乗る）
python auto_post.py refresh-token   # 長期トークンを更新
```

---

## 7. 機能仕様まとめ

### 7-1. ニュース収集ソース
- **Google News RSS**：F&B / restaurants / SFA / trend で計 4 本
- **静的ページ**：SFA SAFE Framework、Time Out 新店一覧、Daniel Food Diary

各記事は **タイトル末尾に SHA1 8 文字** をスラッグに含めるので
（例：`new-cold-chain-tech-singapore-a1b2c3d4`）、同タイトルの再収集は
DB の UNIQUE 制約により構造的にブロックされます。

### 7-2. 要約 / 翻訳
1 回の OpenAI 呼び出し（JSON モード）で
`title_en / title_ja / excerpt_en / excerpt_ja / content_en / content_ja / caption_ig`
を同時に生成。API キー未設定時は本文の冒頭をフォールバックとして使用。

### 7-3. 画像生成・ロゴ合成
| ケース | 動作 |
|---|---|
| ソース記事に `og:image` あり | 取得 → ロゴ合成 → Supabase Storage に再ホスト |
| `og:image` 無し | DALL·E (`gpt-image-1`) で **カテゴリ別プロンプト** で生成 → ロゴ合成 → Storage |

**カテゴリ別プロンプト（[auto_post.py 内 `CATEGORY_IMAGE_PROMPTS`](../auto_post.py)）**：

- **regulation**：シンガポール政府の建物 / 食品安全関連書類
- **event**：レストラン内装、テーブルセッティング
- **trend**：食材のマクロ接写
- **industry**：商業厨房・シェフの作業風景

**ブランドビジュアル**：
- フォトリアル editorial style
- 暖色トーン `#1f2937 (charcoal)` / `#f59e0b (amber)` / `#fafaf9 (warm white)`
- 画像内に文字・ロゴ・人物正面は埋め込まない
- ロゴ合成後の最終画像のみブランドロゴを右下に半透明パネル付きで配置

ロゴソースは `BRAND_LOGO_SRC` 環境変数（デフォルト `public/icon.png`）。
無効化したい場合は `LOGO_OVERLAY_ENABLED=false`。

### 7-4. 曜日ベース カテゴリスケジュール（週次比率：Industry×3 / Trend×2 / Regulation×1 / Event×1）

| 曜日 | カテゴリ |
|---|---|
| 月 | industry |
| 火 | regulation |
| 水 | trend |
| 木 | industry |
| 金 | event |
| 土 | trend |
| 日 | industry |

その日のカテゴリに該当する **未投稿・公開済・画像有り** の記事が無い場合は、
「最後に IG 投稿したカテゴリが一番古い」ものへフォールバック。

### 7-5. 投稿済フラグ／リトライ制御
- `instagram_posted=true` で重複投稿を防止
- `instagram_attempts` が `IG_MAX_RETRY_ATTEMPTS`（既定 3）を超えた行は自動スキップ
- `instagram_last_error` に直近エラーが残るので、Supabase ダッシュボードで原因確認可
- 手動リトライ：`UPDATE news_articles SET instagram_attempts=0, instagram_last_error=NULL WHERE id='…';`

### 7-6. 管理画面で作成した記事も対象
[`src/pages/AdminDashboard.tsx`](../src/pages/AdminDashboard.tsx) 経由で作成された
記事も、`published=true` かつ `image` 列が空でなければ **同じ IG キューに自動で
入ります**。フラグ系列の列はデフォルト値（`instagram_posted=false`、`instagram_attempts=0`）
で挿入されるため、追加操作不要。

> 即時投稿が必要な場合は Supabase Webhook → GitHub Actions の `workflow_dispatch`
> を呼ぶことで「INSERT 即時投稿」も実現可能ですが、クライアント要件は「1日1件」
> なので cron 方式（毎日 09:00 SGT）を採用。

### 7-7. Slack 通知
環境変数 `SLACK_WEBHOOK_URL`（GitHub Actions Secret 推奨）に設定された
Slack Incoming Webhook URL へ送信されます。未設定の場合は通知をスキップ
します。

| 種別 | 内容 |
|---|---|
| ℹ️ info | 当日候補なし / トークン更新成功 |
| ✅ success | 収集成功（記事リスト）/ IG 投稿成功（タイトル＋メディア ID） |
| ⚠️ warning | 認証情報未設定、画像 URL 無し |
| ❌ error | IG API 失敗、致命的例外（スタックトレース含む） |

通知文には slug / category / media_id を含めるので、Supabase ダッシュボードで
すぐに該当行を特定できます。

### 7-8. キャプション
```
{英語タイトル}

{英語要約（OpenAI 生成 / 抜粋）}

#SingaporeFNB #SingaporeRestaurants #SingaporeFood #SingaporeBusiness #SGFNB
```
（最大 2150 文字でクリップ）

---

## 8. 動作確認チェックリスト

- [ ] `supabase/auto_post_migration.sql` を Supabase で実行済み
- [ ] `.env.auto-post` または GitHub Secrets を完備
- [ ] `pip install -r requirements.txt` 完了
- [ ] `python auto_post.py collect -v` → `news_articles` に新規行（`tags = {F&B News, Singapore}`）が挿入される
- [ ] `https://thekitchenconnection.sg/news` で記事が表示される
- [ ] `python auto_post.py instagram -v` → `@the_kitchen_connection_sg` に投稿される
- [ ] DB 上で `instagram_posted=true`、`instagram_post_id` が記録される
- [ ] Slack に成功通知が届く
- [ ] GitHub Actions が毎日 1 回トリガーされる
- [ ] 失敗時 Slack に error 通知が届く

---

## 9. クライアント要件 vs 実装 対応表

| クライアント要件 | 実装場所 |
|---|---|
| 英 / 日タイトル・抜粋・本文・スラッグ・カテゴリ・画像 URL・タグ・著者 | `auto_post.py` `collect_articles()` |
| OpenAI 要約 + 無設定時フォールバック | `summarise_bilingual()` |
| スラッグ重複防止（タイトル末尾にハッシュ） | `slugify()` + DB UNIQUE 制約 |
| カテゴリ自動判定 | `classify_category()` |
| Instagram Graph API 自動投稿 | `ig_create_media() / ig_publish()` |
| Meta Developer / アプリ / トークン手順 | §2–§3 |
| 投稿済フラグ | `instagram_posted` 列 |
| 固定ハッシュタグ 5 種 | `INSTAGRAM_HASHTAGS` |
| 1日1件 | `post_one_to_instagram()` × 毎日 cron |
| 自動投稿で OK | 承認待ちは無し |
| ジャンルローテーション | 曜日固定 + 比率（§7-4） |
| 画像生成指示 | カテゴリ別プロンプト + ブランド style（§7-3） |
| ロゴ合成 | `overlay_brand_logo()` |
| Slack 通知 | `notify_slack()`（§7-7） |
| エラー時の挙動 | リトライ上限 + Slack error 通知（§7-5） |
