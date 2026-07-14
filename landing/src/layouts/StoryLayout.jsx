import { SmoothScrollProvider } from '../providers/SmoothScrollProvider.jsx';
import { MascotProvider } from '../providers/MascotProvider.jsx';
import Nav from '../components/Nav.jsx';
import Footer from '../components/Footer.jsx';
import PersistentMascot from '../components/PersistentMascot.jsx';
import StoryRail from '../components/StoryRail.jsx';

/*
 * The shell every story beat renders inside. It owns the three things that must
 * outlive any single section:
 *
 *   SmoothScrollProvider — the one Lenis instance, wired to ScrollTrigger.
 *                          Must be outermost: Nav and StoryRail call scrollTo().
 *   MascotProvider       — the chameleon's journey state, set by each section
 *                          as it takes the viewport.
 *   PersistentMascot     — the companion itself, fixed above the sections so it
 *                          survives scrolling between them.
 *
 * Keeping these here (not in App) means App stays a readable list of beats.
 */
export default function StoryLayout({ children }) {
  return (
    <SmoothScrollProvider>
      <MascotProvider>
        {/* Skip link: the story is a long scroll and the rail/nav sit ahead of
            the content in tab order. */}
        <a
          href="#hero"
          className="sr-only rounded-btn bg-brand px-4 py-2 text-[14px] font-semibold text-surface-bg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
        >
          Skip to content
        </a>

        <Nav />
        <StoryRail />
        <PersistentMascot />

        {/* Deliberately NOT a clipping container. ScrollTrigger pins the
            pipeline section with position:fixed, and a clip/hidden ancestor
            here can crop it. Sideways overflow is already handled where it
            belongs: `body { overflow-x: hidden }` in index.css, plus
            overflow-hidden on the individual sections that hold parallax
            scenery. */}
        <main id="story" className="relative">
          {children}
        </main>

        <Footer />
      </MascotProvider>
    </SmoothScrollProvider>
  );
}
