/**
 * Verbatim trust & legal copy rendered in the fourth accordion of the
 * settings dashboard. Kept as data so the component stays readable and the
 * wording can be diffed against the source policy text.
 */
export interface LegalClause {
  n: number;
  heading: string;
  body: string;
}

export interface LegalBox {
  id: string;
  title: string;
  tag: string;
  clauses: LegalClause[];
}

export const LEGAL_BOXES: LegalBox[] = [
  {
    id: "terms",
    title: "Terms of Service",
    tag: "[TERMS OF SERVICE]",
    clauses: [
      {
        n: 1,
        heading: "Acceptance of Terms",
        body: "By accessing or using Manthan and the Manthan STEM Labs, you agree to follow and be bound by these Terms of Service. If you do not agree, please do not use our platform.",
      },
      {
        n: 2,
        heading: "Purpose of the Platform",
        body: "Manthan is a learning tool designed to provide distilled study materials and interactive science simulations. The simulations, 3D models, and calculations are provided for educational review and revision. They are intended to support, not replace, formal instruction from certified teachers or textbooks.",
      },
      {
        n: 3,
        heading: "User Accounts",
        body: "You are responsible for keeping your account password secure. You agree to provide accurate information when updating your profile details. Manthan reserves the right to suspend accounts that engage in platform abuse, reverse engineering, or data scraping.",
      },
      {
        n: 4,
        heading: "Intellectual Property",
        body: "All software, custom 3D engines, visual sandboxes, interactive code, graphics, and distilled texts are the exclusive property of Manthan and its creators. You may not copy, redistribute, or resell any part of the STEM Lab without explicit written permission.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    tag: "[PRIVACY POLICY]",
    clauses: [
      {
        n: 1,
        heading: "Data We Collect",
        body: "We believe in minimal data tracking to protect student privacy. We only collect profile information (display name, email, credentials), user preferences (theme, accessibility selections), and progress sync targets from lab sandboxes.",
      },
      {
        n: 2,
        heading: "How We Use Data",
        body: "Your data is exclusively used to personalize your lab dashboard, keep your account secure, and render simulations smoothly based on your device preferences.",
      },
      {
        n: 3,
        heading: "Data Protection & Sharing",
        body: "We never sell, rent, or trade student data to third-party advertising companies. Your passwords are fully encrypted and hidden.",
      },
      {
        n: 4,
        heading: "Your Rights & Control",
        body: 'You have absolute ownership of your information. Using your dashboard settings panel, you can instantly export your entire progress log or choose to permanently erase your account and all associated metrics via the "Delete My Account" button.',
      },
    ],
  },
  {
    id: "honor",
    title: "Academic Honor & Fair Use Policy",
    tag: "[ACADEMIC HONOR & FAIR USE POLICY]",
    clauses: [
      {
        n: 1,
        heading: "Academic Integrity First",
        body: "Manthan STEM Labs are built to build genuine conceptual understanding, curiosity, and visual intuition in physics, chemistry, and biology.",
      },
      {
        n: 2,
        heading: "Permitted Use",
        body: "Allowed behaviors include using the labs to study for exams, testing formulas, adjusting variables to see results, using 'Exam Sketch Mode' to learn how to draw diagrams by hand, and practicing quizzes. Prohibited behaviors include utilizing live sandbox engines to feed answers or cheat during active, monitored school examinations where external aids are banned.",
      },
      {
        n: 3,
        heading: "Accuracy Disclaimer",
        body: "While we strive for high medical and mathematical accuracy across our interactive tools, simulations may occasionally simplify complex physics variables or molecular limits for performance reasons. Always cross-verify critical data points with your official school syllabus.",
      },
    ],
  },
];
