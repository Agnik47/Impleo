import StoryLayout from './layouts/StoryLayout.jsx';
import {
  HeroJourney,
  PainOfApplications,
  ChameleonDiscovery,
  ExtractionPipeline,
  ReviewLayer,
  PrivacyArchitecture,
  ProviderSelection,
  SuccessCelebration,
  FinalCTA,
} from './sections/index.js';

/*
 * The Impleo story, in order. App is deliberately nothing but the running
 * order — every beat owns its own scenery, motion and mascot state, and
 * StoryLayout owns everything that has to outlive a single beat (Lenis, the
 * mascot journey, nav, rail, footer).
 *
 * The narrative arc, per docs/UPDATED_DESIGN_MD.md:
 *   chaos → discovery → adaptation → review → privacy → success
 * and the mascot walks it: sleeping → discovering → filling → approving →
 * protecting → celebrating.
 *
 * Section order is load-bearing: it must stay in sync with SECTIONS in
 * lib/constants.js, which drives the nav, the chapter rail, and the mascot.
 */
export default function App() {
  return (
    <StoryLayout>
      <HeroJourney />
      <PainOfApplications />
      <ChameleonDiscovery />
      <ExtractionPipeline />
      <ReviewLayer />
      <PrivacyArchitecture />
      <ProviderSelection />
      <SuccessCelebration />
      <FinalCTA />
    </StoryLayout>
  );
}
