import { Link } from "react-router-dom";
import { Github, Twitter, Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t skl-border mt-24" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-black text-white grid place-items-center font-display font-bold text-sm">
                S
              </div>
              <span className="font-display font-semibold tracking-tight text-[17px]">
                Skilleraa
              </span>
            </div>
            <p className="mt-4 text-sm text-neutral-600 max-w-xs leading-relaxed">
              Real freelance work for students, freshers and beginner
              professionals.
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Product
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/jobs" className="hover:text-black text-neutral-600">
                  Find Jobs
                </Link>
              </li>
              <li>
                <Link to="/post-job" className="hover:text-black text-neutral-600">
                  Post a Job
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-black text-neutral-600">
                  About
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Legal
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/about" className="hover:text-black text-neutral-600">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-black text-neutral-600">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-black text-neutral-600">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Follow
            </div>
            <div className="mt-4 flex gap-2">
              {[Github, Twitter, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="h-9 w-9 rounded-full border skl-border grid place-items-center hover:bg-neutral-50 transition"
                  aria-label="social"
                  data-testid={`footer-social-${i}`}
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t skl-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-neutral-500">
          <div>© {new Date().getFullYear()} Skilleraa. All rights reserved.</div>
          <div className="font-mono">Built with intent · Made in India</div>
        </div>
      </div>
    </footer>
  );
}
