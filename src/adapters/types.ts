export interface SpeechInputEngine {
  start(onInterimResult: (text: string) => void, onSpeechEnd: () => void): void;
  stop(): void;
}

export interface SpeechOutputEngine {
  speak(text: string, onEnd: () => void): void;
}

export interface ReminderEngine {
  schedule(time: Date, onFire: () => void): void;
}
