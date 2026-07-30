import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />
      <section className="max-w-3xl mx-auto px-6 lg:px-10 py-32 text-center" data-testid="not-found">
        <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold">404</div>
        <h1 className="mt-3 font-display text-6xl md:text-7xl tracking-tighter font-medium">Nothing here.</h1>
        <p className="mt-4 text-neutral-600">The page you're looking for doesn't exist or has moved.</p>
        <Link to="/" className="inline-flex mt-8 px-5 py-2.5 rounded-full bg-black text-white text-sm hover:bg-black/90 transition">
          Go home
        </Link>
      </section>
      <Footer />
    </div>
  );
}
