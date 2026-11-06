/**
 * Public front of the studio. The primary action opens the estimation software.
 * Photographs are Unsplash images stored with the app so the page does not depend on a remote host.
 */

const STEPS = [
  {
    n: '01',
    title: 'Upload the drawings',
    body: 'Plans go in as they are. The studio reads walls, rooms and the footprint, and keeps the sheet next to the takeoff.',
  },
  {
    n: '02',
    title: 'Run foundation and structure',
    body: 'One pass classifies load-bearing walls and quantities the foundation. The next builds the light-gauge steel: studs, floors, roof, anchors and rods.',
  },
  {
    n: '03',
    title: 'Review, then issue',
    body: 'Anything the rules cannot close stays flagged. An engineer approves the gate, and the bill of quantities is ready for the offer.',
  },
]

const SCOPE = [
  {
    image: '/landing/steel.jpg',
    title: 'Foundation',
    body: 'Strip footings, pads, ground beams and the concrete and rebar that go with the wall classes. Sizes stay on the section schedule you set.',
  },
  {
    image: '/landing/white.jpg',
    title: 'Walls, floors and roof',
    body: 'Light-gauge runs per level, floor trusses or C-joists, a flat or pitched roof, parapets and balconies. Heights come from the sections, never from a guess.',
  },
  {
    image: '/landing/crane.jpg',
    title: 'Anchors, rods and hot-rolled steel',
    body: 'Holding-down anchors and threaded rods are counted. Beams the span needs are suggested, and you accept them with a real section before they enter the weight.',
  },
]

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="land">
      <header className="land__bar">
        <img src="/UniQube_Logo.png" alt="UNIQUBE" />
        <nav>
          <a href="#how">How it works</a>
          <a href="#scope">What you get</a>
          <button type="button" className="land__text" onClick={onEnter}>
            Sign in
          </button>
          <button type="button" className="land__cta" onClick={onEnter}>
            Get an estimation
          </button>
        </nav>
      </header>

      <section className="land__hero">
        <img src="/landing/villa.jpg" alt="A modern villa with a pool and full-height glazing" />
        <div className="land__hero-shade" />
        <div className="land__hero-copy">
          <p className="land__kicker">Estimation studio</p>
          <h1>Get an estimation in a minute.</h1>
          <p>From the drawings to a foundation and light-gauge steel takeoff. Walls, floors, roof, anchors and hot-rolled steel, ready for an engineer to issue.</p>
          <div className="land__hero-actions">
            <button type="button" className="land__cta land__cta--lg" onClick={onEnter}>
              Get an estimation
            </button>
            <a className="land__link" href="#how">
              See how the minute is spent
            </a>
          </div>
        </div>
      </section>

      <section className="land__steps" id="how">
        <header>
          <p className="land__kicker">Three steps</p>
          <h2>The drawings go in. The quantities come out.</h2>
        </header>
        <ol>
          {STEPS.map((step) => (
            <li key={step.n}>
              <span>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="land__scope" id="scope">
        <header>
          <p className="land__kicker">What the run covers</p>
          <h2>Foundation and superstructure, on the same plans.</h2>
        </header>
        <div className="land__cards">
          {SCOPE.map((card) => (
            <article key={card.title}>
              <img src={card.image} alt="" />
              <div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="land__gallery" aria-label="Buildings the studio is built for">
        <figure>
          <img src="/landing/house.jpg" alt="A single-storey pavilion opening onto a pool" />
          <figcaption>Villas and staff buildings, read from the plans.</figcaption>
        </figure>
        <figure>
          <img src="/landing/modern.jpg" alt="A contemporary house lit at dusk" />
          <figcaption>Levels, floor zones and the roof above them.</figcaption>
        </figure>
        <figure className="land__gallery-wide">
          <img src="/landing/beams.jpg" alt="Tower cranes over a building under construction" />
          <figcaption>From the first footing to the steel that lands on it.</figcaption>
        </figure>
      </section>

      <section className="land__close">
        <img src="/landing/villa.jpg" alt="" />
        <div>
          <h2>Open the studio and start the estimate.</h2>
          <p>Sign in, open a project, and run the foundation and structure engines on the drawings you already have.</p>
          <button type="button" className="land__cta land__cta--lg" onClick={onEnter}>
            Get an estimation
          </button>
        </div>
      </section>

      <footer className="land__foot">
        <img src="/UniQube_Logo.png" alt="" />
        <span>UNIQUBE estimation studio</span>
        <button type="button" className="land__text" onClick={onEnter}>
          Sign in
        </button>
      </footer>
    </div>
  )
}
