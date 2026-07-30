/**
 * Local sample jobs used when the API/database is unavailable.
 * Shape matches serialize_job() from the backend.
 */

export const MOCK_JOBS = [
  {
    id: "mock-job-1",
    title: "Brand Identity for Campus Startup",
    category: "Design",
    description:
      "Design a complete brand kit: logo, color system, typography, and social templates for an early-stage student startup. Deliverables in Figma.",
    skills: ["Figma", "Branding", "Illustration"],
    budget: "₹8,000 – ₹15,000",
    duration: "2 weeks",
    experience: "Beginner",
    remote: true,
    location: "",
    client_id: "mock-client-1",
    company_name: "Northstar Labs",
    company_letter: "N",
    status: "open",
    applications_count: 4,
    created_at: "2026-07-20T10:00:00.000Z",
  },
  {
    id: "mock-job-2",
    title: "React Landing Page for EdTech Product",
    category: "Development",
    description:
      "Build a responsive marketing landing page in React with Tailwind. Includes hero, pricing, FAQ, and a simple waitlist form.",
    skills: ["React", "Tailwind", "JavaScript"],
    budget: "₹12,000 – ₹20,000",
    duration: "10 days",
    experience: "Intermediate",
    remote: true,
    location: "",
    client_id: "mock-client-2",
    company_name: "Learnly",
    company_letter: "L",
    status: "open",
    applications_count: 7,
    created_at: "2026-07-22T08:30:00.000Z",
  },
  {
    id: "mock-job-3",
    title: "SEO Blog Series for SaaS Tool",
    category: "Writing",
    description:
      "Write 4 long-form SEO articles (1,200+ words) about productivity workflows. Research keywords and include internal-link suggestions.",
    skills: ["SEO", "Copywriting", "Content Strategy"],
    budget: "₹6,000 – ₹10,000",
    duration: "3 weeks",
    experience: "Beginner",
    remote: true,
    location: "",
    client_id: "mock-client-3",
    company_name: "Flowdesk",
    company_letter: "F",
    status: "open",
    applications_count: 2,
    created_at: "2026-07-18T14:00:00.000Z",
  },
  {
    id: "mock-job-4",
    title: "Product Demo Video Edit",
    category: "Video",
    description:
      "Edit a 60–90 second product demo from provided screen recordings and VO. Motion titles, captions, and end card included.",
    skills: ["Premiere Pro", "After Effects", "Motion"],
    budget: "₹10,000 – ₹18,000",
    duration: "1 week",
    experience: "Intermediate",
    remote: true,
    location: "",
    client_id: "mock-client-4",
    company_name: "Clipform",
    company_letter: "C",
    status: "open",
    applications_count: 5,
    created_at: "2026-07-25T11:15:00.000Z",
  },
  {
    id: "mock-job-5",
    title: "Instagram Growth Campaign",
    category: "Marketing",
    description:
      "Plan and execute a 3-week Instagram content calendar for a D2C apparel brand. Captions, hashtags, and basic performance report.",
    skills: ["Social Media", "Canva", "Analytics"],
    budget: "₹7,500 – ₹12,000",
    duration: "3 weeks",
    experience: "Beginner",
    remote: false,
    location: "Mumbai",
    client_id: "mock-client-5",
    company_name: "Thread & Co",
    company_letter: "T",
    status: "open",
    applications_count: 9,
    created_at: "2026-07-21T09:00:00.000Z",
  },
  {
    id: "mock-job-6",
    title: "Node.js API for Marketplace MVP",
    category: "Development",
    description:
      "Implement REST endpoints for listings, applications, and profiles. Prefer FastAPI or Express. Include basic auth middleware stubs.",
    skills: ["Node.js", "MongoDB", "REST"],
    budget: "₹20,000 – ₹35,000",
    duration: "4 weeks",
    experience: "Expert",
    remote: true,
    location: "",
    client_id: "mock-client-6",
    company_name: "Skilleraa Studio",
    company_letter: "S",
    status: "in_progress",
    applications_count: 3,
    created_at: "2026-07-26T16:45:00.000Z",
  },
  {
    id: "mock-job-7",
    title: "UI Redesign for Student Dashboard",
    category: "Design",
    description:
      "Redesign dashboard cards, empty states, and navigation for a freelancing marketplace. Deliver high-fidelity Figma frames for desktop + mobile.",
    skills: ["UI Design", "Figma", "Prototyping"],
    budget: "₹15,000 – ₹25,000",
    duration: "2 weeks",
    experience: "Intermediate",
    remote: false,
    location: "Bengaluru",
    client_id: "mock-client-7",
    company_name: "Pixelwright",
    company_letter: "P",
    status: "closed",
    applications_count: 6,
    created_at: "2026-07-19T12:20:00.000Z",
  },
  {
    id: "mock-job-8",
    title: "Case Study Ghostwriting",
    category: "Writing",
    description:
      "Interview a founder (notes provided) and draft a polished customer case study for the website. Tone: clear, credible, minimal hype.",
    skills: ["Ghostwriting", "Storytelling", "B2B"],
    budget: "₹5,000 – ₹8,000",
    duration: "5 days",
    experience: "Intermediate",
    remote: true,
    location: "",
    client_id: "mock-client-8",
    company_name: "Harbor CRM",
    company_letter: "H",
    status: "completed",
    applications_count: 1,
    created_at: "2026-07-27T07:40:00.000Z",
  },
];

import { isPubliclyListed, normalizeJobStatus } from "@/lib/jobStatus";
import { applyStatusMap } from "@/lib/mockJobStatusMap";

/**
 * Filter mock jobs the same way the Browse Jobs page sends query params.
 * Only publicly listed (open) jobs appear in Browse.
 * @param {{ q?: string, category?: string, experience?: string, remote?: boolean|string|null }} params
 */
export function filterMockJobs(params = {}) {
  const q = (params.q || "").trim().toLowerCase();
  const category = params.category && params.category !== "All" ? params.category : null;
  const experience = params.experience && params.experience !== "All" ? params.experience : null;
  let remote = params.remote;
  if (remote === "true") remote = true;
  if (remote === "false") remote = false;
  if (remote !== true && remote !== false) remote = null;

  return applyStatusMap(MOCK_JOBS, normalizeJobStatus).filter((job) => {
    if (!isPubliclyListed(job.status)) return false;
    if (category && job.category !== category) return false;
    if (experience && job.experience !== experience) return false;
    if (remote === true && !job.remote) return false;
    if (remote === false && job.remote) return false;
    if (q) {
      const hay = [
        job.title,
        job.description,
        job.company_name,
        job.category,
        ...(job.skills || []),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function getMockJobById(id) {
  const job = MOCK_JOBS.find((j) => j.id === id) || null;
  if (!job) return null;
  return applyStatusMap([job], normalizeJobStatus)[0];
}

export { normalizeJobStatus };
