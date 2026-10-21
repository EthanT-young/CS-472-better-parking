const steps = [
  {
    number: "01",
    title: "Choose your location",
    description:
      "Select the site, garage, and floor you want to check.",
  },
  {
    number: "02",
    title: "View availability",
    description:
      "See current parking availability and floor information.",
  },
  {
    number: "03",
    title: "Park with confidence",
    description:
      "Choose where to park before you reach the garage.",
  },
];

export default function HowItWorks() {
  return (
    <section className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
          How it works
        </p>

        <h2 className="mt-3 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          Get to your spot in three simple steps.
        </h2>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.number}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <span className="text-sm font-extrabold text-red-500">
                {step.number}
              </span>

              <h3 className="mt-4 text-lg font-bold">
                {step.title}
              </h3>

              <p className="mt-2 leading-6 text-slate-600">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
