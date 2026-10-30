import { Link } from "react-router-dom";

import { ShieldCheck } from "lucide-react";

import InfoLayout from "./InfoLayout";

import { useAccount } from "../../lib/account";

import {
  CONTACT_EMAIL,
  OPERATOR_NAME,
  PRIVACY_UPDATED,
} from "../../config/legal";


// =========================================================
// PRIVACY NOTICE (Malaysia PDPA 2010) + rules of use
// Each paragraph is one piece of text so it can be translated.
// =========================================================

const PRIVACY_SECTIONS = [
  {
    title: "Who we are",
    points: [
      "CampusMate is a web app for classes, assignments, attendance and projects. It is run by the operator named below.",
      "When your school creates your account, your school also decides how CampusMate is used in your classes.",
    ],
  },
  {
    title: "What we collect",
    points: [
      "Account details: your name, email, CampusMate ID, matric number and programme.",
      "Class work: hand-ins, files you upload, marks, feedback, quiz answers and attendance records.",
      "Things you post: chat messages, questions and answers, and group project updates.",
      "Absence excuses and any medical certificate (MC) you upload. Only your teachers can see them.",
      "Technical data needed to keep you signed in and to send you notifications.",
      "Fingerprint and face sign-in: CampusMate never receives your fingerprint or face. They stay on your device. We only keep a passkey that cannot be turned back into them.",
    ],
  },
  {
    title: "Why we use it",
    points: [
      "To run your classes: assignments, marks, attendance, quizzes and messages.",
      "To send you notifications about your classes.",
      "To keep your account and your school's data secure.",
      "We do not sell your data and we do not use it for advertising.",
    ],
  },
  {
    title: "Who can see it",
    points: [
      "Your teachers (professors, co-lecturers and tutors) see your work, marks, attendance and excuses for their classes.",
      "Classmates see your name, photo and what you post in a class. They never see your marks, attendance or excuses.",
      "Your school admin can see and manage the accounts in your school.",
      "Our service providers store and send data for us: Supabase (database, files and sign-in) and Brevo (emails).",
    ],
  },
  {
    title: "Where it is stored and for how long",
    points: [
      "Your data is stored by Supabase and may be kept on servers outside Malaysia. It is protected with encryption and access rules.",
      "We keep your data while your account is active. When your account is deleted, your data is removed within 30 days, unless the law requires us to keep it.",
    ],
  },
  {
    title: "Your rights",
    points: [
      "You can ask to see the personal data we hold about you, ask us to correct it, or ask us to delete your account.",
      "You can withdraw your agreement at any time, but you will then not be able to use CampusMate.",
      "To make a request, use Report a problem on the Help page (choose Privacy or my data) or email us.",
    ],
  },
  {
    title: "Under 18",
    points: [
      "If you are under 18, your school or your parent or guardian should agree to this notice for you.",
    ],
  },
  {
    title: "Browser storage",
    points: [
      "CampusMate keeps small settings in your browser, such as your language and whether you closed a tip. We do not use advertising cookies.",
    ],
  },
  {
    title: "Rules of use",
    points: [
      "Use only your own account and keep your password private.",
      "Only upload work and files you have the right to share.",
      "Be respectful in chats, Q&A and group projects.",
      "Do not try to see or change other people's data.",
    ],
  },
  {
    title: "Changes to this notice",
    points: [
      "If we change this notice, we will ask you to agree again the next time you sign in.",
    ],
  },
];


function Privacy() {
  const account = useAccount();

  return (
    <InfoLayout account={account}>
      <article className="info-article">
        <div className="info-hero">
          <span className="info-hero-icon"><ShieldCheck size={26} aria-hidden="true" /></span>
          <div>
            <h1>Privacy Notice</h1>
            <p>How CampusMate uses your personal data, under Malaysia's Personal Data Protection Act 2010 (PDPA).</p>
            <small>
              <span>Last updated:</span> <span data-no-translate>{PRIVACY_UPDATED}</span>
            </small>
          </div>
        </div>

        {PRIVACY_SECTIONS.map((section) => (
          <section key={section.title} className="info-section">
            <h2>{section.title}</h2>
            <ul>
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="info-section">
          <h2>Contact</h2>
          <p>
            <span>Operator:</span> <strong data-no-translate>{OPERATOR_NAME}</strong>
          </p>
          <p>
            <span>Email:</span>{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} data-no-translate>{CONTACT_EMAIL}</a>
          </p>
          <p>
            <Link to="/help#report">Report a problem</Link>
          </p>
        </section>
      </article>
    </InfoLayout>
  );
}

export default Privacy;
