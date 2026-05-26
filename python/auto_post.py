"""
auto_post.py
============

Daily automation for The Kitchen Connection (singapore_food2.0).

Pipeline
--------
1. Collect Singapore F&B stories from the RSS feeds listed in
   the hard-coded ``SOURCES`` list.
2. Use OpenAI to produce a bilingual (EN / JA) summary, excerpt, body,
   SEO keywords, hashtags, EN+JA Instagram captions AND a one-line
   ``image_scene`` description for each story.
3. Always generate a brand-styled hero image with DALL·E (gpt-image-1)
   using the editorial B2B prompt template described in the client brief.
   Source-site ``og:image`` is NEVER reused — every article gets a unique,
   article-content-aware photograph.
4. Composite the brand logo (apple-touch-icon, 180 px) onto the bottom-right
   of the hero with a soft warm-white panel, then upload to Supabase Storage.
5. Insert the row into ``public.news_articles`` (published=true) with the
   default tags + generated SEO keywords.
6. Pick today's target category according to the weekly schedule, find the
   best published-but-not-instagrammed article in that category, and publish
   it to the @the_kitchen_connection_sg Instagram Business account via the
   Instagram Graph API.  Set ``instagram_posted=true`` to prevent re-posting.
7. Send a Slack notification (success or failure) so the team has a daily
   trail without checking logs.

Run modes (CLI) — invoke from the repository root
-------------------------------------------------
    python python/auto_post.py collect         # scrape + summarise + insert news only
    python python/auto_post.py instagram       # post the next queued article to IG
    python python/auto_post.py run             # collect then instagram (daily default)
    python python/auto_post.py refresh-token   # refresh the long-lived IG token

Configuration is read from environment variables.  Locally, place secrets
in ``.env.local`` at the repo root (loaded automatically via python-dotenv).
On CI, GitHub Secrets provide the same variables.
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import io
import json
import logging
import os
import re
import sys
import time
import traceback
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import feedparser
import requests
from bs4 import BeautifulSoup

# ─────────────────────────────────────────────────────────────────────────────
# Load configuration from environment variables (.env.local → os.environ)
# ─────────────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent

from dotenv import load_dotenv  # noqa: E402
load_dotenv(REPO_ROOT / ".env.local")

def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)

SUPABASE_URL = _env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
SUPABASE_SERVICE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = _env("SUPABASE_NEWS_BUCKET", "logos")

OPENAI_API_KEY = _env("OPENAI_API_KEY").strip()
OPENAI_MODEL = _env("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_IMAGE_MODEL = _env("OPENAI_IMAGE_MODEL", "gpt-image-1")
OPENAI_IMAGE_SIZE = _env("OPENAI_IMAGE_SIZE", "1024x1024")
OPENAI_IMAGE_QUALITY = _env("OPENAI_IMAGE_QUALITY", "high")

IG_USER_ID = _env("IG_USER_ID")
IG_ACCESS_TOKEN = _env("IG_ACCESS_TOKEN")
IG_APP_ID = _env("IG_APP_ID")
IG_APP_SECRET = _env("IG_APP_SECRET")
IG_GRAPH_VERSION = _env("IG_GRAPH_VERSION", "v21.0")
IG_MAX_RETRY_ATTEMPTS = int(_env("IG_MAX_RETRY_ATTEMPTS", "3"))

SLACK_WEBHOOK_URL = _env("SLACK_WEBHOOK_URL")

NEWS_AUTHOR = _env("NEWS_AUTHOR", "Editorial Department")
MAX_NEW_ARTICLES_PER_RUN = int(_env("MAX_NEW_ARTICLES_PER_RUN", "1"))
NEWS_MAX_AGE_DAYS = int(_env("NEWS_MAX_AGE_DAYS", "30"))

BRAND_LOGO_SRC = _env("BRAND_LOGO_SRC", "public/apple-touch-icon.png")
LOGO_OVERLAY_ENABLED = _env("LOGO_OVERLAY_ENABLED", "true").lower() in ("true", "1", "yes")
LOGO_OVERLAY_WIDTH_RATIO = float(_env("LOGO_OVERLAY_WIDTH_RATIO", "0.07"))

_FB_KEYWORDS = (
    "food", "beverage", "restaurant", "f&b", "cafe", "café", "dining",
    "chef", "hospitality", "hotel", "bar", "kitchen", "menu", "cuisine",
    "fnb", "drink", "coffee", "tea", "bakery", "dessert", "catering",
)
_REGULATION_KEYWORDS = (
    "singapore food agency", "sfa", "food safety", "food regulation",
    "licensing", "food licence", "food license", "compliance", "hygiene",
    "halal", "food import", "labelling", "labeling",
)

SOURCES: List[Dict[str, Any]] = [
    {"name": "Singapore Business Review",
     "rss": "https://sbr.com.sg/rss.xml",
     "category": "industry",
     "keywords": _FB_KEYWORDS},
    {"name": "The Business Times – Singapore",
     "rss": "https://www.businesstimes.com.sg/rss/singapore",
     "category": "industry",
     "keywords": _FB_KEYWORDS},
    {"name": "The Business Times – Regulation",
     "rss": "https://www.businesstimes.com.sg/rss/top-stories",
     "category": "regulation",
     "keywords": _REGULATION_KEYWORDS},
    {"name": "FoodNavigator Asia",
     "rss": "https://www.foodnavigator-asia.com/arc/outboundfeeds/rss/",
     "category": "trend"},
    {"name": "Asia Food Journal",
     "rss": "https://asiafoodjournal.com/feed/",
     "category": "trend"},
    {"name": "Saladplate",
     "rss": "https://www.saladplate.com/feed/",
     "category": "event"},
]

WEEKDAY_CATEGORY: Dict[int, str] = {
    0: "industry",
    1: "regulation",
    2: "trend",
    3: "industry",
    4: "event",
    5: "trend",
    6: "industry",
}

DEFAULT_TAGS: List[str] = ["F&B News", "Singapore"]

FALLBACK_INSTAGRAM_HASHTAGS: List[str] = [
    "#SingaporeFNB",
    "#SingaporeRestaurants",
    "#SingaporeFood",
    "#SingaporeBusiness",
    "#SGFNB",
]

CATEGORIES = ("regulation", "trend", "event", "industry")

try:
    SGT = ZoneInfo("Asia/Singapore")
except Exception:  # Windows without `tzdata` installed
    SGT = dt.timezone(dt.timedelta(hours=8), name="Asia/Singapore")

USER_AGENT = (
    "Mozilla/5.0 (compatible; KitchenConnectionBot/1.0; "
    "+https://thekitchenconnection.sg)"
)
HTTP_TIMEOUT = 30

log = logging.getLogger("auto_post")


# ─────────────────────────────────────────────────────────────────────────────
# Image prompt — editorial B2B template per client brief 2026-05
# ─────────────────────────────────────────────────────────────────────────────

IMAGE_PROMPT_TEMPLATE = (
    "A realistic editorial photograph of {scene}, set in Singapore's F&B "
    "industry environment. Professional B2B atmosphere, modern but realistic, "
    "natural lighting, detailed textures, industry-focused composition, "
    "suitable for a trade news article. The image must depict a REAL "
    "physical scene — never a chart, graph, infographic, screenshot, data "
    "visualization, survey, or any on-screen content. No text, no logos, "
    "no exaggerated futuristic elements, no distorted faces, no watermark. "
    "Shot on Sony A1, 35mm lens, high-resolution, documentary-style "
    "photography."
)

# Used only when the LLM fails to produce an article-specific scene.
CATEGORY_FALLBACK_SCENE: Dict[str, str] = {
    "regulation": (
        "a Singapore food-safety inspector reviewing compliance documents "
        "inside a clean modern commercial kitchen"
    ),
    "event": (
        "an elegantly set Singapore restaurant interior prepared for a "
        "private F&B industry event, no people facing the camera"
    ),
    "trend": (
        "a beautifully plated contemporary Singapore dish with fresh local "
        "ingredients arranged on a marble counter"
    ),
    "industry": (
        "a busy professional Singapore commercial kitchen with chefs in "
        "uniform plating dishes, no faces visible"
    ),
}


# ─────────────────────────────────────────────────────────────────────────────
# Slack notifications
# ─────────────────────────────────────────────────────────────────────────────

def notify_slack(text: str, level: str = "info") -> None:
    """Best-effort Slack notification. Never raises."""
    if not SLACK_WEBHOOK_URL:
        return
    emoji = {
        "info":    ":information_source:",
        "success": ":white_check_mark:",
        "warning": ":warning:",
        "error":   ":x:",
    }.get(level, ":memo:")
    payload = {"text": f"{emoji} *auto_post* — {text}"}
    try:
        r = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=10)
        if not r.ok:
            log.warning("Slack returned %s: %s", r.status_code, r.text[:200])
    except Exception as exc:
        log.warning("Slack notification failed: %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# Supabase REST helpers (service_role — RLS bypassed)
# ─────────────────────────────────────────────────────────────────────────────

def _sb_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local or environment."
        )
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def sb_select_news(filters: Dict[str, str], limit: int = 1,
                   select: str = "*", order: Optional[str] = None) -> List[Dict[str, Any]]:
    params: Dict[str, str] = {**filters, "select": select, "limit": str(limit)}
    if order:
        params["order"] = order
    url = f"{SUPABASE_URL}/rest/v1/news_articles"
    r = requests.get(url, params=params, headers=_sb_headers(), timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return r.json()


def sb_insert_news(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Insert a row, returning the inserted record. Skips on slug conflict."""
    url = f"{SUPABASE_URL}/rest/v1/news_articles"
    headers = _sb_headers({"Prefer": "return=representation,resolution=ignore-duplicates"})
    r = requests.post(url, headers=headers, json=row, timeout=HTTP_TIMEOUT)
    if r.status_code == 409:
        log.info("Slug already exists, skipping: %s", row.get("slug"))
        return None
    if not r.ok:
        log.error("Insert failed (%s): %s", r.status_code, r.text[:400])
        r.raise_for_status()
    data = r.json()
    return data[0] if isinstance(data, list) and data else (data or None)


def sb_update_news(row_id: str, patch: Dict[str, Any]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/news_articles"
    headers = _sb_headers({"Prefer": "return=minimal"})
    r = requests.patch(url, params={"id": f"eq.{row_id}"}, headers=headers,
                       json=patch, timeout=HTTP_TIMEOUT)
    if not r.ok:
        log.error("Update failed (%s): %s", r.status_code, r.text[:400])
        r.raise_for_status()


def sb_storage_upload(image_bytes: bytes, ext: str = "jpg") -> Optional[str]:
    """Upload binary image to Supabase Storage and return the public URL."""
    digest = hashlib.sha1(image_bytes[:1024]).hexdigest()[:10]
    path = f"news/{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d')}-{digest}.{ext}"
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{path}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": mime,
        "x-upsert": "true",
    }
    r = requests.post(url, headers=headers, data=image_bytes, timeout=HTTP_TIMEOUT)
    if not r.ok:
        log.error("Storage upload failed (%s): %s", r.status_code, r.text[:300])
        return None
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_STORAGE_BUCKET}/{path}"


# ─────────────────────────────────────────────────────────────────────────────
# Article scraping
# ─────────────────────────────────────────────────────────────────────────────

def slugify(title: str, when: Optional[dt.date] = None) -> str:
    """URL-safe slug with a YYYYMMDD date suffix."""
    normalized = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    slug = re.sub(r"-+", "-", slug)
    if not slug:
        slug = "article"
    if len(slug) > 70:
        slug = slug[:70].rstrip("-")
    date_str = (when or dt.datetime.now(SGT).date()).strftime("%Y%m%d")
    return f"{slug}-{date_str}"


def _parse_entry_datetime(entry: Any) -> Optional[dt.datetime]:
    """Best-effort parse of a feedparser entry's publish date to aware UTC."""
    for key in ("published_parsed", "updated_parsed"):
        st = entry.get(key) if isinstance(entry, dict) else getattr(entry, key, None)
        if st:
            try:
                return dt.datetime(*st[:6], tzinfo=dt.timezone.utc)
            except Exception:
                pass
    for key in ("published", "updated"):
        raw = entry.get(key) if isinstance(entry, dict) else getattr(entry, key, None)
        if not raw:
            continue
        try:
            from email.utils import parsedate_to_datetime
            parsed = parsedate_to_datetime(raw)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=dt.timezone.utc)
            return parsed.astimezone(dt.timezone.utc)
        except Exception:
            continue
    return None


def fetch_rss_entries(rss_url: str, limit: int = 8,
                      keywords: Optional[Tuple[str, ...]] = None) -> List[Dict[str, Any]]:
    """Fetch an RSS feed and return entries sorted newest-first.

    Entries older than ``NEWS_MAX_AGE_DAYS`` are dropped.  If ``keywords`` is
    supplied, entries whose title+summary do not match any keyword are
    dropped — used to narrow broad feeds (SBR / BT main feed) down to F&B.
    """
    log.debug("Fetching RSS: %s", rss_url)
    feed = feedparser.parse(rss_url, agent=USER_AGENT)
    cutoff: Optional[dt.datetime] = None
    if NEWS_MAX_AGE_DAYS > 0:
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=NEWS_MAX_AGE_DAYS)
    kw_patterns = None
    if keywords:
        kw_patterns = [
            re.compile(r"(?<![A-Za-z0-9])" + re.escape(k.lower())
                       + r"(?![A-Za-z0-9])")
            for k in keywords
        ]
    out: List[Dict[str, Any]] = []
    for entry in feed.entries:
        title = (entry.get("title") or "").strip()
        summary = (entry.get("summary") or entry.get("description") or "").strip()
        if kw_patterns:
            haystack = f"{title} {summary}".lower()
            if not any(p.search(haystack) for p in kw_patterns):
                continue
        published_dt = _parse_entry_datetime(entry)
        if cutoff is not None and published_dt is not None and published_dt < cutoff:
            log.debug("Skipping stale entry (%s): %s",
                      published_dt.isoformat(), title)
            continue
        out.append({
            "title": title,
            "link": entry.get("link") or "",
            "summary": summary,
            "published": entry.get("published") or entry.get("updated") or "",
            "_published_dt": published_dt,
        })
    out.sort(key=lambda e: e["_published_dt"] or dt.datetime.min.replace(tzinfo=dt.timezone.utc),
             reverse=True)
    return out[:limit]


def resolve_google_news_url(url: str) -> str:
    """Decode a news.google.com/rss/articles/... redirect to the publisher URL.

    Returns the decoded URL on success, or the input URL on failure.
    """
    if "news.google.com" not in url:
        return url
    m = re.search(r"/articles/([^?/]+)", url)
    if not m:
        return url
    encoded = m.group(1)
    try:
        padded = encoded + "=" * (-len(encoded) % 4)
        raw = base64.urlsafe_b64decode(padded)
    except Exception as exc:
        log.debug("Google News URL decode failed for %s: %s", url, exc)
        return url
    match = re.search(rb"https?://[\w./\-_%?=&#~+]+", raw)
    if not match:
        return url
    candidate = match.group(0).decode("utf-8", errors="ignore")
    candidate = candidate.rstrip("\x00\x01\x02\x03\x12\x13")
    log.debug("Resolved Google News URL: %s -> %s", url, candidate)
    return candidate


def fetch_page_text(url: str) -> Optional[str]:
    """Return the visible text of a page, stripped of scripts/styles/nav."""
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=HTTP_TIMEOUT)
        r.raise_for_status()
    except Exception as exc:
        log.warning("Failed to fetch %s: %s", url, exc)
        return None
    soup = BeautifulSoup(r.content, "html.parser")
    for el in soup(["script", "style", "header", "footer", "nav", "aside"]):
        el.extract()
    text = re.sub(r"\s+", " ", soup.get_text(separator=" ")).strip()
    return text or None


# ─────────────────────────────────────────────────────────────────────────────
# OpenAI helpers (SDK v1.x)
# ─────────────────────────────────────────────────────────────────────────────

_openai_client = None


def _openai():
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            return None
        from openai import OpenAI  # lazy import
        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


CONTENT_MAX_SENTENCES = 10


def _to_plain_text(text: str, max_sentences: int = CONTENT_MAX_SENTENCES,
                   preserve_paragraphs: bool = False) -> str:
    """Strip HTML, normalise whitespace, cap at N sentences."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    if preserve_paragraphs:
        paragraphs = [re.sub(r"[ \t]+", " ", p).strip()
                      for p in re.split(r"\n\s*\n", text)]
        paragraphs = [p for p in paragraphs if p]
        remaining = max_sentences
        out: List[str] = []
        for p in paragraphs:
            if remaining <= 0:
                break
            sentences = re.split(r"(?<=[.!?。！？])\s+", p)
            take = sentences[:remaining]
            remaining -= len(take)
            out.append(" ".join(take).strip())
        return "\n\n".join(out).strip()
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    parts = re.split(r"(?<=[.!?。！？])\s+", text)
    return " ".join(parts[:max_sentences]).strip()


def _coerce_list(value: Any, *, prefix: str = "") -> List[str]:
    """Convert a list/string/None into a clean list[str].

    If ``prefix`` is supplied (e.g. ``"#"`` for hashtags), each item that does
    not already start with the prefix gets it prepended.  Empty / non-string
    items are dropped.
    """
    if not value:
        return []
    if isinstance(value, str):
        items = [s.strip() for s in re.split(r"[,\n]", value)]
    elif isinstance(value, (list, tuple)):
        items = [str(s).strip() for s in value]
    else:
        return []
    cleaned: List[str] = []
    for item in items:
        if not item:
            continue
        if prefix and not item.startswith(prefix):
            item = prefix + re.sub(r"^\W+", "", item)
        cleaned.append(item)
    # de-dup, preserving order
    seen: set[str] = set()
    out: List[str] = []
    for item in cleaned:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


def summarise_bilingual(title: str, body: str, category: str) -> Optional[Dict[str, Any]]:
    """Produce the full bilingual editorial package for a story.

    Returns a dict with:
        title_en, title_ja, excerpt_en, excerpt_ja, content_en, content_ja,
        caption_en, caption_ja, seo_keywords (list), hashtags (list),
        image_scene (single sentence).

    Returns None if OpenAI is unavailable or fails — callers should skip the
    article rather than inserting English-only fallback data.
    """
    client = _openai()
    fallback_scene = CATEGORY_FALLBACK_SCENE.get(category) \
        or CATEGORY_FALLBACK_SCENE["industry"]
    if client is None:
        log.warning("OPENAI_API_KEY not set — skipping article (no fallback inserted).")
        return None

    body_clipped = (body or "")[:4000]
    prompt = (
        "You are the editor of The Kitchen Connection — a Singapore F&B B2B "
        "trade portal for restaurants, hotels, cafes, suppliers, importers, "
        "distributors, and foodservice operators. Rewrite the source as an "
        "ORIGINAL summary; do NOT copy phrasing. Prioritise relevance to "
        "Singapore F&B trade. Skip gossip / pure-consumer angles. Stay "
        "factual; no invented facts; no source URL.\n\n"
        "Return STRICT JSON with these keys (plain text, no HTML/Markdown):\n"
        "  title_en:    <=90 chars, SEO-aware English headline\n"
        "  title_ja:    <=90文字、自然な日本語の見出し\n"
        "  excerpt_en:  2 sentences, <=160 chars\n"
        "  excerpt_ja:  2文、<=160文字\n"
        f"  content_en:  ~{CONTENT_MAX_SENTENCES} sentences total, in 3 "
        "labelled paragraphs separated by blank lines: \"News Summary.\" / "
        "\"Why It Matters for Singapore F&B.\" / \"Key Takeaway.\"\n"
        "  content_ja:  上記と同構成・同分量の自然な日本語（直訳禁止）\n"
        "  caption_en:  professional B2B Instagram caption in English, "
        "<=400 chars, no hashtags (appended separately)\n"
        "  caption_ja:  自然な日本語のInstagramキャプション、<=400文字、"
        "ハッシュタグは含めない\n"
        "  seo_keywords: JSON array of 5–8 English SEO keywords/phrases "
        "(no '#', lowercase, comma-free)\n"
        "  hashtags:    JSON array of 5–8 Instagram hashtags relevant to "
        "Singapore F&B, each starting with '#'. Always include "
        "#SingaporeFNB and #TheKitchenConnection.\n"
        "  image_scene: ONE concise sentence (<=200 chars) describing a "
        "realistic PHYSICAL Singapore F&B scene inspired by this story's "
        "REAL-WORLD IMPACT — NOT the article's visual content. "
        "Focus on tangible objects: ingredients, plated dishes, kitchen "
        "equipment, restaurant interiors, market stalls, hands preparing "
        "food, delivery riders, grocery shelves, etc. "
        "NEVER describe charts, graphs, bar charts, survey results, "
        "infographics, data visualizations, screenshots, dashboards, "
        "people's faces, text, logos, or signs. If the article is about "
        "a report/survey/study, describe the real-world scene it discusses "
        "(e.g. a busy hawker centre, a chef adjusting menu prices) — "
        "NOT the report itself.\n\n"
        f"SOURCE TITLE: {title}\nSOURCE:\n{body_clipped}"
    )
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.35,
            max_tokens=1600,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(_strip_code_fences(raw))

        out: Dict[str, Any] = {
            "title_en":     title.strip(),
            "title_ja":     title.strip(),
            "excerpt_en":   "",
            "excerpt_ja":   "",
            "content_en":   "",
            "content_ja":   "",
            "caption_en":   "",
            "caption_ja":   "",
            "seo_keywords": ["Singapore F&B", "food and beverage", "hospitality"],
            "hashtags":     list(FALLBACK_INSTAGRAM_HASHTAGS),
            "image_scene":  fallback_scene,
        }
        for k in ("title_en", "title_ja", "excerpt_en", "excerpt_ja",
                  "content_en", "content_ja", "caption_en", "caption_ja",
                  "image_scene"):
            v = data.get(k)
            if isinstance(v, str) and v.strip():
                out[k] = v.strip()

        seo = _coerce_list(data.get("seo_keywords"))
        if seo:
            out["seo_keywords"] = seo[:8]
        tags = _coerce_list(data.get("hashtags"), prefix="#")
        if tags:
            # Always make sure these two brand hashtags are present.
            for required in ("#SingaporeFNB", "#TheKitchenConnection"):
                if not any(t.lower() == required.lower() for t in tags):
                    tags.append(required)
            out["hashtags"] = tags[:10]

        # Defensive cleanup of free-text fields.
        out["content_en"] = _to_plain_text(out["content_en"], preserve_paragraphs=True)
        out["content_ja"] = _to_plain_text(out["content_ja"], preserve_paragraphs=True)
        out["excerpt_en"] = _to_plain_text(out["excerpt_en"], max_sentences=1)[:160]
        out["excerpt_ja"] = _to_plain_text(out["excerpt_ja"], max_sentences=1)[:160]
        out["caption_en"] = _to_plain_text(out["caption_en"], max_sentences=4)[:500]
        out["caption_ja"] = _to_plain_text(out["caption_ja"], max_sentences=4)[:500]
        # Image scene must be a single safe sentence — strip any chart/text refs.
        scene = re.sub(r"\s+", " ", out["image_scene"]).strip().rstrip(".")
        out["image_scene"] = scene[:240] or fallback_scene
        return out
    except Exception as exc:
        log.error("OpenAI summarisation failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Image generation + logo overlay
# ─────────────────────────────────────────────────────────────────────────────

_logo_cache: Optional[bytes] = None


def _load_logo() -> Optional[bytes]:
    """Load the brand logo from disk or URL once per process."""
    global _logo_cache
    if _logo_cache is not None:
        return _logo_cache or None
    src = BRAND_LOGO_SRC
    if not src:
        return None
    try:
        if src.startswith(("http://", "https://")):
            r = requests.get(src, timeout=HTTP_TIMEOUT)
            r.raise_for_status()
            _logo_cache = r.content
        else:
            path = Path(src)
            if not path.is_absolute():
                path = REPO_ROOT / path
            with open(path, "rb") as fh:
                _logo_cache = fh.read()
    except Exception as exc:
        log.warning("Could not load brand logo from %s: %s", src, exc)
        _logo_cache = b""  # negative cache
        return None
    return _logo_cache or None


def overlay_brand_logo(image_bytes: bytes) -> bytes:
    """Composite the brand logo onto the bottom-right with a soft panel.

    Uses LANCZOS resampling and sharpening to keep the logo crisp even at
    small sizes.  The source logo should be at least 180 px wide
    (apple-touch-icon.png) — the favicon icon.png (~32 px) will look blurry
    no matter what we do.
    """
    if not LOGO_OVERLAY_ENABLED:
        return image_bytes
    logo_bytes = _load_logo()
    if not logo_bytes:
        return image_bytes
    try:
        from PIL import Image, ImageFilter
        base = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        logo_full = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
        bw, bh = base.size

        target_w = max(80, int(bw * LOGO_OVERLAY_WIDTH_RATIO))
        ratio = target_w / max(1, logo_full.width)
        target_h = max(1, int(logo_full.height * ratio))

        # If the source logo is smaller than the target we are upscaling, which
        # always loses sharpness. Use a 2× super-sample then sharpen to keep
        # edges clean even on lower-res source assets.
        super_w = target_w * 2
        super_h = target_h * 2
        logo = logo_full.resize((super_w, super_h), Image.LANCZOS)
        logo = logo.filter(ImageFilter.UnsharpMask(radius=1.5, percent=80, threshold=2))
        logo = logo.resize((target_w, target_h), Image.LANCZOS)

        margin = int(bw * 0.035)
        panel_pad = max(6, int(target_w * 0.10))
        panel = Image.new(
            "RGBA",
            (logo.width + panel_pad * 2, logo.height + panel_pad * 2),
            (250, 250, 249, 175),  # warm white at ~69% opacity
        )
        pos_panel = (bw - panel.width - margin, bh - panel.height - margin)
        base.alpha_composite(panel, pos_panel)
        pos_logo = (pos_panel[0] + panel_pad, pos_panel[1] + panel_pad)
        base.alpha_composite(logo, pos_logo)
        out = io.BytesIO()
        base.convert("RGB").save(out, format="JPEG", quality=92, optimize=True)
        return out.getvalue()
    except Exception as exc:
        log.warning("Logo overlay failed (%s) — using base image.", exc)
        return image_bytes


def build_image_prompt(image_scene: str, category: str) -> str:
    """Assemble the final DALL·E prompt from the article-specific scene."""
    scene = (image_scene or "").strip()
    if not scene:
        scene = CATEGORY_FALLBACK_SCENE.get(category) \
            or CATEGORY_FALLBACK_SCENE["industry"]
    return IMAGE_PROMPT_TEMPLATE.format(scene=scene)


def generate_image_for(image_scene: str, category: str) -> Optional[str]:
    """Generate a brand-styled hero image, overlay the logo, and upload to
    Supabase Storage.  Returns the public image URL or None on failure.
    """
    client = _openai()
    if client is None:
        log.warning("OpenAI key missing — cannot generate image.")
        return None
    prompt = build_image_prompt(image_scene, category)
    log.info("Image prompt: %s", prompt)
    try:
        kwargs: Dict[str, Any] = {
            "model": OPENAI_IMAGE_MODEL,
            "prompt": prompt,
            "size": OPENAI_IMAGE_SIZE,
            "n": 1,
        }
        if OPENAI_IMAGE_MODEL.startswith("gpt-image") and OPENAI_IMAGE_QUALITY:
            kwargs["quality"] = OPENAI_IMAGE_QUALITY
        r = client.images.generate(**kwargs)
        item = r.data[0]
        if getattr(item, "url", None):
            img = requests.get(item.url, timeout=HTTP_TIMEOUT).content
        else:
            img = base64.b64decode(item.b64_json)
        composited = overlay_brand_logo(img)
        return sb_storage_upload(composited, ext="jpg")
    except Exception as exc:
        log.error("Image generation failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Category routing & weekly rotation
# ─────────────────────────────────────────────────────────────────────────────

def classify_category(source_category: str) -> str:
    return source_category if source_category in CATEGORIES else "industry"


def target_category_for_today() -> str:
    weekday = dt.datetime.now(SGT).weekday()
    return WEEKDAY_CATEGORY[weekday]


def pick_for_instagram() -> Optional[Dict[str, Any]]:
    """Pick the next published-but-not-Instagrammed article for today."""
    base_url = f"{SUPABASE_URL}/rest/v1/news_articles"

    def _query(category: Optional[str]) -> List[Dict[str, Any]]:
        params = {
            "select": "id,slug,title,title_ja,excerpt,excerpt_ja,image,category,"
                      "published_at,instagram_posted,instagram_caption,"
                      "instagram_attempts,tags",
            "published": "eq.true",
            "instagram_posted": "is.false",
            "image": "neq.",
            "order": "published_at.desc.nullslast,created_at.desc",
            "limit": "50",
            "instagram_attempts": f"lt.{IG_MAX_RETRY_ATTEMPTS}",
        }
        if category:
            params["category"] = f"eq.{category}"
        r = requests.get(base_url, params=params, headers=_sb_headers(), timeout=HTTP_TIMEOUT)
        r.raise_for_status()
        return r.json()

    today_cat = target_category_for_today()
    log.info("Today's IG target category (weekday rotation): %s", today_cat)
    pool = _query(today_cat)
    if pool:
        return pool[0]

    log.info("No candidate for today's category — falling back to least-recently-posted.")
    last_by_cat: Dict[str, str] = {}
    for cat in CATEGORIES:
        rr = requests.get(
            base_url,
            params={
                "select": "instagram_posted_at",
                "category": f"eq.{cat}",
                "instagram_posted": "is.true",
                "order": "instagram_posted_at.desc.nullslast",
                "limit": "1",
            },
            headers=_sb_headers(), timeout=HTTP_TIMEOUT,
        )
        if rr.ok and rr.json():
            last_by_cat[cat] = rr.json()[0].get("instagram_posted_at") or ""

    candidates = _query(None)
    if not candidates:
        return None
    candidates.sort(
        key=lambda it: (
            last_by_cat.get(it.get("category") or "industry", ""),
            -_iso_epoch(it.get("published_at")),
        )
    )
    return candidates[0]


def _iso_epoch(s: Optional[str]) -> float:
    if not s:
        return 0.0
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Instagram Graph API
# ─────────────────────────────────────────────────────────────────────────────

class InstagramError(RuntimeError):
    pass


def _ig_url(path: str) -> str:
    return f"https://graph.facebook.com/{IG_GRAPH_VERSION}/{path.lstrip('/')}"


def ig_create_media(image_url: str, caption: str) -> str:
    if not IG_USER_ID or not IG_ACCESS_TOKEN:
        raise InstagramError("IG_USER_ID and IG_ACCESS_TOKEN must be set in .env.local or environment.")
    r = requests.post(
        _ig_url(f"{IG_USER_ID}/media"),
        data={"image_url": image_url, "caption": caption,
              "access_token": IG_ACCESS_TOKEN},
        timeout=HTTP_TIMEOUT,
    )
    if not r.ok:
        raise InstagramError(f"create_media failed: {r.status_code} {r.text[:400]}")
    creation_id = r.json().get("id")
    if not creation_id:
        raise InstagramError(f"create_media returned no id: {r.text[:200]}")
    return creation_id


def ig_wait_ready(creation_id: str, max_wait_s: int = 60) -> None:
    deadline = time.time() + max_wait_s
    while time.time() < deadline:
        r = requests.get(
            _ig_url(creation_id),
            params={"fields": "status_code", "access_token": IG_ACCESS_TOKEN},
            timeout=HTTP_TIMEOUT,
        )
        if r.ok:
            status = r.json().get("status_code")
            if status == "FINISHED":
                return
            if status == "ERROR":
                raise InstagramError(f"Container errored: {r.text[:400]}")
        time.sleep(2)


def ig_publish(creation_id: str) -> str:
    r = requests.post(
        _ig_url(f"{IG_USER_ID}/media_publish"),
        data={"creation_id": creation_id, "access_token": IG_ACCESS_TOKEN},
        timeout=HTTP_TIMEOUT,
    )
    if not r.ok:
        raise InstagramError(f"media_publish failed: {r.status_code} {r.text[:400]}")
    media_id = r.json().get("id")
    if not media_id:
        raise InstagramError(f"media_publish returned no id: {r.text[:200]}")
    return media_id


def build_ig_caption(title_en: str, caption_body: str, hashtags: List[str]) -> str:
    """Assemble the final Instagram caption: title \n\n body \n\n hashtags."""
    body = (caption_body or "").strip()
    tags = hashtags or FALLBACK_INSTAGRAM_HASHTAGS
    parts = [title_en.strip()]
    if body:
        parts.append("")
        parts.append(body)
    parts.append("")
    parts.append(" ".join(tags))
    caption = "\n".join(parts).strip()
    return caption[:2150]


def refresh_long_lived_token() -> Optional[str]:
    if not IG_ACCESS_TOKEN or not IG_APP_ID or not IG_APP_SECRET:
        raise RuntimeError(
            "IG_APP_ID, IG_APP_SECRET, IG_ACCESS_TOKEN must all be set in .env.local or environment."
        )
    r = requests.get(
        _ig_url("oauth/access_token"),
        params={
            "grant_type": "fb_exchange_token",
            "client_id": IG_APP_ID,
            "client_secret": IG_APP_SECRET,
            "fb_exchange_token": IG_ACCESS_TOKEN,
        },
        timeout=HTTP_TIMEOUT,
    )
    r.raise_for_status()
    data = r.json()
    new_token = data.get("access_token")
    expires_in = data.get("expires_in")
    log.info("New long-lived token (expires in %ss): %s", expires_in, new_token)
    notify_slack(
        f"Refreshed long-lived IG token (expires_in={expires_in}s). "
        "Update `IG_ACCESS_TOKEN` in .env.local or environment.",
        level="info",
    )
    return new_token


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline steps
# ─────────────────────────────────────────────────────────────────────────────

def _hashtags_to_caption_tail(hashtags: List[str]) -> str:
    return " ".join(hashtags) if hashtags else ""


def collect_articles() -> List[Dict[str, Any]]:
    """Scrape sources → summarise → generate image → insert row."""
    inserted: List[Dict[str, Any]] = []
    seen_titles: set[str] = set()

    for source in SOURCES:
        if len(inserted) >= MAX_NEW_ARTICLES_PER_RUN:
            break
        log.info("Source: %s", source["name"])
        try:
            entries = fetch_rss_entries(
                source["rss"],
                keywords=source.get("keywords") or None,
            )
        except Exception as exc:
            log.error("Fetch error for %s: %s", source["name"], exc)
            continue
        if not entries:
            log.info("Source %s returned 0 fresh entries.", source["name"])

        for entry in entries:
            if len(inserted) >= MAX_NEW_ARTICLES_PER_RUN:
                break
            title = entry["title"]
            link = entry["link"]
            if not title or not link or title in seen_titles:
                continue
            seen_titles.add(title)

            # Pre-check by slug so we don't burn an OpenAI call on a duplicate.
            slug = slugify(title)
            if sb_select_news({"slug": f"eq.{slug}"}, limit=1):
                continue

            # Google News RSS gives us redirect URLs; try to recover the real
            # publisher URL so we can read the article body for summarisation.
            fetch_url = resolve_google_news_url(link)
            page_text = fetch_page_text(fetch_url)
            body_for_summary = page_text or entry.get("summary") or title
            category = classify_category(source.get("category", ""))

            summary = summarise_bilingual(title, body_for_summary, category)
            if summary is None:
                log.warning("Skipping '%s' — OpenAI unavailable or failed.", title)
                notify_slack(
                    f"Skipping article (OpenAI failed): _{title[:80]}_",
                    level="warning",
                )
                continue

            # Image strategy (per client brief 2026-05): ALWAYS generate a new
            # editorial photograph from the article's scene description.  The
            # source site's og:image is NEVER reused — that was producing
            # screenshots of charts / source-site graphics.
            image_url = generate_image_for(summary["image_scene"], category)

            # Build the IG caption now so it's ready when the IG step runs.
            ig_caption_body = (
                f"{summary['caption_en']}\n\n{summary['caption_ja']}".strip()
            )
            ig_caption_body_with_tags = (
                f"{ig_caption_body}\n\n{_hashtags_to_caption_tail(summary['hashtags'])}"
            ).strip()

            # Combine the brand tags with the LLM-generated SEO keywords so the
            # admin dashboard's tag UI shows them.  Brand tags always come first.
            tags = list(DEFAULT_TAGS)
            for kw in summary.get("seo_keywords", []):
                if kw and kw not in tags:
                    tags.append(kw)

            now_iso = dt.datetime.now(dt.timezone.utc).replace(microsecond=0, tzinfo=None).isoformat() + "Z"
            row = {
                "slug":               slug,
                "title":              summary["title_en"],
                "title_ja":           summary["title_ja"],
                "excerpt":            summary["excerpt_en"],
                "excerpt_ja":         summary["excerpt_ja"],
                "content":            summary["content_en"],
                "content_ja":         summary["content_ja"],
                "image":              image_url or "",
                "category":           category,
                "author":             NEWS_AUTHOR,
                "tags":               tags,
                "published":          True,
                "published_at":       now_iso,
                "display_date":       now_iso,
                "instagram_caption":  ig_caption_body_with_tags,
                "instagram_posted":   False,
                "instagram_attempts": 0,
            }
            created = sb_insert_news(row)
            if created:
                log.info("Inserted: %s [%s] from %s",
                         slug, category, source.get("name", "?"))
                created["_source_name"] = source.get("name", "")
                created["_hashtags"] = summary["hashtags"]
                inserted.append(created)
    log.info("Collection complete — %d new articles.", len(inserted))
    return inserted


def post_one_to_instagram() -> Optional[str]:
    if not IG_USER_ID or not IG_ACCESS_TOKEN:
        msg = "Instagram credentials missing (IG_USER_ID / IG_ACCESS_TOKEN) — IG step skipped."
        log.warning(msg)
        notify_slack(msg, level="warning")
        return None
    item = pick_for_instagram()
    if not item:
        msg = "No queued article available for Instagram today."
        log.info(msg)
        notify_slack(msg, level="info")
        return None

    title_en = item.get("title") or ""
    image_url = (item.get("image") or "").strip()
    if not image_url:
        msg = f"Article {item.get('slug')} has no image — skipping IG post."
        log.warning(msg)
        notify_slack(msg, level="warning")
        return None

    # ``instagram_caption`` was stored at collection time with hashtags already
    # appended.  We just prepend the headline for IG presentation.
    stored_caption = item.get("instagram_caption") or item.get("excerpt") or ""
    # If the stored caption already ends with hashtags, don't re-append.
    has_hashtags = "#" in stored_caption
    hashtags = [] if has_hashtags else FALLBACK_INSTAGRAM_HASHTAGS
    caption = build_ig_caption(title_en, stored_caption, hashtags)

    # Increment attempts upfront so failed rows naturally back off.
    attempts = int(item.get("instagram_attempts") or 0) + 1
    sb_update_news(item["id"], {"instagram_attempts": attempts})

    try:
        creation_id = ig_create_media(image_url, caption)
        ig_wait_ready(creation_id)
        media_id = ig_publish(creation_id)
    except InstagramError as exc:
        log.error("Instagram publish failed for %s: %s", item.get("slug"), exc)
        sb_update_news(item["id"], {"instagram_last_error": str(exc)[:500]})
        notify_slack(
            f"IG publish FAILED for `{item.get('slug')}` (attempt {attempts}/"
            f"{IG_MAX_RETRY_ATTEMPTS}): {str(exc)[:500]}",
            level="error",
        )
        return None
    except Exception as exc:
        log.exception("Unexpected error during IG publish")
        sb_update_news(item["id"], {"instagram_last_error": str(exc)[:500]})
        notify_slack(
            f"IG publish CRASHED for `{item.get('slug')}`: ```{traceback.format_exc()[-1500:]}```",
            level="error",
        )
        return None

    now_iso = dt.datetime.now(dt.timezone.utc).replace(microsecond=0, tzinfo=None).isoformat() + "Z"
    sb_update_news(item["id"], {
        "instagram_posted":    True,
        "instagram_post_id":   media_id,
        "instagram_posted_at": now_iso,
        "instagram_last_error": None,
    })
    log.info("Posted to Instagram: %s (media_id=%s)", item.get("slug"), media_id)
    notify_slack(
        f"Posted to Instagram: *{title_en}*  (category={item.get('category')}, "
        f"slug=`{item.get('slug')}`, media_id={media_id})",
        level="success",
    )
    return media_id


# ─────────────────────────────────────────────────────────────────────────────
# Repair — re-run AI for an existing article that was stored with bad/fallback data
# ─────────────────────────────────────────────────────────────────────────────

def repair_article(slug: str) -> bool:
    """Re-run OpenAI summarisation + image generation for an existing DB record.

    Use this to fix articles that were inserted with fallback (English-only,
    unsummarised) data due to a transient OpenAI failure.  The existing
    ``content`` field is used as the source text for re-summarisation.
    """
    rows = sb_select_news(
        {"slug": f"eq.{slug}"},
        limit=1,
        select="id,title,content,category",
    )
    if not rows:
        log.error("Article not found in DB: %s", slug)
        return False

    article = rows[0]
    article_id = article["id"]
    title = article.get("title") or ""
    content = article.get("content") or ""
    category = article.get("category") or "industry"

    log.info("Repairing: %s (category=%s)", slug, category)
    summary = summarise_bilingual(title, content, category)
    if summary is None:
        log.error("Repair failed — OpenAI unavailable or failed for: %s", slug)
        return False

    image_url = generate_image_for(summary["image_scene"], category)
    if not image_url:
        log.warning("Image generation failed for repair of: %s — keeping existing image.", slug)

    ig_caption_body = f"{summary['caption_en']}\n\n{summary['caption_ja']}".strip()
    ig_caption_body_with_tags = (
        f"{ig_caption_body}\n\n{_hashtags_to_caption_tail(summary['hashtags'])}"
    ).strip()

    patch: Dict[str, Any] = {
        "title":             summary["title_en"],
        "title_ja":          summary["title_ja"],
        "excerpt":           summary["excerpt_en"],
        "excerpt_ja":        summary["excerpt_ja"],
        "content":           summary["content_en"],
        "content_ja":        summary["content_ja"],
        "instagram_caption": ig_caption_body_with_tags,
    }
    if image_url:
        patch["image"] = image_url

    sb_update_news(article_id, patch)
    log.info("Repair complete: %s (image=%s)", slug, "yes" if image_url else "no (unchanged)")
    notify_slack(
        f"Repaired article `{slug}` — image={'regenerated' if image_url else 'unchanged'}.",
        level="success",
    )
    return True


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mode",
        nargs="?",
        default="run",
        choices=["collect", "instagram", "run", "refresh-token", "repair"],
        help="What to do. Default 'run' = collect + one IG post.",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument(
        "--slug",
        metavar="SLUG",
        help="Slug of the article to repair (required for 'repair' mode).",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    try:
        if args.mode == "repair":
            if not args.slug:
                log.error("repair mode requires --slug SLUG")
                return 2
            ok = repair_article(args.slug)
            return 0 if ok else 1
        if args.mode == "refresh-token":
            refresh_long_lived_token()
            return 0
        if args.mode in ("collect", "run"):
            inserted = collect_articles()
            if inserted:
                notify_slack(
                    f"Collected {len(inserted)} new article(s): "
                    + ", ".join(
                        f"`{a.get('slug')}` [{a.get('category')}] ← {a.get('_source_name') or '?'}"
                        for a in inserted
                    ),
                    level="success",
                )
            else:
                notify_slack("Collection ran — no new articles inserted.", level="info")
        if args.mode in ("instagram", "run"):
            post_one_to_instagram()
        return 0
    except Exception as exc:
        log.exception("Fatal error")
        notify_slack(
            f"FATAL: {exc.__class__.__name__}: {exc}\n```{traceback.format_exc()[-1500:]}```",
            level="error",
        )
        return 2


if __name__ == "__main__":
    sys.exit(main())
