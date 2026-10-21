type HeaderProps = {
  highContrast: boolean;
  onToggleContrast: () => void;
};

export default function Header({ highContrast, onToggleContrast }: HeaderProps) {
  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <p className="text-lg font-extrabold tracking-tight sm:text-xl">
          UNLV <span className="text-red-500">Parking</span>
        </p>

        <button
          type="button"
          onClick={onToggleContrast}
          aria-pressed={highContrast}
          className="min-h-11 rounded-lg border border-slate-600 px-3 text-sm font-semibold transition hover:border-slate-400 aria-pressed:border-yellow-300 aria-pressed:bg-yellow-300 aria-pressed:text-black"
        >
          High contrast
        </button>
      </div>
    </header>
  );
}
