import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function About() {
  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />
      <section className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
        <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold">About</div>
        <h1 className="mt-3 font-display text-5xl md:text-6xl tracking-tighter font-medium">
          A minimal marketplace for real work.
        </h1>
        <div className="mt-8 space-y-5 text-neutral-700 leading-relaxed text-lg">
          <p>
            Skilleraa exists to give students and beginner professionals a fair shot at real freelance work. Big platforms are noisy, expensive and stacked against beginners. We are not.
          </p>
          <p>
            We connect students, freshers and beginner professionals with startups, agencies and businesses in a distraction-free interface — no gimmicks, no gradients, no clickbait.
          </p>
          <p>
            We charge nothing to students. Verified clients pay only when they hire. That's it.
          </p>
        </div>

        <div className="mt-16 border-t skl-border pt-10 grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Contact</div>
            <p className="mt-2">hello@skilleraa.com</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Address</div>
            <p className="mt-2">Bengaluru, India</p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
