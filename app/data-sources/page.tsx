import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Sources & Attribution",
  description:
    "Where GTASearch business listings come from: the public open-data feeds published by City of Toronto, Toronto Public Health, City of Mississauga and City of Brampton, and the licence each is used under.",
  alternates: { canonical: "/data-sources" },
};

// Licence compliance, not decoration. The City of Mississauga Terms of Use
// require that anyone redistributing the data is given the Terms URL, and the
// Brampton feed is CC BY 4.0, which requires attribution. Both obligations are
// discharged here, and the page doubles as the evidence behind the homepage's
// "sourced from open data" claim.

interface Source {
  name: string;
  covers: string;
  what: string;
  licence: string;
  licenceUrl: string;
  portalUrl: string;
}

const SOURCES: Source[] = [
  {
    name: "City of Toronto — Business Licences and Permits",
    covers: "Toronto",
    what: "Restaurants and food premises, auto repair, driving schools, pet shops and second-hand shops.",
    licence: "Open Government Licence – Toronto",
    licenceUrl: "https://open.toronto.ca/open-data-license/",
    portalUrl:
      "https://open.toronto.ca/dataset/municipal-licensing-and-standards-business-licences-and-permits/",
  },
  {
    name: "Toronto Public Health — BodySafe",
    covers: "Toronto",
    what: "Hair salons, barbers, nail salons, esthetics, tattoo and piercing studios. Business name, address and service type only — inspection results are never published here.",
    licence: "Open Government Licence – Toronto",
    licenceUrl: "https://open.toronto.ca/open-data-license/",
    portalUrl: "https://open.toronto.ca/dataset/bodysafe/",
  },
  {
    name: "Toronto Public Health — ChildCareSafe",
    covers: "Toronto",
    what: "Licensed child care centres. Business name and address only — inspection results are never published here.",
    licence: "Open Government Licence – Toronto",
    licenceUrl: "https://open.toronto.ca/open-data-license/",
    portalUrl: "https://open.toronto.ca/dataset/childcaresafe-infection-control-inspection-results/",
  },
  {
    name: "City of Mississauga — 2025 Business Directory",
    covers: "Mississauga",
    what: "Businesses across every category, classified by NAICS industry code.",
    licence: "City of Mississauga Terms of Use",
    licenceUrl: "http://www5.mississauga.ca/research_catalogue/CityofMississauga_TermsofUse.pdf",
    portalUrl:
      "https://data.mississauga.ca/datasets/mississauga::2025-mississauga-business-directory",
  },
  {
    name: "City of Brampton — Business Directory",
    covers: "Brampton",
    what: "Businesses across every category, classified by NAICS industry code.",
    licence: "Creative Commons Attribution 4.0 (CC BY 4.0)",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    portalUrl: "https://geohub.brampton.ca/datasets/brampton::brampton-business-directory",
  },
  {
    name: "York Region — Business Directory (2024)",
    covers:
      "Markham, Vaughan, Richmond Hill, Newmarket, Aurora, Whitchurch-Stouffville, Georgina, East Gwillimbury and King",
    what: "Businesses across every category, classified by NAICS industry code.",
    licence: "York Region Open Data Licence",
    licenceUrl:
      "https://www.arcgis.com/sharing/rest/content/items/78cc02388af248c0b7a30eda6adfade0/data",
    portalUrl: "https://insights-york.opendata.arcgis.com/datasets/york::business-directory-2024",
  },
  {
    name: "Durham Region — Business Directory",
    covers: "Oshawa, Whitby, Ajax, Pickering, Clarington, Uxbridge, Scugog and Brock",
    what: "Businesses across every category, classified by NAICS industry code.",
    licence: "Durham Region Open Data Licence",
    licenceUrl: "https://opendata.durham.ca/pages/terms-of-use",
    portalUrl: "https://opendata.durham.ca/datasets/DurhamRegion::business-directory",
  },
];

// Credit statements these two licences ask for by name when credit is given.
const CREDIT_STATEMENTS = [
  "Contains public sector information made available under The Regional Municipality of York's Open Data Licence.",
  "Contains public sector information made available under The Regional Municipality of Durham's Open Data Licence.",
];

export default function DataSourcesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        Data sources &amp; attribution
      </h1>
      <p className="mt-4 text-sm text-ink-muted sm:text-base">
        GTASearch business listings are built from public open-data published by
        municipalities across the Greater Toronto Area. Every listing describes
        a real, publicly registered business. We do not invent listings, and we
        do not publish ratings or reviews that people did not write.
      </p>

      <ul className="mt-8 space-y-6">
        {SOURCES.map((s) => (
          <li key={s.name} className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-base font-bold text-ink">{s.name}</h2>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Covers {s.covers}
            </p>
            <p className="mt-2 text-sm text-ink-muted">{s.what}</p>
            <p className="mt-3 text-sm text-ink-muted">
              Licence:{" "}
              <a
                href={s.licenceUrl}
                className="font-medium text-brand hover:text-brand-dark"
                rel="nofollow noopener"
                target="_blank"
              >
                {s.licence}
              </a>
              {" · "}
              <a
                href={s.portalUrl}
                className="font-medium text-brand hover:text-brand-dark"
                rel="nofollow noopener"
                target="_blank"
              >
                Dataset
              </a>
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-bold text-ink">Attribution</h2>
      <ul className="mt-2 space-y-2 text-sm text-ink-muted">
        {CREDIT_STATEMENTS.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-bold text-ink">
        What we leave out on purpose
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        These feeds include sole proprietors who registered under their own
        name at their own home. We do not publish those: a listing whose name
        is a person&apos;s name is only shown when the record also shows signs
        of commercial premises, such as a website or a unit number in a plaza
        or office building. We also never import health-inspection results,
        infractions or fines, even though some of the source datasets contain
        them.
      </p>

      <h2 className="mt-10 text-lg font-bold text-ink">Corrections</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Open data can be out of date — businesses close, move and change hands
        between publications. If a listing is wrong, or you are the owner and
        want it corrected or removed,{" "}
        <Link href="/contact" className="font-medium text-brand hover:text-brand-dark">
          contact us
        </Link>{" "}
        and we will fix it.
      </p>
      <p className="mt-4 text-sm text-ink-muted">
        GTASearch is not affiliated with, sponsored by, or endorsed by any of
        the municipalities listed above.
      </p>
    </div>
  );
}
