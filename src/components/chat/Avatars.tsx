/**
 * Avatar 2 phía của hội thoại.
 * - AI: con dấu vòng kép trên nền shell, bên trong là thấu kính -> cùng họ với con dấu verdict.
 * - Bạn: hình người giản lược trên nền crimson nhạt.
 */
export function AiAvatar({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full bg-shell text-shell-ink" style={{ width: size, height: size }} role="img" aria-label="Trợ lý AI">
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
        <circle cx="18" cy="18" r="14.5" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
        <circle cx="16.5" cy="16.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20.6 20.6 L24.5 24.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16.5" cy="16.5" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}

export function UserAvatar({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full border border-rule bg-surface text-ink-2" style={{ width: size, height: size }} role="img" aria-label="Bạn">
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
        <circle cx="18" cy="14" r="5" fill="currentColor" />
        <path d="M8.5 28c1.2-5 5-7.5 9.5-7.5s8.3 2.5 9.5 7.5" fill="currentColor" />
      </svg>
    </span>
  );
}
