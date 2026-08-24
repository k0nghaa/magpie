import type { SpeechInputError, SpeechInputErrorReason } from '../adapters/types.ts'

// LLM 스트리밍 실패도 상태머신 입장에서는 "에러가 나서 error 상태로 간다"는 점이 마이크
// 입력 에러와 동일해, 별도 에러 타입을 새로 만들지 않고 SpeechInputError 타입을 그대로
// 재사용한다(사람 확인 후 결정, docs/log/DECISIONS.md 참고) — reason enum에 이미 이 목적에
// 맞는 'network'/'unknown'/'aborted'가 있어 새 taxonomy가 필요하지 않았다.
export class ClaudeStreamError extends Error implements SpeechInputError {
  reason: SpeechInputErrorReason

  constructor(reason: SpeechInputErrorReason, message?: string) {
    super(message ?? reason)
    this.reason = reason
    this.name = 'ClaudeStreamError'
  }
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface StreamClaudeResponseParams {
  messages: ClaudeMessage[]
  system?: string
  onTextDelta: (text: string) => void
  signal?: AbortSignal
}

// api/claude-stream.ts를 직접 읽어 확인한 서버 SSE 형식(추측 아님): Anthropic SDK
// `messages.stream()`이 내는 원본 이벤트(MessageStreamEvent)를 그대로 `data: {...}\n\n`로
// 중계하고, 스트림이 끝나면 `data: [DONE]\n\n`을, 서버 쪽에서 에러가 나면
// `data: {"type":"error","message":"..."}\n\n`을 보낸다. 이 함수는 그 형식에만 맞춰 파싱한다 —
// API 키는 서버(api/claude-stream.ts)만 다루고 여기선 존재조차 모른다.
export async function streamClaudeResponse({
  messages,
  system,
  onTextDelta,
  signal,
}: StreamClaudeResponseParams): Promise<void> {
  const response = await fetch('/api/claude-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system }),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new ClaudeStreamError('network', `요청 실패: ${response.status} ${response.statusText}`)
  }

  // MDN "Using readable streams" 예제와 동일하게 getReader() + TextDecoder({stream: true})로
  // 청크를 읽는다(https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams).
  // fetch가 잘라주는 청크 경계가 SSE 이벤트 경계(빈 줄 `\n\n`)와 일치한다는 보장이 없으므로,
  // 아직 완결되지 않은 마지막 조각은 buffer에 남겨뒀다가 다음 청크와 이어붙인다 — 이 버퍼링이
  // 없으면 이벤트 JSON이 청크 경계에서 잘려 파싱 실패할 수 있다.
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const rawEvents = buffer.split('\n\n')
    buffer = rawEvents.pop() ?? '' // 마지막 조각은 다음 청크로 이어질 수 있으므로 버퍼에 남김

    for (const rawEvent of rawEvents) {
      const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '))
      if (!dataLine) continue

      const data = dataLine.slice('data: '.length)
      if (data === '[DONE]') return

      const event = JSON.parse(data)

      if (event.type === 'error') {
        throw new ClaudeStreamError('unknown', event.message)
      }
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        onTextDelta(event.delta.text)
      }
    }
  }

  // 여기 도달했다는 건 [DONE]을 못 받고(위 return 없이) 스트림이 끝났다는 뜻 —
  // 서버가 정상 종료 시 항상 [DONE]을 마지막에 쓰므로, 이 경우는 연결이 중간에 끊긴 것으로 본다
  // (PRD 4장 "네트워크 끊김" 예외 시나리오).
  throw new ClaudeStreamError('network', '스트림이 완료 신호([DONE]) 없이 종료되었습니다')
}
