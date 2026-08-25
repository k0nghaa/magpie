/**
 * 로컬 개발 전용 API 서버 — `api/claude-stream.ts` 핸들러를 Vercel 없이 그대로 얹어서
 * 상주(persistent) 실행한다. `verify-claude-stream.ts`의 "핸들러를 Node http로 감싸기" 패턴을
 * 재사용하되, 저건 검증 1회용 스크립트이고 이건 `npm run dev`(Vite)가 떠 있는 동안 계속 떠 있어야
 * 하는 개발 서버라는 점이 다르다.
 *
 * Vercel 계정 연동(`vercel dev`) 없이 로컬에서 `/api/claude-stream`을 실제로 호출해보기 위한
 * 용도 — Day 1에서 "계정 연동 없이 검증"으로 정한 원칙과 일관되게 결정(2026-08-25, 사람 확인,
 * docs/log/DECISIONS.md 참고). 배포되는 코드가 아니라 로컬 dev 편의 도구이므로 `api/`가 아니라
 * `scripts/`에 둔다.
 *
 * 사용법: .env에 ANTHROPIC_API_KEY 설정 후 `npm run dev:api`, 별도 터미널에서 `npm run dev`.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

// verify-claude-stream.ts와 동일한 이유로 정적 import보다 먼저 실행돼야 한다:
// api/claude-stream.ts가 모듈 로드 시점에 process.env.ANTHROPIC_API_KEY를 읽으므로.
process.loadEnvFile(new URL("../.env", import.meta.url));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY가 .env에 없습니다. 먼저 설정해주세요.");
  process.exit(1);
}

const { default: handler } = await import("../api/claude-stream.ts");

// verify:stream(3300)과 겹치지 않는 별도 포트 — 두 스크립트를 동시에 켜둘 일은 없지만
// 포트 충돌로 헷갈리지 않도록 분리.
const PORT = 3301;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
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
  } catch (err) {
    console.error("[dev-api-server] 요청 처리 중 오류:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
    }
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[dev-api-server] 로컬 API 서버 기동: http://localhost:${PORT}`);
  console.log(`[dev-api-server] vite.config.ts의 proxy 설정으로 /api/* 요청이 여기로 전달됩니다.`);
});
