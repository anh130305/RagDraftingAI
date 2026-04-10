interface FullScreenLoaderProps {
  text?: string;
}

export default function FullScreenLoader({ text = 'Đang tải không gian làm việc...' }: FullScreenLoaderProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background text-on-surface" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm tracking-wide text-on-surface-variant uppercase">{text}</p>
      </div>
    </div>
  );
}