export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { username?: string | null; avatar_url?: string };
        Update: Partial<Profile>;
      };
      job_notices: {
        Row: JobNoticeRow;
        Insert: Omit<JobNoticeRow, "id" | "created_at" | "deleted_at" | "deleted_reason">;
        Update: Partial<JobNoticeRow>;
      };
      suppliers: {
        Row: SupplierRow;
        Insert: Omit<SupplierRow, "id" | "created_at">;
        Update: Partial<SupplierRow>;
      };
      supplier_products: {
        Row: SupplierProductRow;
        Insert: Omit<SupplierProductRow, "id">;
        Update: Partial<SupplierProductRow>;
      };
      marketplace_items: {
        Row: MarketplaceItemRow;
        Insert: Omit<MarketplaceItemRow, "id" | "created_at">;
        Update: Partial<MarketplaceItemRow>;
      };
      news_articles: {
        Row: NewsArticleRow;
        Insert: Omit<NewsArticleRow, "id" | "created_at">;
        Update: Partial<NewsArticleRow>;
      };
      categories: {
        Row: CategoryRow;
        Insert: Omit<CategoryRow, "id">;
        Update: Partial<CategoryRow>;
      };
      site_settings: {
        Row: SiteSettingRow;
        Insert: SiteSettingRow;
        Update: Partial<SiteSettingRow>;
      };
      reports: {
        Row: ReportRow;
        Insert: Omit<ReportRow, "id" | "created_at">;
        Update: Partial<ReportRow>;
      };
    };
  };
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  username: string | null;
  avatar_url: string;
  role: "user" | "admin";
  whatsapp: string;
  company: string;
  created_at: string;
  banned: boolean;
}

export interface JobNoticeRow {
  id: string;
  created_at: string;
  /** "job" = 求人, "seeker" = 求職者 */
  post_type?: "job" | "seeker";
  title: string;
  company: string | null;
  employment: string | null;
  role_category: string | null;
  region: string | null;
  compensation: string | null;
  experience: string | null;
  eligibility: string | null;
  description: string;
  agreed: boolean;
  agreed_at: string | null;
  status: "active" | "deleted";
  deleted_at: string | null;
  deleted_reason: string | null;
}

export interface SupplierRow {
  id: string;
  slug: string;
  name: string;
  name_ja: string;
  logo: string;
  category: string;
  category_ja: string;
  category_2?: string;
  category_2_ja?: string;
  category_3?: string;
  category_3_ja?: string;
  catalog_url?: string;
  image_2?: string;
  image_3?: string;
  whatsapp_contact_name?: string;
  tags: string[];
  area: string;
  area_ja: string;
  description: string;
  description_ja: string;
  whatsapp: string;
  views: number;
  /** Cumulative WhatsApp button taps (supplier card / profile). */
  whatsapp_clicks?: number;
  certifications: string[];
  about: string;
  about_ja: string;
  featured: boolean;
  plan: "basic" | "standard" | "premium";
  plan_expires_at: string | null;
  /** When true, the supplier is hidden from public listings/detail (admin-only "Post" state). */
  hidden?: boolean;
  created_at: string;
}

export interface SupplierProductRow {
  id: string;
  supplier_id: string;
  name: string;
  name_en?: string;
  image: string;
  moq?: string;
  country_of_origin?: string;
  country_of_origin_en?: string;
  weight?: string;
  quantity?: string;
  /** Free-text price (e.g. "S$10/kg") */
  price?: string;
  /** Short product description */
  description?: string;
  storage_condition?: string;
  temperature?: string;
  /** Dimensions: width, depth, height */
  size_w?: string;
  size_d?: string;
  size_h?: string;
  size_unit?: string;
  /** Direct MP4/WebM URL or YouTube/Vimeo embed URL */
  video_url?: string;
  /** Preferred playable URL used by frontend (transcoded if ready, else source URL). */
  video_playback_url?: string;
  /** Worker-generated browser-safe output URL. */
  video_transcoded_url?: string;
  /** Transcode lifecycle state. */
  video_transcode_status?: "none" | "not_needed" | "queued" | "processing" | "completed" | "failed";
  /** Last worker error message for failed jobs. */
  video_transcode_error?: string;
  video_transcode_requested_at?: string | null;
  video_transcoded_at?: string | null;
}

export interface MarketplaceItemRow {
  id: string;
  slug: string;
  title: string;
  title_en?: string;
  price: number;
  image: string;
  images: string[];
  area: string;
  area_en?: string;
  condition: string;
  condition_en?: string;
  years_used: number;
  description: string;
  description_en?: string;
  category: string;
  seller_id: string;
  seller_name: string;
  seller_whatsapp: string;
  created_at: string;
  status: "approved" | "pending" | "rejected";
  delivery: string;
  delivery_en?: string;
  reject_reason: string | null;
}

export interface NewsArticleRow {
  id: string;
  slug: string;
  title: string;
  title_ja: string;
  excerpt: string;
  excerpt_ja: string;
  content: string;
  content_ja: string;
  image: string;
  category: string;
  author: string;
  published: boolean;
  published_at?: string | null;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  type: "supplier" | "supplier-group" | "marketplace" | "news" | "tag";
  value: string;
  label: string;
  label_ja?: string | null;
  sort_order: number;
  parent_group?: string | null;
}

export interface SiteSettingRow {
  key: string;
  value: string;
}

export interface ReportRow {
  id: string;
  item_type: "marketplace_item" | "supplier";
  item_id: string;
  reporter_id: string;
  reason: string;
  status: "pending" | "reviewed" | "dismissed";
  created_at: string;
}
