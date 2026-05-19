import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { retrieveAnswer } from "@/lib/chatbot/retrieveAnswer";
import { logChatbotExchange } from "@/lib/chatbot/logChatbotExchange";
import type { ChatbotApiResponse } from "@/types/chatbot";

export const runtime = "nodejs";

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user?.id ?? null;
}

export async function POST(req: NextRequest) {
  let body: { message?: string; sessionId?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message : "";
  const sessionId = typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : "anon";
  const langRaw = body.language === "ja" ? "ja" : "en";

  if (message.length > 2000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  let result: ChatbotApiResponse;
  try {
    result = await retrieveAnswer(message, langRaw);
  } catch {
    const fallback: ChatbotApiResponse =
      langRaw === "ja"
        ? {
            answer: "一時的なエラーが発生しました。しばらくしてからもう一度お試しください。",
            sourceType: "faq",
            matchedTopic: "generic_help",
          }
        : {
            answer: "Something went wrong. Please try again in a moment.",
            sourceType: "faq",
            matchedTopic: "generic_help",
          };
    result = fallback;
  }

  const userId = await resolveUserId(req);
  void logChatbotExchange({
    userId,
    sessionId,
    language: langRaw,
    userMessage: message,
    assistantMessage: result.answer,
    sourceType: result.sourceType,
  });

  return NextResponse.json(result);
}
