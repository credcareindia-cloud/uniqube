import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const HERO = [
  { src: '/os/villa.jpg', alt: 'A completed residence with full-height glazing' },
  { src: '/os/modern.jpg', alt: 'A modern unitized building' },
  { src: '/os/house.jpg', alt: 'A factory-built home' },
  { src: '/os/white.jpg', alt: 'A light-filled completed interior' },
]

const APPLICATIONS = [
  {
    title: 'Residential',
    body: 'Homes planned around the owner. Layouts, finishes, and fixtures are selected from more than 40 modules, then manufactured for assembly on site within a three to six month programme.',
    image: '/os/villa.jpg',
  },
  {
    title: 'Retail',
    body: 'Retail units with a controlled factory finish and a short installation period, so a store can open without a prolonged site build.',
    image: '/os/modern.jpg',
  },
  {
    title: 'Hospitality and commercial',
    body: 'Hotels, offices, and mixed-use buildings delivered as repeatable, unitized assemblies. Wyndham Garden and Zim Cyber City were completed on this system.',
    image: '/os/white.jpg',
  },
  {
    title: 'Data centres',
    body: 'Technical buildings for processing and storage, fabricated for rapid deployment and a consistent, weather-resistant envelope.',
    image: '/os/house.jpg',
  },
]

const PODS = [
  { title: 'Kitchen pods', body: 'Finished kitchens with fittings and services installed before delivery.' },
  { title: 'Bathroom pods', body: 'Waterproofed and plumbed in the factory, ready to set into place.' },
  { title: 'Laundry pods', body: 'Service rooms manufactured as a single unit, with mechanical and electrical work complete.' },
  { title: 'Custom pods', body: 'A pod produced to the project drawings, under the same factory controls.' },
]

const PROJECTS = [
  { name: 'Wyndham Garden', type: 'Hotel' },
  { name: 'Lafayette House', type: 'Residential' },
  { name: 'Las Vegas House', type: 'Residential' },
  { name: 'Morton Grove', type: 'Residential' },
  { name: 'Zim Cyber City', type: 'Commercial' },
  { name: 'Tiny Home', type: 'Residential' },
]

const STEPS = [
  ['01', 'BIM engineering and design', 'The building is selected and adjusted to the brief, the site, and the budget.'],
  ['02', 'Prefabrication', 'Approximately 70% of the build, including walls, windows, and pods, is manufactured in the factory.'],
  ['03', 'Site preparation', 'Foundations and services proceed while fabrication is underway.'],
  ['04', 'Transportation', 'Components are packed, labelled, and delivered to site.'],
  ['05', 'On-site assembly', 'Walls, floors, ceilings, and windows are installed as a unitized system.'],
  ['06', 'Completion', 'Interiors, fixtures, and utilities are finished.'],
  ['07', 'Quality assurance and handover', 'The building is inspected and handed over ready for occupation.'],
]

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) return
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % HERO.length), 5500)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="h-screen overflow-y-auto bg-white text-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 sm:px-8 h-16 bg-white border-b border-slate-200">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/UniQube_Logo.png" alt="UNIQUBE" className="h-11 w-auto object-contain" />
        </Link>
        <nav className="hidden lg:flex items-center gap-6 text-sm text-slate-600">
          <a href="#about" className="hover:text-slate-900">About</a>
          <a href="#buildings" className="hover:text-slate-900">Buildings</a>
          <a href="#pods" className="hover:text-slate-900">Pods</a>
          <a href="#projects" className="hover:text-slate-900">Projects</a>
          <a href="#process" className="hover:text-slate-900">Process</a>
          <a href="#contact" className="hover:text-slate-900">Contact</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to={isAuthenticated ? '/projects' : '/login'} className="px-3 py-2 text-sm text-slate-700">
            {isAuthenticated ? 'Workspace' : 'Login'}
          </Link>
          <Link to="/quote" className="px-3.5 py-2 rounded-full bg-[#010127] text-white text-sm font-semibold">
            Get an estimate
          </Link>
        </div>
      </header>

      <section className="relative h-[calc(100dvh-4rem)] min-h-[560px] overflow-hidden bg-slate-200">
        {HERO.map((shot, index) => (
          <img
            key={shot.src}
            src={shot.src}
            alt={shot.alt}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${index === frame ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-black/10" />
        <div className="relative z-10 flex h-full items-end px-5 sm:px-10 pb-16">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-white/80">Unitized construction solutions</p>
            <h1 className="mt-4 text-4xl sm:text-6xl font-semibold leading-[1.05] text-white">A unitized building system that is 40% faster to build and 30% more cost-effective.</h1>
            <p className="mt-5 text-lg text-white/85 leading-relaxed max-w-xl">UniQube manufactures homes, hotels, retail, and commercial buildings, together with kitchen, bathroom, and laundry pods, for assembly on site.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/quote" className="px-5 py-3 rounded-full bg-white text-slate-950 font-semibold">Get an estimate</Link>
              <a href="#projects" className="px-5 py-3 rounded-full border border-white/40 text-white font-medium">Completed projects</a>
            </div>
          </div>
        </div>
        <div className="absolute z-10 bottom-6 right-6 sm:right-10 flex gap-2">
          {HERO.map((shot, index) => (
            <button
              key={shot.src}
              type="button"
              aria-label={`Show image ${index + 1}`}
              onClick={() => setFrame(index)}
              className={`h-1.5 rounded-full transition-all ${index === frame ? 'w-8 bg-white' : 'w-4 bg-white/50'}`}
            />
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4">
          {[
            ['40%', 'Faster to build'],
            ['30%', 'More cost-effective'],
            ['70%', 'Manufactured in the factory'],
            ['A+', 'Energy rating'],
          ].map(([n, label]) => (
            <div key={label} className="px-6 py-8 border-slate-200 border-t lg:border-t-0 lg:border-l first:border-0">
              <p className="text-3xl font-semibold text-slate-950">{n}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-500">About</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold leading-tight text-slate-950">The future of building, manufactured in Sharjah.</h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            UniQube is a unitized building system. Walls, ceilings, floors, and windows are pre-assembled in the factory, and approximately 70% of the building is complete before it reaches site. The result is a shorter programme, consistent workmanship, and a lower cost of construction.
          </p>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Structures are light-gauge steel. Insulation is Rockwool. Cladding is fire-rated. Clients choose from more than 40 modules and hundreds of components, including windows, doors, thermal and acoustic insulation, and an integrated smart-home system.
          </p>
        </div>
        <img src="/os/beams.jpg" alt="Light-gauge steel prepared for fabrication" className="w-full h-80 object-cover" />
      </section>

      <section id="buildings" className="bg-slate-50 py-20 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-500">Buildings</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">Prebuilt units, delivered to site.</h2>
          <div className="mt-10 grid md:grid-cols-2 gap-8">
            {APPLICATIONS.map((item) => (
              <article key={item.title} className="bg-white border border-slate-200">
                <img src={item.image} alt="" className="h-52 w-full object-cover" />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pods" className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-500">Pods</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Factory-built pods for kitchens, bathrooms, and laundry.</h2>
            <p className="mt-4 text-slate-600 leading-relaxed">Each pod is manufactured with mechanical, electrical, and plumbing services already fitted. Quality is held in the factory, and installation on site is a placement, not a fit-out.</p>
            <img src="/os/crane.jpg" alt="Building components prepared for delivery" className="mt-8 h-56 w-full object-cover" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {PODS.map((pod) => (
              <article key={pod.title} className="border border-slate-200 p-5 bg-white">
                <h3 className="font-semibold text-slate-950">{pod.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{pod.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="projects" className="bg-slate-50 border-y border-slate-200 py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-500">Portfolio</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">Signature projects completed and delivered.</h2>
          <p className="mt-3 max-w-2xl text-slate-600">Residential homes, a hotel, and commercial buildings, manufactured on the UniQube system and handed over ready for occupation.</p>
          <ul className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 bg-white border border-slate-200">
            {PROJECTS.map((project) => (
              <li key={project.name} className="px-6 py-7 border-b border-slate-200 sm:[&:nth-child(n+5)]:border-b-0 lg:[&:nth-child(n+4)]:border-b-0 lg:border-r lg:[&:nth-child(3n)]:border-r-0">
                <p className="text-xs uppercase tracking-wide text-slate-500">{project.type}</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{project.name}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="process" className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-500">Delivery</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">From design to handover.</h2>
        <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map(([n, title, body]) => (
            <li key={n}>
              <p className="text-sm font-semibold text-slate-400">{n}</p>
              <h3 className="mt-2 font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-semibold text-slate-950">Ready to start a project.</h2>
            <p className="mt-4 text-slate-600 leading-relaxed">Upload the floor plans for an accurate estimate within 24 hours. Where a model already exists, include the IFC. A UniQube programme is 40% faster than a conventional build.</p>
          </div>
          <div>
            <Link to="/quote" className="inline-flex px-5 py-3 rounded-full bg-[#010127] text-white font-semibold">Request an estimate</Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <h2 className="text-3xl font-semibold text-slate-950">Questions</h2>
        <div className="mt-8 grid md:grid-cols-2 gap-x-12 gap-y-8 text-sm">
          <div>
            <h3 className="font-semibold text-slate-950">What is UniQube?</h3>
            <p className="mt-2 text-slate-600 leading-relaxed">UniQube is a modular building system for homes and commercial buildings. Walls, ceilings, and windows are pre-assembled, which reduces site labour and construction time.</p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-950">How does it differ from traditional construction?</h3>
            <p className="mt-2 text-slate-600 leading-relaxed">About 70% of the building is completed in a controlled factory. Construction is faster, quality is consistent, and the structure uses light-gauge steel with Rockwool insulation.</p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-950">Can a building be customized?</h3>
            <p className="mt-2 text-slate-600 leading-relaxed">Yes. Layouts, finishes, and fixtures are selected to the brief, from more than 40 modules and hundreds of components.</p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-950">What is the construction period?</h3>
            <p className="mt-2 text-slate-600 leading-relaxed">Most of the work is finished before delivery. Depending on the project, on-site assembly is measured in weeks rather than months. Residential programmes are typically three to six months.</p>
          </div>
        </div>
      </section>

      <footer id="contact" className="border-t border-slate-200 bg-white px-5 sm:px-8 py-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-8">
          <div>
            <img src="/UniQube_Logo.png" alt="UNIQUBE" className="h-12 w-auto object-contain" />
            <p className="mt-3 text-sm text-slate-600">Hamriyah Free Zone, Phase 1<br />Sharjah, United Arab Emirates</p>
          </div>
          <div className="text-sm text-slate-700 space-y-1">
            <p><a href="tel:+97165262202">+971 6 526 2202</a></p>
            <p><a href="mailto:sales@uniqube.co">sales@uniqube.co</a></p>
          </div>
          <div className="flex gap-4 text-sm text-slate-600">
            <Link to="/login" className="hover:text-slate-950">Login</Link>
            <Link to="/quote" className="hover:text-slate-950">Get an estimate</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
