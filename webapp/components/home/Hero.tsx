export default function Hero() {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 sm:text-sm">
        Real-time parking. Less stress.
      </p>

      <h1 className="mt-4 max-w-2xl text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
        Find parking{" "}
        <span className="text-red-500">
          faster.
        </span>
      </h1>

      <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
        See current parking availability across campus garages and find
        the best place to park before you arrive.
      </p>
    </div>
  );
}
