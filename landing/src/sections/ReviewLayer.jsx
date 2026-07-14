import { useEffect, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Container, Section, Heading, Lead, Eyebrow } from '../components/primitives.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import ApprovalCheck from '../components/ApprovalCheck.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { revealChildren } from '../animations/storyReveal.js';
import { cn } from '../lib/utils.js';

/*
 * Beat 5 — The Review Layer. The product's whole thesis: the AI drafts, the
 * human decides, and nothing reaches the page until it's approved.
 *
 * So the approval is the animation. Scrolling into the beat walks the four
 * actions in one at a time and flips the card to Accepted — the reader
 * performs the review by reading. Reverses on scroll-back.
 */
const ACTIONS = [
  ['Accept as-is', 'The draft is good. Take it.'],
  ['Edit inline', 'Fix a phrase without leaving the panel.'],
  ['Regenerate with an instruction', '“Make it shorter, mention the robotics team.”'],
  ['Skip entirely', 'Leave the field untouched. It stays blank.'],
];

export default function ReviewLayer() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(-1);

  // No GSAP under reduced motion → nothing would ever advance the walk, so show
  // the completed, approved state instead of an empty checklist.
  useEffect(() => {
    if (reduced) setStep(ACTIONS.length);
  }, [reduced]);

  const scope = useGsap((gsap, el) => {
    revealChildren(gsap, el);

    // One trigger per action rather than a timeline, so each check is pinned to
    // a real scroll position and reversing feels symmetric.
    ACTIONS.forEach((_, i) => {
      ScrollTrigger.create({
        trigger: el,
        start: `top ${58 - i * 8}%`,
        onEnter: () => setStep(i),
        onLeaveBack: () => setStep(i - 1),
      });
    });
  });

  useMascotSection(scope, 'approving');

  const accepted = step >= ACTIONS.length - 1;

  return (
    <Section ref={scope} id="review" className="bg-jungle py-28 md:py-36">
      <Container className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <div data-reveal>
            <Eyebrow>You stay in control</Eyebrow>
          </div>
          <Heading data-reveal className="mt-4">
            AI writes the draft. You own the decision.
          </Heading>
          <Lead data-reveal className="mt-5">
            Every generated answer lands in a review card with a confidence badge and four
            actions. Nothing touches the page until you say so — and the submit button is
            never touched at all, by design.
          </Lead>

          <ul className="mt-9 space-y-1">
            {ACTIONS.map(([title, body], i) => {
              const done = step >= i;
              return (
                <li
                  key={title}
                  className={cn(
                    'flex items-start gap-3.5 rounded-input px-3 py-3 transition-colors duration-300 ease-premium',
                    done ? 'bg-white/[0.03]' : 'bg-transparent'
                  )}
                >
                  <ApprovalCheck active={done} size="sm" className="mt-0.5 shrink-0" />
                  <div>
                    <p
                      className={cn(
                        'text-[15px] font-medium transition-colors duration-300',
                        done ? 'text-ink-primary' : 'text-ink-muted'
                      )}
                    >
                      {title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">{body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div data-reveal data-reveal-x="24">
          <ReviewCard
            question="Describe a project you're proud of."
            answer="I built an AI autofill copilot that reads application forms and drafts answers in the applicant's own voice — with a mandatory review step, so nothing is submitted without a human approving it. It cut my own application time from ~40 minutes to under one."
            confidence="medium"
            accepted={accepted}
          />
          <p className="mt-4 text-center text-[13px] text-ink-secondary">
            Impleo fills only what you approved. You press submit.
          </p>
        </div>
      </Container>
    </Section>
  );
}
