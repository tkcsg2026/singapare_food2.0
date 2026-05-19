import type { ChatbotTopic } from "@/types/chatbot";

export interface KnowledgeEntry {
  id: string;
  topic: ChatbotTopic;
  /** Lowercase / normalized tokens; include EN, JA (any script), and romaji where useful */
  keywords: string[];
  answerEn: string;
  answerJa: string;
}

/**
 * Structured FAQ for Layer A matching and for grounding Layer B (AI).
 * Keep answers factual and non-legal; no invented inventory or supplier names.
 */
export const CHATBOT_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "platform_overview",
    topic: "general_platform",
    keywords: [
      "what is",
      "about",
      "portal",
      "platform",
      "fb portal",
      "f&b",
      "purpose",
      "このサイト",
      "サイトは",
      "プラットフォーム",
    ],
    answerEn:
      "F&B Portal is a Singapore-focused directory and community site: browse **Suppliers** for ingredients and services, use **Buy & Sell** for pre-owned kitchen equipment, read **News**, use **Contact** for site enquiries, and manage your account from **Login** / **Dashboard** after you register. We do not process orders or payments for third-party suppliers on your behalf.",
    answerJa:
      "F&B Portal はシンガポール向けのディレクトリ兼コミュニティサイトです。**サプライヤー**で食材・サービスを検索し、**Buy & Sell** で中古厨房機器の売買、**ニュース**の閲覧、サイトに関する問い合わせは**お問い合わせ**、登録後は**ログイン**／**マイページ**でアカウント管理ができます。第三者サプライヤーの注文や決済を当サイトが代行するわけではありません。",
  },
  {
    id: "find_suppliers",
    topic: "supplier_search",
    keywords: [
      "find supplier",
      "search supplier",
      "supplier directory",
      "directory",
      "filter",
      "category",
      "area",
      "plan",
      "premium",
      "サプライヤー",
      "探す",
      "検索",
      "ディレクトリ",
      "カテゴリ",
      "エリア",
    ],
    answerEn:
      "Open **Suppliers** from the main navigation. Use the search box, **category**, **area**, and **plan** filters to narrow results. Click a supplier card to open their profile: you’ll see description, tags, and ways to get in touch depending on their listing (for example contact buttons or links). Listings are provided by suppliers or admins—we don’t verify every claim in real time.",
    answerJa:
      "メニューから**サプライヤー**を開きます。検索欄と**カテゴリー**・**エリア**・**プラン**などのフィルターで絞り込み、カードをクリックして詳細ページへ進みます。連絡方法は各掲載内容に依存します（ボタンやリンクなど）。掲載内容はサプライヤーまたは管理者が登録したものであり、当サイトがすべてをリアルタイムで検証するわけではありません。",
  },
  {
    id: "contact_supplier",
    topic: "contact_supplier",
    keywords: [
      "contact supplier",
      "reach supplier",
      "message supplier",
      "whatsapp supplier",
      "phone",
      "email supplier",
      "サプライヤーに連絡",
      "連絡方法",
      "問い合わせ",
    ],
    answerEn:
      "Open the supplier’s detail page from **Suppliers**. Use the contact options shown there (for example **WhatsApp**, email, or website links) if the listing provides them. If you are asked to log in for certain actions, create a free account and sign in. For problems with the **website itself**, use **Contact** in the footer—not the supplier’s private details unless their profile invites that channel.",
    answerJa:
      "**サプライヤー**から詳細ページを開き、掲載されている連絡手段（**WhatsApp**、メール、公式サイトなど）をご利用ください。一部機能でログインが必要な場合は無料登録のうえサインインしてください。**サイトの不具合や全般のお問い合わせ**はフッターの**お問い合わせ**からお願いします。",
  },
  {
    id: "buy_sell_overview",
    topic: "buy_sell",
    keywords: [
      "buy and sell",
      "marketplace",
      "used equipment",
      "kitchen equipment",
      "sell item",
      "listing",
      "buy sell",
      "中古",
      "売買",
      "マーケットプレイス",
      "機器",
    ],
    answerEn:
      "**Buy & Sell** (Marketplace) is for listing and discovering pre-owned F&B equipment. Browse from **Marketplace** in the nav, use search and filters, and open an item to see details and seller contact flow. Creating or managing listings usually requires a logged-in account. Transactions happen between users; follow safe trading practices and the site’s **Terms**.",
    answerJa:
      "**Buy & Sell**（マーケットプレイス）は中古の F&B 設備・備品の掲載・閲覧用です。ナビの**売り&買い**から検索・フィルターで探し、詳細ページで内容と売り手とのやり取り方法を確認します。出品・管理には通常ログインが必要です。取引当事者間のやり取りとなります。**利用規約**と安全な取引の注意をご確認ください。",
  },
  {
    id: "post_marketplace_item",
    topic: "post_item",
    keywords: [
      "post item",
      "list item",
      "create listing",
      "add marketplace",
      "sell my",
      "how to post",
      "出品",
      "掲載",
      "投稿",
    ],
    answerEn:
      "Go to **Marketplace** and sign in when prompted. Use the flow to **create a new listing** (title, description, photos, price/condition as the form requests). Submissions may be reviewed before they appear publicly (**admin approval**). If a field or button is missing, refresh after login or check **Dashboard** for drafts or status.",
    answerJa:
      "**売り&買い**（マーケットプレイス）へ進み、必要に応じてログインします。画面の案内に従い**新規出品**（タイトル、説明、写真、価格・状態など）を入力します。公開前に**管理者の承認**がある場合があります。表示されない場合はログイン状態を確認し、**マイページ**で下書きや状態を確認してください。",
  },
  {
    id: "marketplace_approval",
    topic: "admin_approval",
    keywords: [
      "approval",
      "moderation",
      "pending",
      "why not visible",
      "admin",
      "review",
      "承認",
      "審査",
      "公開されない",
      "管理者",
    ],
    answerEn:
      "Some marketplace listings (and other content) may require **admin review** before they are visible to everyone. If your item doesn’t appear immediately, wait for moderation or check **Dashboard** for status. Admins may reject or remove content that violates **Terms** or quality guidelines.",
    answerJa:
      "マーケットプレイス等のコンテンツは、**管理者による確認**のあとで公開される場合があります。すぐに表示されない場合は時間をおくか、**マイページ**で状態を確認してください。**利用規約**やガイドラインに反する場合は却下・削除されることがあります。",
  },
  {
    id: "registration",
    topic: "registration",
    keywords: [
      "register",
      "sign up",
      "create account",
      "account creation",
      "新規登録",
      "アカウント作成",
      "登録方法",
    ],
    answerEn:
      "Use **Create account** / **Register** from the navigation (or the login page). Provide the requested details and complete any **email confirmation** step if enabled. After that, sign in with **Login** to access **Dashboard**, favorites, and marketplace actions that require auth.",
    answerJa:
      "ナビの**アカウント作成**／**新規登録**（またはログインページ）から登録します。必要項目を入力し、設定されている場合は**メール確認**を完了してください。その後**ログイン**で**マイページ**、お気に入り、要ログインのマーケットプレイス機能にアクセスできます。",
  },
  {
    id: "login_password",
    topic: "registration",
    keywords: [
      "login",
      "sign in",
      "password",
      "forgot password",
      "reset password",
      "ログイン",
      "パスワード",
      "パスワード忘れ",
    ],
    answerEn:
      "Open **Login**, enter your email and password. If you forgot your password, use the **reset password** flow on the site (check your spam folder for emails). For persistent issues, use **Contact**—we can’t recover passwords manually via the chatbot.",
    answerJa:
      "**ログイン**からメールとパスワードでサインインします。パスワードを忘れた場合はサイト上の**パスワードリセット**の流れを利用し、メールが届かない場合は迷惑メールもご確認ください。解決しない場合は**お問い合わせ**へ。チャットでパスワードを代わりに復旧することはできません。",
  },
  {
    id: "profile_dashboard",
    topic: "profile",
    keywords: [
      "profile",
      "dashboard",
      "my page",
      "account settings",
      "avatar",
      "edit profile",
      "マイページ",
      "プロフィール",
      "設定",
    ],
    answerEn:
      "After logging in, open **Dashboard** / **My page** from the user menu. There you can update **profile** details (such as name or avatar) where the UI allows. Supplier or marketplace records may have separate edit flows—use the buttons on those pages or ask via **Contact** if something is unclear.",
    answerJa:
      "ログイン後、ユーザーメニューから**マイページ**／**ダッシュボード**を開きます。画面の案内に沿って**プロフィール**（表示名やアバターなど）を更新できます。サプライヤーや出品情報の編集は各ページの専用操作がある場合があります。分からない点は**お問い合わせ**へ。",
  },
  {
    id: "favorites",
    topic: "favorites",
    keywords: [
      "favorite",
      "favourites",
      "heart",
      "save supplier",
      "bookmark",
      "お気に入り",
      "ハート",
      "保存",
    ],
    answerEn:
      "When logged in, you can **save** suppliers you care about using the heart/favorite control on supplier pages (wording may vary). Find your saved list from the **Dashboard** / favorites area in the account menu. You need an account; favorites are tied to your login.",
    answerJa:
      "ログイン中にサプライヤー詳細の**お気に入り**（ハート等）で保存できます。一覧は**マイページ**／アカウントメニュー内のお気に入り欄から確認します。アカウントが必要で、ログインと紐づきます。",
  },
  {
    id: "contact_form",
    topic: "contact_form",
    keywords: [
      "contact form",
      "contact us",
      "email site",
      "support",
      "お問い合わせフォーム",
      "問い合わせフォーム",
      "サポート",
    ],
    answerEn:
      "Use **Contact** / **Contact form** in the footer or navigation. Companies interested in being listed should enter **company name**, **contact person**, **email**, and **phone** (required), plus optional details such as products/services, address, website, and a message. For marketplace deals with a seller, use the contact options on that listing instead.",
    answerJa:
      "フッターやナビの**お問い合わせ**／**お問い合わせフォーム**を開き、掲載希望の場合は**会社名・ご担当者名・メール・電話**（必須）と、任意で取扱商品・所在地・URL・ご質問などを入力して送信します。個別の売買交渉は出品ページの連絡手段をご利用ください。",
  },
  {
    id: "language_switch",
    topic: "language_switch",
    keywords: [
      "language",
      "japanese",
      "english",
      "switch lang",
      "日本語",
      "英語",
      "言語",
      "切り替え",
    ],
    answerEn:
      "Use the **globe** icon in the header (with EN/JA badge). Clicking it toggles between **English** and **Japanese** for the UI. Your choice is remembered in the browser. This assistant answers in the same language as the site.",
    answerJa:
      "ヘッダーの**地球儀アイコン**（E/J バッジ付き）を押すと、UI が**英語**と**日本語**で切り替わります。選択はブラウザに保存されます。このチャットもサイトと同じ言語で回答します。",
  },
  {
    id: "categories",
    topic: "categories",
    keywords: [
      "category",
      "categories",
      "filter by type",
      "seafood",
      "equipment",
      "カテゴリー",
      "種類",
    ],
    answerEn:
      "On **Suppliers** and **Marketplace**, use **category** filters or the search box to narrow by type (e.g. seafood, equipment). Exact category names follow what admins configure in the database. If something is miscategorized, report it via **Contact** or any **report** tool on the listing if available.",
    answerJa:
      "**サプライヤー**や**マーケットプレイス**では**カテゴリー**フィルターや検索で種類を絞り込めます。名称は管理者が設定した一覧に準じます。分類の誤りは**お問い合わせ**や、該当ページに**通報**機能があればそちらからお知らせください。",
  },
  {
    id: "reporting",
    topic: "reporting",
    keywords: [
      "report",
      "abuse",
      "scam",
      "inappropriate",
      "flag",
      "通報",
      "不正",
      "不適切",
    ],
    answerEn:
      "If a listing or profile looks wrong or unsafe, use any **Report** control on that page if present, and/or email via **Contact** with the page URL and a short description. Admins can review under site rules. We can’t guarantee outcomes via this chat—use the official channels.",
    answerJa:
      "不審・不適切な掲載がある場合、ページ上に**通報**があれば利用し、**お問い合わせ**にURLと状況を送ってください。管理者が**利用規約**に沿って確認します。チャットから個別の処理結果を保証することはできません。",
  },
  {
    id: "terms_privacy",
    topic: "terms_privacy",
    keywords: [
      "terms",
      "privacy",
      "rules",
      "policy",
      "legal",
      "利用規約",
      "プライバシー",
      "規約",
    ],
    answerEn:
      "Site rules are in **Terms** and **Privacy** in the footer. They cover acceptable use, listings, and data practices. This assistant **does not give legal advice**—read those pages or consult a professional for legal questions.",
    answerJa:
      "ルールはフッターの**利用規約**と**プライバシーポリシー**に記載されています。本チャットは**法的助言をしません**。内容は各ページをご確認のうえ、必要なら専門家にご相談ください。",
  },
  {
    id: "navigation_help",
    topic: "navigation",
    keywords: [
      "where is",
      "how to navigate",
      "menu",
      "footer",
      "リンク",
      "どこ",
      "ページ",
    ],
    answerEn:
      "Main sections: **Suppliers**, **Marketplace** (Buy & Sell), **News**, **Jobs**, **Kitchenware** links, **Links**, **About**, **Contact**, **Login** / account. The **mobile menu** (hamburger) repeats these. Footer links duplicate key pages.",
    answerJa:
      "主なページ:**サプライヤー**、**売り&買い**（Buy & Sell）、**ニュース**、**求人**、**キッチン用品**、**リンク集**、**About**、**お問い合わせ**、**ログイン**／アカウントです。**スマホ**はハンバーガーメニューから同様に開けます。フッターにも主要リンクがあります。",
  },
  {
    id: "jobs_whatsapp",
    topic: "jobs_notice",
    keywords: [
      "job",
      "jobs",
      "vacancy",
      "whatsapp job",
      "求人",
      "採用",
      "バイト",
    ],
    answerEn:
      "**Job Vacancies** is a simple notice-style form: you fill structured fields and may send the text via **WhatsApp** if the site operator configured a number (`NEXT_PUBLIC_JOBS_WHATSAPP`). It’s a bulletin tool, not a full ATS; employers remain responsible for compliant job ads (see the disclaimer on that page).",
    answerJa:
      "**求人情報**ページは簡易の告知用フォームです。項目を入力し、運営が番号を設定している場合は**WhatsApp**で文面を送れます。本格的な採用管理システムではなく、求人広告の法令遵守は掲載者の責任です（同ページの注意書きをご確認ください）。",
  },
  {
    id: "admin_overview",
    topic: "admin_approval",
    keywords: [
      "admin dashboard",
      "who approves",
      "moderator",
      "管理者画面",
    ],
    answerEn:
      "**Admin** features are restricted to authorized staff. They may approve marketplace items, manage suppliers, and handle reports. Regular users use **Dashboard** for their own profile and favorites—not the admin console. This chat cannot grant admin access or share internal tools.",
    answerJa:
      "**管理者**機能は権限のある運営者のみです。出品承認やサプライヤー管理、通報対応などを行います。一般ユーザーは**マイページ**で自身のプロフィールやお気に入りを管理します。本チャットで管理者権限を付与したり内部ツールを案内することはできません。",
  },
];

/** Compact grounding text for the model (language-specific). */
export function buildKnowledgeCorpus(lang: "en" | "ja"): string {
  return CHATBOT_KNOWLEDGE.map((e) => {
    const body = lang === "ja" ? e.answerJa : e.answerEn;
    return `[${e.topic}] ${body.replace(/\*\*/g, "")}`;
  }).join("\n\n");
}
