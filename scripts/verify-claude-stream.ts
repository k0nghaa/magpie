/**
 * Day 1 DoD 검증용 스크립트.
 * 로컬 HTTP 서버에 api/claude-stream.ts 핸들러를 그대로 얹어서
 * 실제 Anthropic API로 스트리밍 요청을 보내고, 응답이 청크 단위로
 * 도착하는지 타임스탬프와 함께 콘솔에 출력한다.
 *
 * 사용법: .env에 ANTHROPIC_API_KEY 설정 후 `npm run verify:stream`
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

// 정적 import는 파일 상단으로 호이스팅되어 아래 loadEnvFile보다 먼저 실행되므로,
// api/claude-stream.ts가 process.env.ANTHROPIC_API_KEY를 읽기 전에 반드시 동적 import로 늦춰야 한다.
process.loadEnvFile(new URL("../.env", import.meta.url));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY가 .env에 없습니다. 먼저 설정해주세요.");
  process.exit(1);
}

const { default: handler } = await import("../api/claude-stream.ts");

const PORT = 3300;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const rawBody = await readBody(req);
  const vercelReq = {
    method: req.method,
    body: rawBody ? JSON.parse(rawBody) : {},
    on: (event: string, cb: () => void) => req.on(event, cb),
  };
  const vercelRes = {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
      return this;
    },
    setHeader(key: string, value: string) {
      res.setHeader(key, value);
    },
    write(chunk: string) {
      return res.write(chunk);
    },
    end() {
      res.end();
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await handler(vercelReq as any, vercelRes as any);
});

server.listen(PORT, async () => {
  console.log(`로컬 프록시 서버 기동: http://localhost:${PORT}`);

  const startedAt = Date.now();
  const response = await fetch(`http://localhost:${PORT}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: "You are terse. Answer in one short sentence.",
      messages: [{ role: "user", content: "바다가 파란 이유를 한 문장으로 알려줘." }],
      max_tokens: 100,
    }),
  });

  console.log(`응답 상태: ${response.status} ${response.statusText}`);
  console.log("--- SSE 청크 수신 로그 (도착 시각, 도착 순서) ---");

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let chunkCount = 0;
  let assembledText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunkCount += 1;
    const elapsedMs = Date.now() - startedAt;
    const text = decoder.decode(value, { stream: true });
    console.log(`[+${elapsedMs}ms] chunk #${chunkCount} (${value.length} bytes)`);

    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          assembledText += event.delta.text;
        }
      } catch {
        // [DONE] 등 JSON이 아닌 라인은 무시
      }
    }
  }

  console.log("--- 조립된 최종 응답 텍스트 ---");
  console.log(assembledText);
  console.log(`--- 총 청크 수: ${chunkCount}, 총 소요 시간: ${Date.now() - startedAt}ms ---`);

  server.close();
});
