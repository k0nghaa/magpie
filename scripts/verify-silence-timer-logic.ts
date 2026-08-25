// 상태머신 reducer + 무음 디바운스 타이머의 순수 로직을 실제 브라우저 없이 결정론적으로
// 검증하는 임시 스크립트. `npx tsx scripts/verify-silence-timer-logic.ts`로 실행.
import { conversationReducer, initialConversationState } from '../src/state-machine/conversationReducer.ts'
import { createSilenceTimer } from '../src/state-machine/silenceTimer.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function testReducer() {
  console.log('\n=== conversationReducer ===')
  let state = initialConversationState
  assert(state.status === 'idle', '초기 상태는 idle')

  state = conversationReducer(state, { type: 'SILENCE_TIMEOUT' })
  assert(state.status === 'idle', 'idle에서 SILENCE_TIMEOUT은 무시됨(불가능한 전이 차단)')

  state = conversationReducer(state, { type: 'START_LISTENING' })
  assert(state.status === 'listening', 'START_LISTENING → listening')

  state = conversationReducer(state, { type: 'INTERIM_RESULT', text: '안녕' })
  assert(state.status === 'user_speaking' && state.transcript === '안녕', 'INTERIM_RESULT → user_speaking, transcript 반영')

  state = conversationReducer(state, { type: 'INTERIM_RESULT', text: '안녕하세요' })
  assert(state.status === 'user_speaking' && state.transcript === '안녕하세요', '연속 INTERIM_RESULT는 user_speaking 유지, transcript 갱신')

  state = conversationReducer(state, { type: 'SILENCE_TIMEOUT' })
  assert(state.status === 'sending', 'user_speaking에서 SILENCE_TIMEOUT → sending')

  state = conversationReducer(state, { type: 'SILENCE_TIMEOUT' })
  assert(state.status === 'sending', 'sending에서 SILENCE_TIMEOUT 재수신은 무시됨(불가능한 전이 차단)')

  state = conversationReducer(state, { type: 'ENGINE_ERROR', error: { reason: 'network' } })
  assert(state.status === 'error' && state.error?.reason === 'network', 'ENGINE_ERROR → error, 에러 정보 보존')

  state = conversationReducer(state, { type: 'START_LISTENING' })
  assert(state.status === 'listening' && state.error === null, 'error에서 START_LISTENING(재시도) → listening, 에러 초기화')

  state = conversationReducer(state, { type: 'RESET' })
  assert(state.status === 'idle' && state.transcript === '' && state.error === null, 'RESET → 초기 상태로 복귀')

  // "이어서 말하기" — user_speaking/sending에서만 의미가 있고, transcript는 보존돼야 한다.
  state = conversationReducer(state, { type: 'RESUME_SPEAKING' })
  assert(state.status === 'idle', 'idle에서 RESUME_SPEAKING은 무시됨(불가능한 전이 차단)')

  state = conversationReducer(state, { type: 'START_LISTENING' })
  state = conversationReducer(state, { type: 'RESUME_SPEAKING' })
  assert(state.status === 'listening', 'listening에서 RESUME_SPEAKING은 무시됨(전이 대상 아님)')

  state = conversationReducer(state, { type: 'INTERIM_RESULT', text: '음... 그러니까' })
  state = conversationReducer(state, { type: 'SILENCE_TIMEOUT' }) // 오탐으로 sending 진입했다고 가정
  assert(state.status === 'sending', '무음 오탐 재현: user_speaking → sending')

  state = conversationReducer(state, { type: 'RESUME_SPEAKING' })
  assert(
    state.status === 'listening' && state.transcript === '음... 그러니까',
    'sending에서 RESUME_SPEAKING → listening 복귀, transcript는 보존됨',
  )

  // user_speaking에서도 RESUME_SPEAKING이 먹혀야 한다(오탐이 무음 타이머 발화 전에 눌린 경우 대비).
  state = conversationReducer(state, { type: 'INTERIM_RESULT', text: '다시 말하는 중' })
  state = conversationReducer(state, { type: 'RESUME_SPEAKING' })
  assert(state.status === 'listening', 'user_speaking에서도 RESUME_SPEAKING → listening')

  state = conversationReducer(state, { type: 'RESET' })

  // 텍스트 모드 — 전송이 곧 턴 종료 신호, 무음 타이머 없이 바로 sending.
  state = conversationReducer(state, { type: 'TEXT_SUBMITTED', text: '텍스트로 보낸 메시지' })
  assert(
    state.status === 'sending' && state.transcript === '텍스트로 보낸 메시지',
    'idle에서 TEXT_SUBMITTED → 바로 sending, transcript 반영',
  )

  state = conversationReducer(state, { type: 'TEXT_SUBMITTED', text: '   ' })
  assert(state.status === 'sending' && state.transcript === '텍스트로 보낸 메시지', '공백만 있는 TEXT_SUBMITTED는 무시됨')

  state = conversationReducer(state, { type: 'ENGINE_ERROR', error: { reason: 'unknown' } })
  state = conversationReducer(state, { type: 'TEXT_SUBMITTED', text: '에러 상태에서 보냄' })
  assert(state.status === 'error', 'error 상태에서 TEXT_SUBMITTED는 무시됨(불가능한 전이 차단)')

  // Day 5: streaming → assistant_speaking → listening (TTS 재생 사이클)
  state = conversationReducer(state, { type: 'RESET' })
  state = conversationReducer(state, { type: 'TEXT_SUBMITTED', text: '오늘 날씨 어때?' })
  state = conversationReducer(state, { type: 'STREAM_STARTED' })
  assert(state.status === 'streaming', 'sending에서 STREAM_STARTED → streaming')

  state = conversationReducer(state, { type: 'STREAM_DELTA', text: '오늘은' })
  state = conversationReducer(state, { type: 'STREAM_DELTA', text: ' 맑습니다' })
  assert(state.assistantText === '오늘은 맑습니다', 'STREAM_DELTA가 순서대로 누적됨')

  state = conversationReducer(state, { type: 'STREAM_DONE' })
  assert(
    state.status === 'assistant_speaking' && state.transcript === '',
    'streaming에서 STREAM_DONE → assistant_speaking(바로 listening 아님), transcript 비움',
  )

  state = conversationReducer(state, { type: 'INTERIM_RESULT', text: '마이크가 켜져있으면 안 됨' })
  assert(state.status === 'assistant_speaking', 'assistant_speaking에서 INTERIM_RESULT는 무시됨(마이크는 꺼져 있어야 함)')

  state = conversationReducer(state, { type: 'SILENCE_TIMEOUT' })
  assert(state.status === 'assistant_speaking', 'assistant_speaking에서 SILENCE_TIMEOUT은 무시됨')

  state = conversationReducer(state, { type: 'ASSISTANT_SPEECH_DONE' })
  assert(
    state.status === 'listening' && state.assistantText === '오늘은 맑습니다',
    'assistant_speaking에서 ASSISTANT_SPEECH_DONE → listening, assistantText는 다음 STREAM_STARTED까지 보존',
  )

  state = conversationReducer(state, { type: 'ASSISTANT_SPEECH_DONE' })
  assert(state.status === 'listening', 'listening에서 ASSISTANT_SPEECH_DONE은 무시됨(불가능한 전이 차단)')

  state = conversationReducer(state, { type: 'RESET' })
  state = conversationReducer(state, { type: 'ASSISTANT_SPEECH_DONE' })
  assert(state.status === 'idle', 'idle에서 ASSISTANT_SPEECH_DONE은 무시됨(불가능한 전이 차단)')
}

async function testSilenceTimer() {
  console.log('\n=== createSilenceTimer ===')

  await new Promise<void>((resolve) => {
    let fired = false
    const timer = createSilenceTimer(() => {
      fired = true
    }, 300)

    timer.reset()
    setTimeout(() => timer.reset(), 100) // 100ms 시점에 리셋 → 아직 안 끝났어야 함
    setTimeout(() => timer.reset(), 200) // 200ms 시점에 또 리셋 → 아직 안 끝났어야 함

    setTimeout(() => {
      assert(!fired, '마지막 reset() 이후 타임아웃(300ms) 전에는 onTimeout이 안 불림')
    }, 480) // 마지막 reset(200ms) + 280ms = 480ms 시점, 아직 300ms 안 지남

    setTimeout(() => {
      assert(fired, '마지막 reset() 이후 타임아웃(300ms)이 지나면 onTimeout이 정확히 불림')
      resolve()
    }, 600) // 마지막 reset(200ms) + 400ms = 600ms 시점, 300ms 지남
  })

  await new Promise<void>((resolve) => {
    let callCount = 0
    const timer = createSilenceTimer(() => {
      callCount += 1
    }, 200)
    timer.reset()
    timer.cancel()
    setTimeout(() => {
      assert(callCount === 0, 'cancel() 이후에는 onTimeout이 절대 안 불림')
      resolve()
    }, 400)
  })

  await sleep(50)
}

await testReducer()
await testSilenceTimer()

if (process.exitCode === 1) {
  console.log('\n일부 검증 실패')
} else {
  console.log('\n모든 검증 통과')
}
