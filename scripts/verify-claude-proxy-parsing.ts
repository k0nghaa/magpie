/**
 * src/api/claudeProxy.ts의 SSE 파싱 로직을 실제 네트워크/Anthropic API 없이 결정론적으로
 * 검증하는 스크립트. Day 3의 "가짜 SpeechRecognition 생성자 주입" 패턴과 동일하게, 여기서는
 * 가짜 fetch/Response/ReadableStream을 주입해 api/claude-stream.ts가 실제로 내려주는 형식
 * (`data: {...}\n\n`, 종료 시 `data: [DONE]\n\n`, 에러 시 `data: {"type":"error",...}\n\n`)을
 * 재현한다. 특히 fetch 청크 경계가 SSE 이벤트 경계와 무관하다는 점(MDN 문서상 보장 없음)을
 * 실제로 어긋나게 만들어 버퍼링 로직이 맞는지 확인한다.
 *
 * 사용법: `npm run verify:claude-proxy`
 */
import { ClaudeStreamError, streamClaudeResponse } from '../src/api/claudeProxy.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// 이벤트 경계와 무관하게 아주 작은 크기(7자)로 잘라, 하나의 JSON 이벤트가 여러 청크에 걸쳐
// 도착하는 상황을 강제로 재현한다.
function chunkString(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

function fakeStreamingResponse(chunks: string[], overrides: Partial<Response> = {}): Response {
  const encoder = new TextEncoder()
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[index]))
      index += 1
    },
  })
  return { ok: true, status: 200, statusText: 'OK', body, ...overrides } as Response
}

function withFakeFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return run().finally(() => {
    globalThis.fetch = original
  })
}

async function testNormalStreamingAcrossChunkBoundaries() {
  console.log('\n=== 정상 스트리밍: 청크가 이벤트 JSON 중간에서 잘려도 정확히 조립됨 ===')

  const events = [
    { type: 'message_start' },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: '안' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: '녕' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: '하세요' } },
    { type: 'message_stop' },
  ]
  const sseText = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n'
  const chunks = chunkString(sseText, 7) // 7자 단위로 잘라 JSON 한복판에서 끊기도록 강제

  let received = ''
  await withFakeFetch(
    (async () => fakeStreamingResponse(chunks)) as typeof fetch,
    () =>
      streamClaudeResponse({
        messages: [{ role: 'user', content: '안녕' }],
        onTextDelta: (text) => {
          received += text
        },
      }),
  )

  assert(received === '안녕하세요', `모든 text_delta가 순서대로 조립됨 (받은 값: "${received}")`)
}

async function testServerErrorEventMidStream() {
  console.log('\n=== 서버가 스트림 도중 에러 이벤트를 보낸 경우 ===')

  const sseText =
    `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: '일부' } })}\n\n` +
    `data: ${JSON.stringify({ type: 'error', message: 'stream error' })}\n\n`

  let received = ''
  let thrown: unknown = null
  await withFakeFetch(
    (async () => fakeStreamingResponse([sseText])) as typeof fetch,
    async () => {
      try {
        await streamClaudeResponse({
          messages: [],
          onTextDelta: (text) => {
            received += text
          },
        })
      } catch (err) {
        thrown = err
      }
    },
  )

  assert(received === '일부', '에러 이전까지 도착한 델타는 정상 반영됨')
  assert(thrown instanceof ClaudeStreamError, '서버 에러 이벤트는 ClaudeStreamError로 던져짐')
  assert(
    thrown instanceof ClaudeStreamError && thrown.message === 'stream error',
    '에러 메시지가 서버가 보낸 그대로 전달됨',
  )
}

async function testHttpLevelFailure() {
  console.log('\n=== HTTP 상태 자체가 실패(!response.ok)인 경우 ===')

  let thrown: unknown = null
  await withFakeFetch(
    (async () => fakeStreamingResponse([], { ok: false, status: 500, statusText: 'Internal Server Error' })) as typeof fetch,
    async () => {
      try {
        await streamClaudeResponse({ messages: [], onTextDelta: () => {} })
      } catch (err) {
        thrown = err
      }
    },
  )

  assert(
    thrown instanceof ClaudeStreamError && thrown.reason === 'network',
    'HTTP 실패(500)는 network 사유의 ClaudeStreamError로 던져짐',
  )
}

async function testMissingDoneSignalTreatedAsNetworkError() {
  console.log('\n=== [DONE] 신호 없이 스트림이 끊긴 경우(네트워크 끊김 시나리오, PRD 4장) ===')

  const sseText = `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: '조금만' } })}\n\n`

  let received = ''
  let thrown: unknown = null
  await withFakeFetch(
    (async () => fakeStreamingResponse([sseText])) as typeof fetch,
    async () => {
      try {
        await streamClaudeResponse({
          messages: [],
          onTextDelta: (text) => {
            received += text
          },
        })
      } catch (err) {
        thrown = err
      }
    },
  )

  assert(received === '조금만', '연결이 끊기기 전까지 받은 델타는 화면에 정상 반영됨')
  assert(
    thrown instanceof ClaudeStreamError && thrown.reason === 'network',
    '[DONE] 없이 종료되면 network 사유의 에러로 처리됨(무한 대기하지 않음)',
  )
}

async function testFetchRejectionTreatedAsNetworkError() {
  console.log('\n=== fetch() 자체가 거부된 경우(오프라인, DNS 실패 등 연결 불가) ===')

  let thrown: unknown = null
  await withFakeFetch(
    (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch,
    async () => {
      try {
        await streamClaudeResponse({ messages: [], onTextDelta: () => {} })
      } catch (err) {
        thrown = err
      }
    },
  )

  assert(
    thrown instanceof ClaudeStreamError && thrown.reason === 'network',
    'fetch() 자체가 거부되면(Response 없음) network 사유의 ClaudeStreamError로 던져짐',
  )
}

async function testAbortErrorPassesThroughUnwrapped() {
  console.log('\n=== AbortController로 취소한 경우: ClaudeStreamError로 감싸지 않고 그대로 전달 ===')

  let thrown: unknown = null
  const controller = new AbortController()
  controller.abort()

  await withFakeFetch(
    (async () => {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }) as typeof fetch,
    async () => {
      try {
        await streamClaudeResponse({ messages: [], onTextDelta: () => {}, signal: controller.signal })
      } catch (err) {
        thrown = err
      }
    },
  )

  assert(
    thrown instanceof DOMException && thrown.name === 'AbortError' && !(thrown instanceof ClaudeStreamError),
    'abort로 인한 실패는 사용자에게 보여줄 에러(ClaudeStreamError)로 감싸지 않아, 호출자가 의도된 취소로 구분 가능',
  )
}

await testNormalStreamingAcrossChunkBoundaries()
await testServerErrorEventMidStream()
await testHttpLevelFailure()
await testMissingDoneSignalTreatedAsNetworkError()
await testFetchRejectionTreatedAsNetworkError()
await testAbortErrorPassesThroughUnwrapped()

if (process.exitCode === 1) {
  console.log('\n일부 검증 실패')
} else {
  console.log('\n모든 검증 통과')
}
