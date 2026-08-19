import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const ALLOWED_MODELS = ["claude-haiku-4-5", "claude-sonnet-5"] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];
const DEFAULT_MODEL: AllowedModel = "claude-haiku-4-5";

// 모델 전환은 클라이언트가 아니라 배포 환경변수로만 제어한다 (개발/테스트=haiku, 데모 캡처=sonnet-5).
const MODEL: AllowedModel = ALLOWED_MODELS.includes(process.env.CLAUDE_MODEL as AllowedModel)
  ? (process.env.CLAUDE_MODEL as AllowedModel)
  : DEFAULT_MODEL;

const MAX_TOKENS_CAP = 1024;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ChatRequestBody {
  messages: Anthropic.MessageParam[];
  system?: string;
  max_tokens?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { messages, system, max_tokens } = (req.body ?? {}) as ChatRequestBody;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  const resolvedMaxTokens = Math.min(Number(max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: resolvedMaxTokens,
    // 프롬프트 캐싱: 시스템 프롬프트는 반복 재사용되므로 캐시 대상으로 표시 (CLAUDE.md 비용 통제 원칙 2)
    system: system ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] : undefined,
    messages,
  });

  req.on("close", () => {
    stream.abort();
  });

  try {
    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.write("data: [DONE]\n\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : "stream error";
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
  } finally {
    res.end();
  }
}
