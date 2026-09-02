// The single profile every fixture is graded against.
//
// Deliberately a real-shaped profile, not a minimal one: thin profiles produce
// generic answers, so a thin fixture would make the eval score look fine while
// hiding the exact failure mode we're trying to measure. It has specific,
// checkable particulars — named projects, real numbers, a named city — because
// several assertions work by checking whether an answer actually USED one of
// them (specificity) or invented one that isn't here (fabrication).
//
// The writing sample is deliberately written in a distinctive voice: short
// sentences, contractions, concrete openers, no throat-clearing. If a generated
// answer opens with "I am deeply passionate about leveraging technology to..."
// then voice matching has failed, and it should be visible in the score.
//
// None of this describes a real person. If you swap in your own profile for a
// local run, do not commit it.

export const TEST_PROFILE = {
  personal: {
    name: 'Riya Menon',
    firstName: 'Riya',
    lastName: 'Menon',
    email: 'riya.menon.dev@example.com',
    phone: '+91 98200 41773',
    location: 'Pune, Maharashtra',
  },
  links: {
    linkedin: 'https://linkedin.com/in/riyamenon-dev',
    github: 'https://github.com/riyamenon',
    portfolio: 'https://riyamenon.dev',
  },
  education:
    'B.E. Computer Engineering, Pune Institute of Computer Technology, 2022-2026 (currently final year). CGPA 8.7.',
  skills: ['Python', 'React', 'PostgreSQL', 'FastAPI', 'Docker', 'PyTorch'],
  interests: ['accessibility tooling', 'public transit data', 'open source', 'competitive programming'],
  goals:
    'I want to work on developer tools or civic tech — software where the user is someone technical trying to get unstuck, or someone who needs a public service to actually work. Long term I want to be the person who owns a system end to end rather than a slice of it.',
  projects: [
    {
      name: 'PMPML Live',
      description:
        'An unofficial live-tracking web app for Pune city buses, built after the official app stopped reporting arrival times. Scrapes the transit authority GTFS feed, corrects for stale GPS pings, and serves a map.',
      techStack: 'FastAPI, PostgreSQL, React, Leaflet',
      impact:
        'Around 4,200 monthly active users as of March 2026. Cut my own commute wait time enough that three of my classmates started using it before I told anyone about it.',
    },
    {
      name: 'altex',
      description:
        'A CLI that audits a static site for missing or useless alt text and suggests replacements from surrounding page context. Written after volunteering at a screen-reader testing session.',
      techStack: 'Python, BeautifulSoup, PyTorch',
      impact:
        '340 GitHub stars. Adopted into the CI pipeline of two Indian government department sites.',
    },
  ],
  achievements: [
    'Winner, Smart India Hackathon 2025 (transit accessibility track), team of 6',
    'Google Summer of Code 2025 contributor with the OpenStreetMap Foundation',
    'Taught a 4-week intro-to-Python evening class for 30 non-CS students at my college',
  ],
  resumeText: [
    'RIYA MENON — Pune, Maharashtra — riya.menon.dev@example.com',
    '',
    'EDUCATION',
    'Pune Institute of Computer Technology, B.E. Computer Engineering, 2022-2026. CGPA 8.7.',
    '',
    'EXPERIENCE',
    'Backend Engineering Intern, Zerodha (Bengaluru, remote) — May 2025 to July 2025.',
    'Worked on the internal order-reconciliation service. Rewrote a nightly batch job that',
    'compared broker statements against internal ledgers; it had been taking 6 hours and',
    'occasionally timing out. Moved it from row-by-row Python to a set-based SQL approach',
    'and got it to 22 minutes. Wrote the first integration tests that service had.',
    '',
    'Open Source Contributor, OpenStreetMap Foundation — Google Summer of Code, 2025.',
    'Built a validation tool for public-transit relation data that flagged broken route',
    'geometry before it reached the main map. Merged after 4 rounds of review.',
    '',
    'PROJECTS',
    'PMPML Live — live bus tracking for Pune, ~4,200 MAU. FastAPI, PostgreSQL, React.',
    'altex — alt-text auditing CLI, 340 stars, used in two government site CI pipelines.',
    '',
    'SKILLS',
    'Python, React, PostgreSQL, FastAPI, Docker, PyTorch, Git, Linux.',
  ].join('\n'),
  writingSampleText: [
    "I didn't set out to build a bus tracker. I set out to stop missing the 8:05.",
    '',
    'The official PMPML app had quietly stopped showing arrival times sometime in 2024 —',
    "the buttons were all still there, they just returned nothing. I assumed it was me.",
    'It was not me. The GTFS feed was still publishing, the app had just stopped reading it.',
    '',
    'So I read it instead. The hard part turned out to have nothing to do with maps. Buses',
    'go under flyovers and their GPS pings go stale, so a bus that has not moved in four',
    'minutes looks identical to a bus that is parked. I ended up guessing forward from the',
    "last known speed, which is less rigorous than I'd like and works better than it should.",
    '',
    'What I did not expect was other people using it. I never posted about it. Three',
    'classmates found it because they saw my phone.',
  ].join('\n'),
};

// Values a generated answer may legitimately contain. Used by the
// specificity/fabrication assertions to tell "grounded in the profile" apart
// from "invented". Kept next to the profile so the two cannot drift.
export const PROFILE_PARTICULARS = [
  'PMPML',
  'altex',
  'Zerodha',
  'OpenStreetMap',
  'Pune',
  'Smart India Hackathon',
  'Google Summer of Code',
  'GSoC',
  '4,200',
  '4200',
  '340',
  '22 minutes',
  '6 hours',
  '8.7',
];
