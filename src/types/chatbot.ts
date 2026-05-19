export type ChatbotSourceType = "faq" | "ai";

export type ChatbotTopic =
  | "supplier_search"
  | "buy_sell"
  | "post_item"
  | "contact_supplier"
  | "registration"
  | "language_switch"
  | "profile"
  | "favorites"
  | "contact_form"
  | "reporting"
  | "admin_approval"
  | "general_platform"
  | "terms_privacy"
  | "categories"
  | "navigation"
  | "jobs_notice"
  | "off_topic"
  | "generic_help";

export interface ChatbotApiRequest {
  message: string;
  sessionId: string;
  language: "en" | "ja";
}

export interface ChatbotApiResponse {
  answer: string;
  sourceType: ChatbotSourceType;
  matchedTopic?: ChatbotTopic | string;
}

export interface FaqMatchResult {
  hit: boolean;
  topic?: ChatbotTopic;
  /** Highest-scoring FAQ category even when below auto-answer threshold */
  bestTopic: ChatbotTopic;
  answer?: string;
  score: number;
  secondBestScore: number;
}
