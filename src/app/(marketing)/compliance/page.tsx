import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compliance",
  description:
    "Security controls, data handling practices, and compliance posture for Probatio forensic audio intelligence platform.",
};

// ────────────────────────────────────────────────────────────────────────────
// Section data
// ────────────────────────────────────────────────────────────────────────────

const sections = [
  {
    id: "infrastructure-security",
    heading: "INFRASTRUCTURE SECURITY",
    blocks: [
      {
        title: "Data Encryption",
        body: "All data is encrypted at rest using AES-256 and in transit using TLS 1.3. Database connections require SSL. Storage buckets enforce authenticated access with per-user isolation.",
      },
      {
        title: "Access Control",
        body: "Row-level security policies enforce tenant isolation across all 18 database tables. Users can only access their own data. Organization-scoped access prevents cross-tenant visibility. Administrative access requires multi-factor verification.",
      },
      {
        title: "Audit Logging",
        body: "Every forensic operation generates an immutable audit log entry with SHA-256 hash chain verification. Each entry references the previous entry\u2019s hash, creating a Merkle chain that detects any tampering. Immutability triggers prevent modification or deletion of audit records.",
      },
      {
        title: "Rate Limiting",
        body: "All public API endpoints enforce per-user rate limits to prevent abuse. Webhook endpoints from payment processors are exempt but verify cryptographic signatures on every request.",
      },
    ],
  },
  {
    id: "data-handling",
    heading: "DATA HANDLING",
    blocks: [
      {
        title: "Data Retention",
        body: "Audio files are retained for 90 days after upload, then permanently deleted from storage. Forensic analysis results, chain of custody records, and match evidence are retained indefinitely for legal and compliance purposes. Users are notified before audio deletion.",
      },
      {
        title: "Data Isolation",
        body: "Forensic case data is isolated at the organization level. If two organizations are involved in the same dispute, complete analytical independence is maintained. The platform includes automatic conflict-of-interest detection.",
      },
      {
        title: "Data Portability",
        body: "Users can export all personal data, analysis results, and forensic reports at any time through the platform dashboard.",
      },
    ],
  },
  {
    id: "payment-security",
    heading: "PAYMENT SECURITY",
    blocks: [
      {
        title: "Payment Processing",
        body: "All payment processing is delegated to Stripe, which maintains PCI-DSS Level 1 certification \u2014 the highest level of payment security certification. Probatio systems never store, process, or transmit cardholder data.",
      },
    ],
  },
  {
    id: "forensic-integrity",
    heading: "FORENSIC INTEGRITY",
    blocks: [
      {
        title: "Chain of Custody",
        body: "Every forensic analysis maintains a cryptographic chain of custody from the moment of audio upload to the generation of the final report. Each step in the analysis pipeline produces a verification hash. The complete hash chain can be independently verified through the public verification endpoint.",
      },
      {
        title: "Reproducibility",
        body: "All analyses are pinned to a specific pipeline version with documented parameters. Rerunning the same analysis with the same pipeline version produces identical results. Pipeline versions are immutable once published.",
      },
      {
        title: "Methodology Transparency",
        body: "The forensic analysis methodology is publicly documented, including the analytical dimensions (melody, harmony, rhythm, timbre), scoring approach, and threshold classifications. This transparency is designed to support Daubert standard compliance for scientific evidence admissibility.",
      },
    ],
  },
] as const;

const certifications = {
  inProgress: [
    {
      name: "SOC 2 Type II",
      detail:
        "Architecture implements required controls. Formal audit engagement planned.",
    },
    {
      name: "ISO 42001 (AI Management Systems)",
      detail:
        "AI governance controls implemented including model versioning, bias monitoring, human oversight protocols, and transparency requirements.",
    },
  ],
  alignedWith: [
    {
      name: "GDPR",
      detail:
        "Data retention enforcement, right to erasure, data portability, privacy by design architecture.",
    },
    {
      name: "ISO 27001",
      detail:
        "Information security management controls implemented across access control, cryptography, operations security, and communications security domains.",
    },
  ],
  notRequired: [
    {
      name: "PCI-DSS",
      detail:
        "Delegated entirely to Stripe (Level 1 certified). No cardholder data processed by Probatio systems.",
    },
  ],
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  return (
    <main className="bg-obsidian min-h-screen">
      <article className="max-w-240 mx-auto px-6 py-16">
        {/* Header */}
        <header className="mb-16">
          <p className="font-mono text-xs uppercase tracking-wider text-ash/60 mb-3">
            COMPLIANCE
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-bone mb-4">
            Probatio &mdash; Security &amp; Compliance
          </h1>
          <p className="text-lg text-ash max-w-160 leading-relaxed">
            Probatio is built on compliance-ready architecture designed for
            enterprise deployment. Every technical control described below is
            implemented in production and independently verifiable.
          </p>
        </header>

        <div className="space-y-16 text-bone/90">
          {/* Technical sections */}
          {sections.map((section) => (
            <section key={section.id}>
              <h2 className="font-mono text-xs uppercase tracking-wider text-ash/60 mb-8">
                {section.heading}
              </h2>
              <div className="space-y-8">
                {section.blocks.map((block) => (
                  <div key={block.title}>
                    <h3 className="font-display text-xl text-bone mb-2">
                      {block.title}
                    </h3>
                    <p className="text-ash leading-relaxed">{block.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Certifications & Standards */}
          <section>
            <h2 className="font-mono text-xs uppercase tracking-wider text-ash/60 mb-8">
              CERTIFICATIONS &amp; STANDARDS
            </h2>

            <div className="space-y-8">
              {/* In Progress */}
              <div>
                <h3 className="font-display text-xl text-bone mb-4">
                  In Progress
                </h3>
                <div className="space-y-3">
                  {certifications.inProgress.map((cert) => (
                    <div key={cert.name}>
                      <p className="text-ash leading-relaxed">
                        <span className="text-bone font-medium">
                          {cert.name}
                        </span>{" "}
                        &mdash; {cert.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aligned With */}
              <div>
                <h3 className="font-display text-xl text-bone mb-4">
                  Aligned With
                </h3>
                <div className="space-y-3">
                  {certifications.alignedWith.map((cert) => (
                    <div key={cert.name}>
                      <p className="text-ash leading-relaxed">
                        <span className="text-bone font-medium">
                          {cert.name}
                        </span>{" "}
                        &mdash; {cert.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Not Required */}
              <div>
                <h3 className="font-display text-xl text-bone mb-4">
                  Not Required
                </h3>
                <div className="space-y-3">
                  {certifications.notRequired.map((cert) => (
                    <div key={cert.name}>
                      <p className="text-ash leading-relaxed">
                        <span className="text-bone font-medium">
                          {cert.name}
                        </span>{" "}
                        &mdash; {cert.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="border-t border-slate pt-8">
            <h2 className="font-mono text-xs uppercase tracking-wider text-ash/60 mb-6">
              CONTACT
            </h2>
            <div className="space-y-3 text-ash leading-relaxed">
              <p>
                For security inquiries, compliance documentation requests, or to
                report a vulnerability:{" "}
                <a
                  href="mailto:security@probatio.audio"
                  className="text-forensic-blue hover:underline"
                >
                  security@probatio.audio
                </a>
              </p>
              <p>
                For Data Processing Agreement (DPA) requests:{" "}
                <a
                  href="mailto:legal@probatio.audio"
                  className="text-forensic-blue hover:underline"
                >
                  legal@probatio.audio
                </a>
              </p>
            </div>
          </section>

          {/* Footer note */}
          <section className="border-t border-slate pt-8">
            <p className="text-xs text-ash leading-relaxed">
              This document describes Probatio&apos;s security and compliance
              posture as of March 2026. Controls are continuously monitored and
              updated.
            </p>
            <p className="text-xs text-ash mt-2">
              Clandestino Ventures, LLC &copy; 2026. Document version 1.0.0.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
