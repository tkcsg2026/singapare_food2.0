import { createAdminSupabaseClient } from "@/lib/supabase-server";
import type { ChatbotSourceType } from "@/types/chatbot";

export function isChatbotLoggingEnabled(): boolean {
  return process.env.ENABLE_CHATBOT_LOGGING === "true";
}

export async function logChatbotExchange(opts: {
  userId: string | null;
  sessionId: string;
  language: string;
  userMessage: string;
  assistantMessage: string;
  sourceType: ChatbotSourceType;
}): Promise<void> {
  if (!isChatbotLoggingEnabled()) return;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return;

  try {
    await supabase.from("chatbot_logs").insert({
      user_id: opts.userId,
      session_id: opts.sessionId.slice(0, 128),
      language: opts.language.slice(0, 8),
      user_message: opts.userMessage.slice(0, 8000),
      assistant_message: opts.assistantMessage.slice(0, 8000),
      source_type: opts.sourceType,
    });
  } catch {
    // Table may be missing or RLS — never block chat
  }
}
