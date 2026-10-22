import Link from "next/link";
import { Brand, Card } from "@/components/ui";
const colors = [
  ["Graphite", "#20232B"],
  ["Canvas", "#F8F9FB"],
  ["Surface", "#FFFFFF"],
  ["Cobalt", "#4165ED"],
  ["Mist", "#ECEFF6"],
  ["Sage", "#EDF3EF"],
];
export default function BrandPage() {
  return (
    <main className="brand-board">
      <header>
        <Brand />
        <Link href="/">Explore the app ↗</Link>
      </header>
      <span className="eyebrow">IDENTITY STUDY 01 · QUIET PRECISION</span>
      <h1>
        A little less
        <br />
        on your mind.
      </h1>
      <p>A considered identity for the things worth remembering.</p>
      <div className="brand-specimens">
        <Card className="light-specimen">
          <Brand />
          <span>THE WORDMARK · CLASSIC, CLEAR, CONFIDENT</span>
        </Card>
        <Card className="dark-specimen">
          <span className="icon-specimen">
            <Brand compact />
          </span>
          <span>THE APP ICON · A SINGLE, DISTINCTIVE GESTURE</span>
        </Card>
      </div>
      <section>
        <span className="eyebrow">01 / THE IDEA</span>
        <h2>Structure, with a human touch.</h2>
        <p>
          A geometric A with an ascending diagonal bridge. A quiet suggestion of
          momentum, built to stand alone. The voice action belongs to the
          product; the identity has room to grow.
        </p>
      </section>
      <section>
        <span className="eyebrow">02 / COLOR</span>
        <div className="swatch-grid">
          {colors.map(([label, color]) => (
            <div key={label}>
              <span style={{ background: color }} />
              <strong>{label}</strong>
              <code>{color}</code>
            </div>
          ))}
        </div>
      </section>
      <section className="type-specimen">
        <span className="eyebrow">03 / TYPOGRAPHY</span>
        <h2>
          Speak it. Confirm it.
          <br />
          Remember it.
        </h2>
        <p>
          System neo-grotesk. Thoughtful hierarchy. A little editorial warmth.
        </p>
        <blockquote>
          “Your mind is for having ideas, not holding them.”
        </blockquote>
      </section>
      <section>
        <span className="eyebrow">04 / FORM & FEEL</span>
        <div className="geometry-grid">
          <Card>
            <strong>4px</strong>
            <p>Spacing foundation</p>
          </Card>
          <Card>
            <strong>20px</strong>
            <p>Soft card radius</p>
          </Card>
          <Card>
            <strong>180ms</strong>
            <p>Quiet microinteractions</p>
          </Card>
        </div>
      </section>
      <footer>
        <Link href="/brand/argzel-mark.svg">Mark SVG ↗</Link>
        <Link href="/brand/argzel-wordmark.svg">Wordmark SVG ↗</Link>
        <Link href="/brand/argzel-icon.svg">App icon SVG ↗</Link>
      </footer>
    </main>
  );
}
