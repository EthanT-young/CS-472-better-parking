import Header from "@/components/home/Header";
import HomeParking from "@/components/home/HomeParking";
import HowItWorks from "@/components/home/HowItWorks";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Header />

      <main>
        <HomeParking />
        <HowItWorks />
      </main>
    </div>
  );
}