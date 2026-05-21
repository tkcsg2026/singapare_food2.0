"""
auto_post.py
============

Daily automation for The Kitchen Connection (singapore_food2.0).

Pipeline
--------
1. Collect Singapore F&B stories from RSS feeds + a small set of static URLs
   (mirroring the original client spec).
2. Use OpenAI to produce a concise bilingual (EN / JA) summary, excerpt, body
   and an Instagram caption for each story.
3. If a story has no usable image, generate one with DALL·E using a
   category-specific editorial prompt, overlay the site logo, then upload
   the composite to Supabase Storage.
4. Insert the row into Supabase public.news_articles (published=true) with
   DEFAULT_TAGS attached.
5. Pick today's target category according to the weekly schedule, find the
   best published-but-not-instagrammed article in that category, and publish
   it to the @the_kitchen_connection_sg Instagram Business account via
   Instagram Graph API. Set instagram_posted=true to prevent re-posting.
6. Send a Slack notification (success or failure) so the team has a daily
   trail without checking logs.

Manual articles created from the admin dashboard are picked up by the same
Instagram queue automatically — the picker only requires
``published = true AND image <> '' AND instagram_posted = false``.

Run modes (CLI) — invoke from the repository root
-------------------------------------------------
    python python/auto_post.py collect         # scrape + summarise + insert news only
    python python/auto_post.py instagram       # post the next queued article to IG
    python python/auto_post.py run             # collect then instagram (daily default)
    python python/auto_post.py refresh-token   # refresh the long-lived IG token

Required environment variables — see ``.env.example`` at the repo root.
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
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import feedparser
import requests
from bs4 import BeautifulSoup

# Repo root = parent of this file's directory (python/).  All relative paths
# (.env files, BRAND_LOGO_SRC=public/icon.png, etc.) are resolved against this
# so the script works regardless of the caller's current working directory.
from pathlib import Path
REPO_ROOT = Path(__file__).resolve().parent.parent

try:  # optional but recommended for local dev
    from dotenv import load_dotenv
    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(REPO_ROOT / ".env.local", override=False)
    load_dotenv(REPO_ROOT / ".env.auto-post", override=False)
except ImportError:  # pragma: no cover
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_NEWS_BUCKET", "logos")

def _resolve_openai_api_key() -> str:
    # Mirror src/lib/chatbot/provider.ts:resolveOpenAiApiKey — accept the
    # canonical name plus common legacy / lowercase / typo'd aliases so a
    # single key in .env.local (under any of these names) is enough to make
    # both the website chatbot and this script work.
    direct = [
        os.environ.get("OPENAI_API_KEY"),
        os.environ.get("OPENAPI_API_KEY"),
        os.environ.get("openai_api_key"),
        os.environ.get("OPENAI_KEY"),
        os.environ.get("OPENAPI_KEY"),
    ]
    for candidate in direct:
        if candidate and candidate.strip():
            return candidate.strip()
    aliases = {
        "OPENAIAPIKEY",
        "OPENAPIAPIKEY",
        "OPENAIKEY",
        "OPENAPIKEY",
        "OPENAIAPIKEY",
    }
    for name, value in os.environ.items():
        normalized = re.sub(r"[^A-Za-z0-9]", "", name).upper()
        if normalized in aliases and value and value.strip():
            return value.strip()
    return ""


OPENAI_API_KEY = _resolve_openai_api_key()
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
OPENAI_IMAGE_SIZE = os.environ.get("OPENAI_IMAGE_SIZE", "1024x1024")

# Instagram Graph API — see docs/AUTO_POST_INSTAGRAM.md.
IG_USER_ID = os.environ.get("IG_USER_ID", "")
IG_ACCESS_TOKEN = os.environ.get("IG_ACCESS_TOKEN", "")
IG_APP_ID = os.environ.get("IG_APP_ID", "")
IG_APP_SECRET = os.environ.get("IG_APP_SECRET", "")
IG_GRAPH_VERSION = os.environ.get("IG_GRAPH_VERSION", "v21.0")
IG_MAX_RETRY_ATTEMPTS = int(os.environ.get("IG_MAX_RETRY_ATTEMPTS", "3"))

# Slack notifications. Set SLACK_WEBHOOK_URL in the environment (or GitHub
# Actions secret) — leave unset to disable Slack notifications.
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")

NEWS_AUTHOR = os.environ.get("NEWS_AUTHOR", "Editorial Department")
MAX_NEW_ARTICLES_PER_RUN = int(os.environ.get("MAX_NEW_ARTICLES_PER_RUN", "5"))

# Freshness filter — RSS feeds occasionally re-surface older items, and Google
# News searches can include long-tail results.  Articles older than this many
# days are skipped during collection so we never publish stale news.  Set to 0
# to disable the filter.
NEWS_MAX_AGE_DAYS = int(os.environ.get("NEWS_MAX_AGE_DAYS", "30"))

try:
    SGT = ZoneInfo("Asia/Singapore")
except Exception:  # Windows without `tzdata` installed
    SGT = dt.timezone(dt.timedelta(hours=8), name="Asia/Singapore")

# Tags written to every auto-posted row (client requirement §B / §2).
DEFAULT_TAGS = ["F&B News", "Singapore"]

# Brand hashtags requested by the client.
INSTAGRAM_HASHTAGS = [
    "#SingaporeFNB",
    "#SingaporeRestaurants",
    "#SingaporeFood",
    "#SingaporeBusiness",
    "#SGFNB",
]

CATEGORIES = ("regulation", "trend", "event", "industry")

# ── Weekly category rotation ────────────────────────────────────────────────
# Client requirement: ratio of Industry×3 / Trend×2 / Regulation×1 / Event×1 per
# week, with one fixed category per weekday.  Monday=0 … Sunday=6.
WEEKDAY_CATEGORY = {
    0: "industry",     # Mon
    1: "regulation",   # Tue
    2: "trend",        # Wed
    3: "industry",     # Thu
    4: "event",        # Fri
    5: "trend",        # Sat
    6: "industry",     # Sun
}

# ── Brand identity ──────────────────────────────────────────────────────────
# Visual tone applied to every generated image.  Brand colors are pulled from
# tailwind.config.ts (warm earth-tone hospitality palette).
BRAND_COLORS_HEX = "#1f2937 (charcoal), #f59e0b (amber), #fafaf9 (warm white)"
BRAND_STYLE = (
    "Photorealistic editorial photography in The Kitchen Connection brand style: "
    f"warm and inviting color palette featuring {BRAND_COLORS_HEX}, "
    "natural soft lighting, shallow depth of field, premium magazine aesthetic. "
    "No embedded text, no watermarks, no logos in the generated image itself "
    "(the brand logo is composited separately afterwards)."
)

CATEGORY_IMAGE_PROMPTS: Dict[str, str] = {
    "regulation": (
        "Editorial photograph of official Singapore government buildings or "
        "regulatory documents related to food safety — exterior shots of "
        "modern civic architecture, clean desks with food-safety paperwork, "
        "or inspection scenes. Formal, professional, bright daylight."
    ),
    "event": (
        "Editorial photograph of an elegant Singapore restaurant interior set "
        "for a special event — tables with linen and tableware, warm ambient "
        "lighting, no people facing the camera. Premium hospitality feel."
    ),
    "trend": (
        "Editorial macro close-up of fresh Singapore food ingredients — "
        "tropical fruit, herbs, spices, plated dishes. Natural light, vibrant "
        "colors, shallow depth of field, hand-styled food photography."
    ),
    "industry": (
        "Editorial photograph of a busy professional commercial kitchen in "
        "Singapore — chefs in motion, stainless-steel surfaces, plating in "
        "progress. Bright, modern, clean composition, no people facing camera."
    ),
}

# Logo overlay source.  Path (in repo) or http(s) URL.  Default uses the
# existing site icon at public/icon.png — present in this repo.
BRAND_LOGO_SRC = os.environ.get("BRAND_LOGO_SRC", "public/icon.png")
LOGO_OVERLAY_ENABLED = os.environ.get("LOGO_OVERLAY_ENABLED", "true").lower() == "true"

# ── News sources ────────────────────────────────────────────────────────────
# Default RSS feeds + static pages from the original client spec.  Each entry
# can be overridden / extended via env vars (see below) without touching code:
#
#   • NEWS_SOURCES_JSON         — full JSON array, takes precedence if set.
#   • NEWS_RSS_INDUSTRY         — single RSS URL (category=industry)
#   • NEWS_RSS_EVENT            — single RSS URL (category=event)
#   • NEWS_RSS_REGULATION       — single RSS URL (category=regulation)
#   • NEWS_RSS_TREND            — single RSS URL (category=trend)
#   • NEWS_URL_REGULATION       — single static URL (category=regulation)
#   • NEWS_URL_EVENT            — single static URL (category=event)
#   • NEWS_URL_TREND            — single static URL (category=trend)
#
# If an individual var is set it REPLACES the default for that slot; unset
# vars keep the defaults below.  NEWS_SOURCES_JSON, if present and valid,
# fully replaces everything (use for power-user setups).
# Priority publications mandated by the client (project brief, 2026-05).  We
# pull directly from each publisher's first-party RSS feed so we can verify in
# the Slack notification exactly which publication every published article
# came from — Google News searches were dropped because (a) they cannot be
# audited per-publisher, (b) `site:` scoping returns 0 entries from a number
# of regions, and (c) we kept seeing old re-surfaced items.
#
# The five priority sources are:
#   1. Singapore Business Review – Food & Beverage   (sbr.com.sg)
#   2. The Business Times – Singapore F&B            (businesstimes.com.sg)
#   3. FoodNavigator Asia                            (foodnavigator-asia.com)
#   4. Asia Food Journal                             (asiafoodjournal.com)
#   5. Saladplate                                    (saladplate.com)
#
# SBR and BT publish broad cross-topic feeds, so we narrow them with the
# optional ``keywords`` field — fetch_rss_entries() drops any entry whose
# title+summary does not match at least one keyword.  Category routing for
# the weekly Instagram rotation (industry / regulation / trend / event) is
# split across these five publishers as below.
FB_KEYWORDS = (
    "food", "beverage", "restaurant", "f&b", "cafe", "café", "dining",
    "chef", "hospitality", "hotel", "bar", "kitchen", "menu", "cuisine",
    "fnb", "drink", "coffee", "tea", "bakery", "dessert", "catering",
)
REGULATION_KEYWORDS = (
    "singapore food agency", "sfa", "food safety", "food regulation",
    "licensing", "food licence", "food license", "compliance", "hygiene",
    "halal", "food import", "labelling", "labeling",
)

DEFAULT_SOURCES: List[Dict[str, Any]] = [
    {"name": "Singapore Business Review",
     "rss": "https://sbr.com.sg/rss.xml",
     "category": "industry",
     "keywords": FB_KEYWORDS},
    {"name": "The Business Times – Singapore",
     "rss": "https://www.businesstimes.com.sg/rss/singapore",
     "category": "industry",
     "keywords": FB_KEYWORDS},
    {"name": "The Business Times – Regulation",
     "rss": "https://www.businesstimes.com.sg/rss/top-stories",
     "category": "regulation",
     "keywords": REGULATION_KEYWORDS},
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


def _resolve_sources() -> List[Dict[str, Any]]:
    """Build the active SOURCES list, honoring env-var overrides."""
    raw = os.environ.get("NEWS_SOURCES_JSON", "").strip()
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list) and parsed:
                return [s for s in parsed if isinstance(s, dict)]
        except Exception as exc:
            log.warning("NEWS_SOURCES_JSON parse failed (%s) — using defaults.", exc)

    # Per-slot env overrides.  Slot key = ('rss'|'url', category).
    overrides = {
        ("rss", "industry"):   os.environ.get("NEWS_RSS_INDUSTRY", "").strip(),
        ("rss", "event"):      os.environ.get("NEWS_RSS_EVENT", "").strip(),
        ("rss", "regulation"): os.environ.get("NEWS_RSS_REGULATION", "").strip(),
        ("rss", "trend"):      os.environ.get("NEWS_RSS_TREND", "").strip(),
        ("url", "regulation"): os.environ.get("NEWS_URL_REGULATION", "").strip(),
        ("url", "event"):      os.environ.get("NEWS_URL_EVENT", "").strip(),
        ("url", "trend"):      os.environ.get("NEWS_URL_TREND", "").strip(),
    }
    out: List[Dict[str, Any]] = []
    for src in DEFAULT_SOURCES:
        kind = "rss" if "rss" in src else "url"
        key = (kind, src["category"])
        override = overrides.get(key)
        if override:
            new = dict(src)
            new[kind] = override
            out.append(new)
        else:
            out.append(dict(src))
    return out


SOURCES: List[Dict[str, Any]] = _resolve_sources()

USER_AGENT = (
    "Mozilla/5.0 (compatible; KitchenConnectionBot/1.0; "
    "+https://thekitchenconnection.sg)"
)
HTTP_TIMEOUT = 30

log = logging.getLogger("auto_post")


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
            "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
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
    """URL-safe slug with a YYYYMMDD date suffix.

    Implements the client spec "タイトル + 日付など" — the slug is the article
    title plus the current date (Asia/Singapore).  Same title posted on the
    same day → same slug → DB UNIQUE on news_articles.slug rejects the
    duplicate insert.
    """
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
    """Best-effort parse of an feedparser entry's publish date to aware UTC.

    feedparser exposes both a string (``published`` / ``updated``) and a
    pre-parsed ``*_parsed`` struct_time.  Prefer the struct_time — it survives
    odd timezone formats that dateutil can't always handle.
    """
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

    Entries with no parseable publish date land at the end; entries older than
    NEWS_MAX_AGE_DAYS are dropped so stale items never reach the OpenAI step.
    If ``keywords`` is provided, entries whose title+summary do not contain
    any keyword (case-insensitive) are dropped — used to narrow broad feeds
    (e.g. SBR / BT main feeds) down to F&B-relevant items.
    """
    log.debug("Fetching RSS: %s", rss_url)
    feed = feedparser.parse(
        rss_url,
        agent="Mozilla/5.0 (compatible; KitchenConnectionBot/1.0; "
              "+https://thekitchenconnection.sg)",
    )
    cutoff: Optional[dt.datetime] = None
    if NEWS_MAX_AGE_DAYS > 0:
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=NEWS_MAX_AGE_DAYS)
    kw_patterns = None
    if keywords:
        # Word-boundary match so "bar" does not match "barrier" and "tea" does
        # not match "team".  Multi-word phrases match as-is (still bounded).
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


# Image CDNs that serve Google News's generic logo placeholder. Any og:image
# whose URL contains one of these is rejected so we fall back to DALL·E
# generation instead of pinning the Google logo as the article's hero.
_GOOGLE_NEWS_IMAGE_BLACKLIST = (
    "news.google.com",
    "lh3.googleusercontent.com",
    "lh4.googleusercontent.com",
    "lh5.googleusercontent.com",
    "ssl.gstatic.com",
)


def resolve_google_news_url(url: str) -> str:
    """Best-effort decode of a news.google.com/rss/articles/... redirect URL
    to the original publisher URL.

    Google News RSS encodes the source URL as base64url-wrapped protobuf in
    the path. We don't parse the protobuf properly — we just decode the
    base64 blob and pick the first http(s):// substring out of the bytes.
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
    # Strip any trailing protobuf garbage that may have slipped past the regex.
    candidate = candidate.rstrip("\x00\x01\x02\x03\x12\x13")
    log.debug("Resolved Google News URL: %s -> %s", url, candidate)
    return candidate


def fetch_page(url: str) -> Tuple[Optional[str], Optional[str]]:
    """Return (visible text, og:image URL) for the page, or (None, None)."""
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=HTTP_TIMEOUT)
        r.raise_for_status()
    except Exception as exc:
        log.warning("Failed to fetch %s: %s", url, exc)
        return None, None
    soup = BeautifulSoup(r.content, "html.parser")
    final_url = (r.url or url).lower()
    image: Optional[str] = None
    # Skip og:image extraction for Google News redirect pages — their og:image
    # is the generic Google News logo, not the actual article photo.
    if "news.google.com" not in final_url:
        og = soup.find("meta", attrs={"property": "og:image"}) or \
             soup.find("meta", attrs={"name": "twitter:image"})
        if og and og.get("content"):
            candidate = og["content"].strip()
            if not any(b in candidate.lower() for b in _GOOGLE_NEWS_IMAGE_BLACKLIST):
                image = candidate
    for el in soup(["script", "style", "header", "footer", "nav", "aside"]):
        el.extract()
    text = re.sub(r"\s+", " ", soup.get_text(separator=" ")).strip()
    return text or None, image


def extract_static_titles(url: str, max_items: int = 5) -> List[Dict[str, str]]:
    """For static category/listing pages, pull the top N article links."""
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=HTTP_TIMEOUT)
        r.raise_for_status()
    except Exception as exc:
        log.warning("Static fetch failed %s: %s", url, exc)
        return []
    soup = BeautifulSoup(r.content, "html.parser")
    seen: set[str] = set()
    items: List[Dict[str, str]] = []
    # Anchors inside <article>/<h2>/<h3> are usually article links.
    candidates = soup.select("article a[href], h2 a[href], h3 a[href]")
    for a in candidates:
        href = a.get("href", "").strip()
        title = a.get_text(strip=True)
        if not href or not title or len(title) < 12:
            continue
        if href.startswith("/"):
            href = urljoin(url, href)
        if href in seen or not href.startswith("http"):
            continue
        seen.add(href)
        items.append({"title": title, "link": href, "summary": "", "published": ""})
        if len(items) >= max_items:
            break
    return items


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
    """Strip HTML, normalize whitespace, cap at N sentences.

    Defensive cleanup applied to model output even though the prompt asks for
    plain text — keeps the database free of stray <p>/<a> tags. Splits on
    English (.!?) and CJK (。！？) terminators. When ``preserve_paragraphs``
    is true, blank-line breaks between paragraphs are kept and sentence count
    is applied across the full text.
    """
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


def summarise_bilingual(title: str, body: str) -> Dict[str, str]:
    """Return dict with title_en, title_ja, excerpt_en, excerpt_ja,
    content_en, content_ja, caption_ig.  Content fields are plain text,
    no HTML, capped at CONTENT_MAX_SENTENCES sentences."""
    client = _openai()
    fallback = {
        "title_en":   title.strip(),
        "title_ja":   title.strip(),
        "excerpt_en": _to_plain_text(body or title, max_sentences=1)[:160],
        "excerpt_ja": _to_plain_text(body or title, max_sentences=1)[:160],
        "content_en": _to_plain_text(body or title),
        "content_ja": _to_plain_text(body or title),
        "caption_ig": _to_plain_text(body or title, max_sentences=3)[:600],
    }
    if client is None:
        log.warning("OPENAI_API_KEY not set — using naive truncation.")
        return fallback

    body_clipped = (body or "")[:4000]
    prompt = (
        "Editor for The Kitchen Connection — a Singapore F&B B2B portal for "
        "restaurants, hotels, cafes, suppliers, importers, distributors, "
        "foodservice operators. Rewrite the source as an ORIGINAL summary; "
        "do NOT copy phrasing. Prioritise relevance to Singapore F&B trade. "
        "Skip gossip / pure-consumer angles. Stay factual; no invented facts; "
        "no source URL.\n"
        "Return strict JSON with these keys (plain text, no HTML/Markdown/bullets):\n"
        '  title_en:   <=90 chars, SEO-aware\n'
        '  title_ja:   <=90文字、自然な日本語\n'
        '  excerpt_en: 2 sentences, <=160 chars\n'
        '  excerpt_ja: 2文、<=160文字\n'
        f'  content_en: ~{CONTENT_MAX_SENTENCES} sentences total, in 3 labelled '
        'paragraphs separated by blank lines: "News Summary." / "Why It Matters '
        'for Singapore F&B." / "Key Takeaway."\n'
        f'  content_ja: 上記と同構成・同分量の自然な日本語（直訳禁止）\n'
        '  caption_ig: pro B2B tone, <=500 chars, no hashtags (appended later)\n'
        f"SOURCE TITLE: {title}\nSOURCE:\n{body_clipped}"
    )
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1200,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(_strip_code_fences(raw))
        out = {**fallback}
        for k in fallback:
            v = data.get(k)
            if isinstance(v, str) and v.strip():
                out[k] = v.strip()
        # Defensive: enforce plain-text + sentence cap on content fields even
        # if the model slipped HTML or extra paragraphs back in.
        out["content_en"] = _to_plain_text(out["content_en"], preserve_paragraphs=True)
        out["content_ja"] = _to_plain_text(out["content_ja"], preserve_paragraphs=True)
        out["excerpt_en"] = _to_plain_text(out["excerpt_en"], max_sentences=1)[:160]
        out["excerpt_ja"] = _to_plain_text(out["excerpt_ja"], max_sentences=1)[:160]
        out["caption_ig"] = _to_plain_text(out["caption_ig"], max_sentences=3)[:600]
        return out
    except Exception as exc:
        log.error("OpenAI summarisation failed: %s", exc)
        return fallback


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
            # Resolve relative paths (e.g. "public/icon.png") against the repo
            # root so this works no matter what the caller's CWD is.
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
    """Composite the brand logo onto the bottom-right corner with a soft
    semi-transparent panel for legibility. Returns JPEG bytes."""
    if not LOGO_OVERLAY_ENABLED:
        return image_bytes
    logo_bytes = _load_logo()
    if not logo_bytes:
        return image_bytes
    try:
        from PIL import Image
        base = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
        bw, bh = base.size
        target_w = max(96, int(bw * 0.18))
        ratio = target_w / logo.width
        logo = logo.resize((target_w, max(1, int(logo.height * ratio))), Image.LANCZOS)
        margin = int(bw * 0.035)
        # Semi-transparent backing panel for contrast (works on light + dark photos)
        panel_pad = int(target_w * 0.08)
        panel = Image.new(
            "RGBA",
            (logo.width + panel_pad * 2, logo.height + panel_pad * 2),
            (250, 250, 249, 170),  # warm white at ~67% opacity
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


def generate_image_for(title: str, category: str) -> Optional[str]:
    """Generate a brand-styled hero image with DALL·E, overlay the logo, and
    upload to Supabase Storage. Returns the public image URL."""
    client = _openai()
    if client is None:
        return None
    base_prompt = CATEGORY_IMAGE_PROMPTS.get(category) or CATEGORY_IMAGE_PROMPTS["industry"]
    prompt = (
        f"{base_prompt}\n\n"
        f"Article: '{title}'.\n\n"
        f"{BRAND_STYLE}"
    )
    try:
        r = client.images.generate(
            model=OPENAI_IMAGE_MODEL,
            prompt=prompt,
            size=OPENAI_IMAGE_SIZE,
            n=1,
        )
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


def fetch_and_overlay_external(image_url: str) -> Optional[str]:
    """Download an external image, overlay the logo, and host on Supabase
    Storage so Instagram has a stable URL. Falls back to the raw URL on error."""
    try:
        r = requests.get(image_url, timeout=HTTP_TIMEOUT,
                         headers={"User-Agent": USER_AGENT})
        r.raise_for_status()
        composited = overlay_brand_logo(r.content)
        public = sb_storage_upload(composited, ext="jpg")
        return public or image_url
    except Exception as exc:
        log.warning("External image proxy failed (%s) — using direct URL.", exc)
        return image_url


# ─────────────────────────────────────────────────────────────────────────────
# Category routing & weekly rotation
# ─────────────────────────────────────────────────────────────────────────────

def classify_category(source_category: str) -> str:
    """Assign the article category from the source's declared category.

    Each entry in DEFAULT_SOURCES (and NEWS_SOURCES_JSON) carries one of
    industry / regulation / trend / event — that mapping IS the category.
    Anything unknown falls back to "industry".
    """
    return source_category if source_category in CATEGORIES else "industry"


def target_category_for_today() -> str:
    """Today's Instagram category, per the weekly schedule (SGT)."""
    weekday = dt.datetime.now(SGT).weekday()
    return WEEKDAY_CATEGORY[weekday]


def pick_for_instagram() -> Optional[Dict[str, Any]]:
    """Pick the next published-but-not-Instagrammed article.

    1) Prefer today's scheduled category (weekly rotation).
    2) If empty, fall back to least-recently-Instagrammed category.
    """
    base_url = f"{SUPABASE_URL}/rest/v1/news_articles"

    def _query(category: Optional[str]) -> List[Dict[str, Any]]:
        params = {
            "select": "id,slug,title,title_ja,excerpt,excerpt_ja,image,category,"
                      "published_at,instagram_posted,instagram_caption,"
                      "instagram_attempts",
            "published": "eq.true",
            "instagram_posted": "is.false",
            "image": "neq.",
            "order": "published_at.desc.nullslast,created_at.desc",
            "limit": "50",
        }
        if category:
            params["category"] = f"eq.{category}"
        # Skip rows that have already failed too many times.
        params["instagram_attempts"] = f"lt.{IG_MAX_RETRY_ATTEMPTS}"
        r = requests.get(base_url, params=params, headers=_sb_headers(), timeout=HTTP_TIMEOUT)
        r.raise_for_status()
        return r.json()

    today_cat = target_category_for_today()
    log.info("Today's IG target category (weekday rotation): %s", today_cat)
    pool = _query(today_cat)
    if pool:
        return pool[0]

    log.info("No candidate for today's category — falling back to least-recently-posted.")
    # Build per-category last-posted-at and pick the oldest.
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
        raise InstagramError("IG_USER_ID and IG_ACCESS_TOKEN must be set.")
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


def build_ig_caption(title_en: str, body_en: str, fallback: str = "") -> str:
    body = (body_en or fallback or "").strip()
    parts = [title_en.strip()]
    if body:
        parts.append("")
        parts.append(body)
    parts.append("")
    parts.append(" ".join(INSTAGRAM_HASHTAGS))
    caption = "\n".join(parts).strip()
    return caption[:2150]


def refresh_long_lived_token() -> Optional[str]:
    if not IG_ACCESS_TOKEN or not IG_APP_ID or not IG_APP_SECRET:
        raise RuntimeError("IG_APP_ID, IG_APP_SECRET, IG_ACCESS_TOKEN must all be set.")
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
        "Update `IG_ACCESS_TOKEN` in GitHub Secrets / .env.auto-post.",
        level="info",
    )
    return new_token


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline steps
# ─────────────────────────────────────────────────────────────────────────────

def collect_articles() -> List[Dict[str, Any]]:
    inserted: List[Dict[str, Any]] = []
    seen_titles: set[str] = set()

    for source in SOURCES:
        if len(inserted) >= MAX_NEW_ARTICLES_PER_RUN:
            break
        log.info("Source: %s", source["name"])
        try:
            if "rss" in source:
                entries = fetch_rss_entries(
                    source["rss"],
                    keywords=source.get("keywords") or None,
                )
            else:
                entries = extract_static_titles(source["url"])
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

            # Pre-check by slug (cheap) so we don't burn an OpenAI call on a
            # known duplicate. The DB UNIQUE constraint is still the final guard
            # (sb_insert_news handles 409 conflicts).
            slug = slugify(title)
            if sb_select_news({"slug": f"eq.{slug}"}, limit=1):
                continue

            # Google News RSS gives us redirect URLs; try to recover the
            # real publisher URL so og:image scraping finds the actual photo.
            fetch_url = resolve_google_news_url(link)
            page_text, og_image = fetch_page(fetch_url)
            body_for_summary = page_text or entry.get("summary") or title
            summary = summarise_bilingual(title, body_for_summary)
            category = classify_category(source.get("category", ""))

            # Image strategy:
            #   1) og:image from source → fetch + overlay logo + host on Supabase
            #   2) else generate with DALL·E + overlay logo + host on Supabase
            if og_image:
                image_url = fetch_and_overlay_external(og_image)
            else:
                image_url = generate_image_for(summary["title_en"], category)

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
                "tags":               list(DEFAULT_TAGS),
                "published":          True,
                "published_at":       now_iso,
                "display_date":       now_iso,
                "instagram_caption":  summary["caption_ig"],
                "instagram_posted":   False,
                "instagram_attempts": 0,
            }
            created = sb_insert_news(row)
            if created:
                log.info("Inserted: %s [%s] from %s",
                         slug, category, source.get("name", "?"))
                created["_source_name"] = source.get("name", "")
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
    excerpt_en = item.get("excerpt") or ""
    image_url = (item.get("image") or "").strip()
    if not image_url:
        msg = f"Article {item.get('slug')} has no image — skipping IG post."
        log.warning(msg)
        notify_slack(msg, level="warning")
        return None
    caption_field = item.get("instagram_caption") or excerpt_en
    caption = build_ig_caption(title_en, caption_field)

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
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mode",
        nargs="?",
        default="run",
        choices=["collect", "instagram", "run", "refresh-token"],
        help="What to do. Default 'run' = collect + one IG post.",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    try:
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
