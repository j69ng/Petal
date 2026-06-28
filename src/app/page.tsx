import Link from "next/link";
import BloomCalendar from "@/components/BloomCalendar";
import { SymptomLog } from "@/lib/types";

function sampleLogs(): SymptomLog[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = (day: number) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(day)}`;
  const days = Math.min(now.getDate(), 28);
  const pattern = [2, 6, 8, 3, 9, 4, 1, 7, 5, 8, 3, 2, 6, 9, 4];

  const logs: SymptomLog[] = [];
  for (let d = 1; d <= days; d += 2) {
    const severity = pattern[d % pattern.length];
    logs.push({
      id: `demo-${d}`,
      user_id: "demo",
      log_date: dateStr(d),
      mood: 5,
      energy: 5,
      sleep_hours: 7,
      notes: null,
      created_at: "",
      entries: [{ id: `e-${d}`, log_id: `demo-${d}`, symptom_key: "Fatigue", severity, body_region: null }],
    });
  }
  return logs;
}

export default function LandingPage() {
  const logs = sampleLogs();

  return (
    <main>
      <header className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-20">
        <span className="font-display text-2xl italic">Petal</span>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#pricing" className="hover:underline">Pricing</a>
          <a
            href="https://github.com/"
            className="hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
          <Link href="/login" className="hover:underline">Log in</Link>
          <Link
            href="/signup"
            className="bg-bloom text-white px-4 py-2 rounded-full hover:bg-bloom-dark transition-colors"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 grid sm:grid-cols-2 gap-10 items-center">
        <div>
          <p className="eyebrow mb-4">For PCOS · Endometriosis · Fibromyalgia · Autoimmune</p>
          <h1 className="font-display text-4xl sm:text-5xl leading-[1.1] mb-5">
            Track what your doctor visit is too short to catch.
          </h1>
          <p className="text-lg text-ink/80 mb-8 max-w-md">
            A daily log built for symptoms that don&apos;t show up on a blood test. Petal turns
            weeks of entries into patterns you can actually bring to an appointment.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/signup"
              className="bg-bloom text-white px-6 py-3 rounded-full font-medium hover:bg-bloom-dark transition-colors"
            >
              Start tracking — free
            </Link>
            <a href="#how" className="text-sm underline text-ink/70">
              See how it works
            </a>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="bg-white/50 rounded-3xl p-6 border border-mute-light">
            <BloomCalendar month={new Date()} logs={logs} size={300} />
            <p className="text-center text-sm text-mute mt-2">Every day becomes a petal.</p>
          </div>
        </div>
      </section>

      <section id="how" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 grid sm:grid-cols-3 gap-8">
        <div>
          <p className="eyebrow mb-2">Tracking</p>
          <h2 className="font-display text-2xl mb-2">Built for your condition</h2>
          <p className="text-ink/80">
            Pick PCOS, endometriosis, fibromyalgia, or an autoimmune condition, and your symptom
            list is ready in seconds — no setup, no spreadsheet.
          </p>
        </div>
        <div>
          <p className="eyebrow mb-2">Patterns</p>
          <h2 className="font-display text-2xl mb-2">See the shape of your month</h2>
          <p className="text-ink/80">
            The bloom calendar turns severity into color and size, so a bad week is visible at a
            glance instead of buried in a list.
          </p>
        </div>
        <div>
          <p className="eyebrow mb-2">For your doctor</p>
          <h2 className="font-display text-2xl mb-2">Bring data, not vibes</h2>
          <p className="text-ink/80">
            Trends and plain-language patterns you can describe in an appointment — never a
            diagnosis, always something worth discussing.
          </p>
        </div>
      </section>

      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="font-display text-3xl mb-8 text-center">Simple pricing</h2>
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="border border-mute-light rounded-3xl p-6">
            <p className="font-display text-xl mb-1">Free</p>
            <p className="text-3xl font-display mb-4">$0</p>
            <ul className="text-sm text-ink/80 space-y-2 mb-6">
              <li>Daily logging, all conditions</li>
              <li>Bloom calendar</li>
              <li>30 days of history</li>
            </ul>
            <Link
              href="/signup"
              className="block text-center border border-ink rounded-full py-2.5 hover:bg-ink hover:text-bg transition-colors"
            >
              Start free
            </Link>
          </div>
          <div className="border-2 border-bloom rounded-3xl p-6 bg-bloom-light/10">
            <p className="font-display text-xl mb-1">Pro</p>
            <p className="text-3xl font-display mb-1">$7<span className="text-base text-mute">/mo</span></p>
            <p className="text-sm text-mute mb-4">or $60/yr — save 29%</p>
            <ul className="text-sm text-ink/80 space-y-2 mb-6">
              <li>Unlimited history</li>
              <li>Pattern insights</li>
              <li>Exportable doctor report</li>
            </ul>
            <Link
              href="/signup"
              className="block text-center bg-bloom text-white rounded-full py-2.5 hover:bg-bloom-dark transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-10 text-sm text-mute flex flex-wrap justify-between gap-4">
        <p>Petal is open source — fork it, self-host it, make it yours.</p>
        <p>Not a substitute for medical advice.</p>
      </footer>
    </main>
  );
}
