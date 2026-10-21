type FooterProps = {
  paused: boolean;
  onTogglePaused: () => void;
};

export default function Footer({ paused, onTogglePaused }: FooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-2xl leading-6">
          Counts come from garage cameras that detect whether each stall is filled. No plates or
          faces are stored. This demo uses simulated occupancy.
        </p>

        <button
          type="button"
          onClick={onTogglePaused}
          aria-pressed={paused}
          className="min-h-11 shrink-0 self-start rounded-lg border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50 sm:self-auto"
        >
          {paused ? "Resume live feed" : "Demo: pause live feed"}
        </button>
      </div>
    </footer>
  );
}
