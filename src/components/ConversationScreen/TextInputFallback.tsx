import { useState } from 'react'
import type { FormEvent } from 'react'

// PRD 4장: 음성 미지원/마이크 권한 거부 시 자동으로 노출되는 텍스트 입력 모드. "전송" 클릭/Enter가
// 곧 턴 종료 신호이므로(브라우저의 무음 인식을 기다릴 필요가 없음) 별도의 무음 감지 로직이
// 필요 없다 — <form onSubmit>이 그 신호 역할을 그대로 한다.
interface TextInputFallbackProps {
  onSubmit: (text: string) => void
}

function TextInputFallback({ onSubmit }: TextInputFallbackProps) {
  const [value, setValue] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = value.trim()
    if (trimmed === '') return
    onSubmit(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="text-input-fallback" className="text-sm font-medium">
        텍스트로 입력
      </label>
      <div className="flex gap-2">
        <input
          id="text-input-fallback"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="메시지를 입력하세요"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={value.trim() === ''}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          전송
        </button>
      </div>
    </form>
  )
}

export default TextInputFallback
