import { Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import termsMd from '../content/legal/terms.md?raw';
import privacyMd from '../content/legal/privacy.md?raw';
import guidelinesMd from '../content/legal/community-guidelines.md?raw';

const DOCUMENTS = {
  terms: { title: 'Terms of Service', markdown: termsMd },
  privacy: { title: 'Privacy Policy', markdown: privacyMd },
  guidelines: { title: 'Community Guidelines', markdown: guidelinesMd },
} as const;

type LegalSlug = keyof typeof DOCUMENTS;

function documentFromPath(pathname: string): LegalSlug {
  if (pathname.endsWith('/privacy')) {
    return 'privacy';
  }
  if (pathname.endsWith('/guidelines')) {
    return 'guidelines';
  }
  return 'terms';
}

/**
 * Purpose: render crawlable hobby-community legal copy inside the pit-mat shell without a second site.
 */
export function LegalDocumentView() {
  const { pathname } = useLocation();
  const slug = documentFromPath(pathname);
  const doc = DOCUMENTS[slug];

  return (
    <article className="border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-hazard-orange">
        Pit-mat legal
      </p>
      <h1 className="mt-2 font-display text-3xl uppercase tracking-wide text-hazard-orange">
        {doc.title}
      </h1>
      <nav className="mt-4 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">
        <Link className="hover:text-hazard-orange" to="/legal/terms">
          Terms
        </Link>
        <Link className="hover:text-hazard-orange" to="/legal/privacy">
          Privacy
        </Link>
        <Link className="hover:text-hazard-orange" to="/legal/guidelines">
          Guidelines
        </Link>
      </nav>
      <div className="legal-markdown mt-6 space-y-4 font-sans text-sm leading-relaxed text-readout-dim [&_a]:text-hazard-orange [&_a]:underline [&_h1]:hidden [&_h2]:font-display [&_h2]:text-lg [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-readout-bright [&_li]:ml-4 [&_p]:text-readout-dim [&_ul]:list-disc [&_ul]:space-y-1">
        <ReactMarkdown>{doc.markdown}</ReactMarkdown>
      </div>
    </article>
  );
}
