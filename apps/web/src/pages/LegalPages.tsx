// apps/web/src/pages/LegalPages.tsx
/**
 * Terms of use and the privacy policy, in plain language, written from how SpeakBetter actually works (what it
 * stores, which outside services see what). The operator, contact and country come from lib/legal.ts.
 * These are a starting point, not legal advice: have them checked before launch.
 */

import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteFooter, SiteNav } from "../components/landing/SiteChrome";
import { LEGAL } from "../lib/legal";

const Contact: React.FC = () =>
  LEGAL.contactEmail ? (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-indigo-700 underline dark:text-indigo-300">
      {LEGAL.contactEmail}
    </a>
  ) : (
    <span>the contact address we publish on this page</span>
  );

const LegalLayout: React.FC<{ title: string; intro: string; sections: Array<{ id: string; title: string; body: React.ReactNode }> }> = ({ title, intro, sections }) => {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · SpeakBetter`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="min-h-dvh bg-page text-slate-900 dark:text-white">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <header className="max-w-3xl border-b border-line pb-8">
          <p className="t-eyebrow text-indigo-700 dark:text-indigo-300">Last updated {LEGAL.updated}</p>
          <h1 className="mt-3 text-[38px] leading-tight sm:text-[52px]">{title}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-600 dark:text-slate-300">{intro}</p>
        </header>
        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="On this page" className="hidden lg:block">
            <ol className="sticky top-24 space-y-1.5 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="max-w-3xl space-y-10 text-[15.5px] leading-relaxed text-slate-700 dark:text-slate-300 [&_li]:mt-1.5 [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_p+p]:mt-3">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {i + 1}. {s.title}
                </h2>
                <div className="mt-3">{s.body}</div>
              </section>
            ))}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

// ============================================================
// Privacy
// ============================================================

export const PrivacyPage: React.FC = () => (
  <LegalLayout
    title="Privacy"
    intro="What SpeakBetter keeps about you, why, who else sees it, and how to have it removed. We don't sell your data and we don't show ads."
    sections={[
      {
        id: "who",
        title: "Who we are",
        body: (
          <p>
            SpeakBetter is run by {LEGAL.operator}. For any question about your data, write to <Contact />.
          </p>
        ),
      },
      {
        id: "collect",
        title: "What we keep",
        body: (
          <>
            <ul>
              <li><strong>Your account:</strong> name, email address and password (stored only as a one-way hash). If you sign in with Google, your Google account id and photo.</li>
              <li><strong>Your profile:</strong> what you choose to add, such as your level, native language, interests, country, time zone and photo.</li>
              <li><strong>Your learning:</strong> XP, streaks, lessons, flashcards and how you answered them, saved words, writing pieces, test results, and pronunciation scores (the scores only, not the audio).</li>
              <li><strong>What you share:</strong> chat messages, voice messages and files you send, messages in voice rooms and communities, and your profile when others view it.</li>
              <li><strong>Safety:</strong> reports you make or that are made about you, blocks, and actions our moderators take.</li>
              <li><strong>Signing in:</strong> for each device you're signed in on, the browser name, IP address and when it was last used, so we can keep your account secure. You can see them, and sign any of them out, in Settings.</li>
              <li><strong>Payments:</strong> your plan, amounts and payment status. We don't store card numbers.</li>
              <li><strong>Notifications:</strong> if you turn on alerts, the push address your browser gives us.</li>
            </ul>
          </>
        ),
      },
      {
        id: "voice",
        title: "Your voice",
        body: (
          <ul>
            <li>Voice rooms and random calls are live. <strong>We don't record them.</strong></li>
            <li>When you practise pronunciation, your recording is checked <strong>on your own device</strong> and isn't uploaded. Only the score is saved.</li>
            <li>Voice messages you send in chat are uploaded so the people in that chat can hear them. If you turn them into text, that also happens on your device.</li>
          </ul>
        ),
      },
      {
        id: "use",
        title: "How we use it",
        body: (
          <ul>
            <li>To run the app: your account, rooms, chats, progress and reviews.</li>
            <li>To personalise practice: your level, daily plan and when cards come back for review (fitted to your own answers).</li>
            <li>To keep people safe: reviewing reports and acting on them.</li>
            <li>To send what you asked for: password-reset emails and the notifications you've switched on.</li>
            <li>To understand overall use (for example, how many people practised today), never to build an advertising profile.</li>
          </ul>
        ),
      },
      {
        id: "services",
        title: "Services that help us",
        body: (
          <>
            <p>A few outside services do part of the work. Each gets only what it needs:</p>
            <ul>
              <li><strong>LiveKit</strong> carries the live audio of voice rooms and calls.</li>
              <li><strong>Cloudinary</strong> stores photos, voice messages and files you upload.</li>
              <li><strong>Google</strong> signs you in, if you choose to sign in with Google.</li>
              <li><strong>LanguageTool</strong> receives the text you ask us to check in the writing studio.</li>
              <li><strong>MyMemory</strong> and <strong>dictionaryapi.dev</strong> receive single words or sentences you tap to translate or look up.</li>
              <li>Our <strong>email provider</strong> receives your address and the email when we send you one (such as a password reset).</li>
              <li>Your <strong>browser's push service</strong> (from Google, Apple, Mozilla or Microsoft) delivers notifications if you turn them on.</li>
            </ul>
            <p>If we add an AI conversation partner or live captions, the words you say to them will be sent to that provider to answer you. We'll update this page before that happens.</p>
          </>
        ),
      },
      {
        id: "visible",
        title: "What other people see",
        body: (
          <ul>
            <li>Your name and photo, in rooms, chats, leagues and on your profile.</li>
            <li>Your public profile (level, XP, badges, streak) unless you make it private in Settings; friends still see it.</li>
            <li>Whether you're online, unless you turn that off in Settings.</li>
            <li>Everything you say or post in a room, chat or community, to the people there.</li>
            <li>Never your email address, date of birth or time zone.</li>
          </ul>
        ),
      },
      {
        id: "storage",
        title: "Cookies and your device",
        body: (
          <p>
            We use only what the app needs to work: sign-in cookies that keep you signed in, and settings stored in your browser (your
            theme, your chosen translation language, lessons saved for offline). No advertising or tracking cookies.
          </p>
        ),
      },
      {
        id: "keep",
        title: "How long we keep it",
        body: (
          <ul>
            <li>Your account and learning data: while you have an account.</li>
            <li>Sign-ins: until they expire or you sign out. Password-reset links: 30 minutes.</li>
            <li>When an account is deleted, its data is deleted with it. We keep a short record of moderation actions (for example, that an account was removed and why) to keep the community safe.</li>
          </ul>
        ),
      },
      {
        id: "rights",
        title: "Your choices and rights",
        body: (
          <>
            <ul>
              <li>See and change your profile and privacy settings at any time in the app.</li>
              <li>Delete your account yourself at any time, in Settings. It's immediate and can't be undone.</li>
              <li>Ask us for a copy of your data, or to correct it: write to <Contact />. We reply within 30 days.</li>
              <li>Turn notifications off per device, or per kind, in Settings.</li>
            </ul>
            {LEGAL.country && <p>You can also complain to the data protection authority in your country, or in {LEGAL.country}.</p>}
          </>
        ),
      },
      {
        id: "age",
        title: "Age",
        body: (
          <p>
            SpeakBetter is for people aged {LEGAL.minimumAge} and over. If you're under 18, you need a parent's or guardian's permission.
            If we learn that someone younger is using it, we'll close the account.
          </p>
        ),
      },
      {
        id: "security",
        title: "Security",
        body: (
          <p>
            Passwords are hashed, sign-in tokens are short-lived, and reset links work once. Resetting your password signs out every other device. No system is
            perfectly secure; if something goes wrong that affects your data, we'll tell you.
          </p>
        ),
      },
      {
        id: "changes",
        title: "Changes",
        body: (
          <p>
            If we change this policy, we'll update the date at the top, and tell you in the app for anything important. See also our{" "}
            <Link to="/terms" className="font-semibold text-indigo-700 underline dark:text-indigo-300">Terms of use</Link>.
          </p>
        ),
      },
    ]}
  />
);

// ============================================================
// Terms
// ============================================================

export const TermsPage: React.FC = () => (
  <LegalLayout
    title="Terms of use"
    intro="The rules for using SpeakBetter, in plain words. By creating an account you agree to them."
    sections={[
      {
        id: "service",
        title: "The service",
        body: (
          <p>
            SpeakBetter is a place to practise English: live voice rooms and calls with other learners, lessons, reviews and tools. It's run by{" "}
            {LEGAL.operator}. We keep improving it, so features may change, and it may sometimes be unavailable.
          </p>
        ),
      },
      {
        id: "who",
        title: "Who can use it",
        body: (
          <p>
            You must be at least {LEGAL.minimumAge}. If you're under 18, you need a parent's or guardian's permission. One person per account;
            keep your password to yourself, and tell us if you think someone else has used your account.
          </p>
        ),
      },
      {
        id: "rules",
        title: "Community rules",
        body: (
          <>
            <p>Everyone here is learning, and speaking up takes courage. So:</p>
            <ul>
              <li><strong>Be kind and patient.</strong> Correct gently. Never mock someone's accent or mistakes.</li>
              <li><strong>No harassment, hate or threats,</strong> including about anyone's background, religion, gender, body or level of English.</li>
              <li><strong>No sexual content,</strong> and nothing sexual at all involving anyone under 18.</li>
              <li><strong>No spam, scams or selling,</strong> and no asking people for money or personal details.</li>
              <li><strong>Respect privacy.</strong> Don't record people in rooms or calls without their agreement, and don't share others' personal information.</li>
              <li><strong>Be yourself.</strong> Don't pretend to be someone else.</li>
            </ul>
          </>
        ),
      },
      {
        id: "moderation",
        title: "Reports and moderation",
        body: (
          <p>
            Anyone can report a person or a message. Our moderators review reports and may remove content, warn, suspend or close accounts that
            break these rules, sometimes without notice when people's safety is at risk. A suspended account can't sign in until the suspension
            ends. If you think we got it wrong, write to <Contact />.
          </p>
        ),
      },
      {
        id: "content",
        title: "What you post",
        body: (
          <p>
            What you say and share stays yours. You let us store it and show it to the people you shared it with, as needed to run SpeakBetter.
            You're responsible for what you post. Corrections from other learners are friendly help, not professional advice.
          </p>
        ),
      },
      {
        id: "pro",
        title: "Pro and payments",
        body: (
          <p>
            SpeakBetter is free to use. An optional Pro plan adds extras; its price and what it includes are shown in the app before you pay.
            Pro runs for the period you paid for and doesn't renew without you choosing to. Payment terms are shown at checkout.
          </p>
        ),
      },
      {
        id: "warranty",
        title: "No guarantees",
        body: (
          <p>
            We work hard to make SpeakBetter helpful, but we provide it as it is. We can't promise a particular result, such as an exam score,
            or that it will always be available or free of mistakes. As far as the law allows, we aren't responsible for indirect losses, or for
            what other users say or do.
          </p>
        ),
      },
      {
        id: "ending",
        title: "Leaving or closing an account",
        body: (
          <p>
            You can stop using SpeakBetter at any time and delete your account yourself in Settings. We may close accounts that
            break these terms. Parts of these terms that by their nature should continue (such as the limits above) still apply afterwards.
          </p>
        ),
      },
      {
        id: "law",
        title: "Changes, law and contact",
        body: (
          <p>
            If we change these terms, we'll update the date at the top and tell you in the app for anything important.
            {LEGAL.country ? ` These terms are governed by the laws of ${LEGAL.country}.` : ""} Questions: <Contact />. How we handle your data is
            in our <Link to="/privacy" className="font-semibold text-indigo-700 underline dark:text-indigo-300">privacy policy</Link>.
          </p>
        ),
      },
    ]}
  />
);
