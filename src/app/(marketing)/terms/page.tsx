import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function TermsPage() {
  const t = await getTranslations("terms");

  return (
    <main className="bg-obsidian min-h-screen">
      <article className="max-w-240 mx-auto px-6 py-16">
        <header className="mb-16">
          <h1 className="font-display text-4xl md:text-5xl text-bone mb-4">
            {t("title")}
          </h1>
          <p className="text-lg text-ash max-w-160">
            {t("subtitle")}
          </p>
          <div className="flex items-center gap-4 mt-6 text-xs text-ash">
            <span>{t("lastUpdated")}</span>
            <span className="w-px h-3 bg-slate" />
            <span>{t("documentId")}</span>
          </div>
        </header>

        <div className="space-y-16 text-bone/90">
          {/* Section 1 — Acceptance of Terms */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.acceptance.title")}
            </h2>
            <p className="text-ash leading-relaxed">
              {t("sections.acceptance.p1")}
            </p>
          </section>

          {/* Section 2 — Service Description */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.serviceDescription.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.serviceDescription.p1")}
            </p>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.serviceDescription.p2")}
            </p>
            <div className="bg-carbon border border-slate rounded-md p-6">
              <p className="text-sm text-ash">
                <strong className="text-bone">{t("sections.serviceDescription.warningLabel")}</strong>{" "}
                {t("sections.serviceDescription.warning")}
              </p>
            </div>
          </section>

          {/* Section 3 — User Responsibilities */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.userResponsibilities.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.userResponsibilities.intro")}
            </p>
            <ul className="space-y-2 text-ash">
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.userResponsibilities.items.rights")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.userResponsibilities.items.mlProcessing")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.userResponsibilities.items.noHarassment")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.userResponsibilities.items.accuracy")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.userResponsibilities.items.compliance")}
              </li>
            </ul>
          </section>

          {/* Section 4 — No Legal Advice Disclaimer */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.noLegalAdvice.title")}
            </h2>
            <div className="bg-carbon border border-[#E63926]/30 rounded-md p-6 mb-4">
              <p className="text-sm text-bone font-medium mb-3">
                {t("sections.noLegalAdvice.critical")}
              </p>
              <ul className="space-y-2 text-sm text-ash">
                <li className="flex items-start gap-2">
                  <span className="text-signal-red mt-1">&mdash;</span>
                  {t("sections.noLegalAdvice.items.notLegalAdvice")}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-signal-red mt-1">&mdash;</span>
                  {t("sections.noLegalAdvice.items.technicalOnly")}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-signal-red mt-1">&mdash;</span>
                  {t("sections.noLegalAdvice.items.courtsDetermine")}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-signal-red mt-1">&mdash;</span>
                  {t("sections.noLegalAdvice.items.consultCounsel")}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-signal-red mt-1">&mdash;</span>
                  {t("sections.noLegalAdvice.items.noGuarantee")}
                </li>
              </ul>
            </div>
            <p className="text-ash leading-relaxed">
              {t("sections.noLegalAdvice.closing")}
            </p>
          </section>

          {/* Section 5 — Data Retention Policy */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.dataRetention.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.dataRetention.intro")}
            </p>
            <div className="bg-carbon border border-slate rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate">
                    <th className="text-left p-4 text-bone font-medium">
                      {t("sections.dataRetention.table.tier")}
                    </th>
                    <th className="text-left p-4 text-bone font-medium">
                      {t("sections.dataRetention.table.audio")}
                    </th>
                    <th className="text-left p-4 text-bone font-medium">
                      {t("sections.dataRetention.table.reports")}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-ash">
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-bone font-medium">{t("sections.dataRetention.table.screening")}</td>
                    <td className="p-4 font-mono">{t("sections.dataRetention.table.screeningAudio")}</td>
                    <td className="p-4 font-mono">{t("sections.dataRetention.table.screeningReports")}</td>
                  </tr>
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-bone font-medium">{t("sections.dataRetention.table.forensic")}</td>
                    <td className="p-4 font-mono">{t("sections.dataRetention.table.forensicAudio")}</td>
                    <td className="p-4 font-mono">{t("sections.dataRetention.table.forensicReports")}</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-bone font-medium">{t("sections.dataRetention.table.reference")}</td>
                    <td className="p-4 font-mono">{t("sections.dataRetention.table.referenceAudio")}</td>
                    <td className="p-4 font-mono">{t("sections.dataRetention.table.referenceReports")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ash mt-3">
              {t("sections.dataRetention.deletion")}
            </p>
          </section>

          {/* Section 6 — Intellectual Property */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.intellectualProperty.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.intellectualProperty.p1")}
            </p>
            <ul className="space-y-2 text-ash">
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.intellectualProperty.items.userRetains")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.intellectualProperty.items.noOwnership")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.intellectualProperty.items.probatioIP")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.intellectualProperty.items.reportLicense")}
              </li>
            </ul>
          </section>

          {/* Section 7 — Forensic Evidence Disclaimer */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.forensicEvidence.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.forensicEvidence.p1")}
            </p>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.forensicEvidence.p2")}
            </p>
            <p className="text-ash leading-relaxed">
              {t("sections.forensicEvidence.p3")}
            </p>
          </section>

          {/* Section 8 — Payment & Refunds */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.payment.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.payment.intro")}
            </p>
            <ul className="space-y-2 text-ash">
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.payment.items.billing")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.payment.items.forensicFees")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.payment.items.failureRefund")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.payment.items.noRefundCompleted")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.payment.items.processor")}
              </li>
            </ul>
          </section>

          {/* Section 9 — Limitation of Liability */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.liability.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.liability.p1")}
            </p>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.liability.p2")}
            </p>
            <div className="bg-carbon border border-slate rounded-md p-6">
              <p className="text-sm text-ash">
                <strong className="text-bone">{t("sections.liability.capLabel")}</strong>{" "}
                {t("sections.liability.cap")}
              </p>
            </div>
          </section>

          {/* Section 10 — Governing Law */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.governingLaw.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.governingLaw.p1")}
            </p>
            <p className="text-ash leading-relaxed">
              {t("sections.governingLaw.p2")}
            </p>
          </section>

          {/* Section 11 — Contact */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.contact.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.contact.intro")}
            </p>
            <div className="bg-carbon border border-slate rounded-md p-6">
              <p className="text-sm text-ash">
                <strong className="text-bone">{t("sections.contact.emailLabel")}</strong>{" "}
                <a
                  href="mailto:legal@probatio.audio"
                  className="text-forensic-blue hover:underline"
                >
                  legal@probatio.audio
                </a>
              </p>
              <p className="text-sm text-ash mt-2">
                <strong className="text-bone">{t("sections.contact.entityLabel")}</strong>{" "}
                {t("sections.contact.entity")}
              </p>
            </div>
          </section>

          {/* Closing */}
          <section className="border-t border-slate pt-8">
            <p className="text-xs text-ash leading-relaxed">
              {t("closing")}
            </p>
            <p className="text-xs text-ash mt-2">
              {t("copyright")}
            </p>
          </section>
        </div>
      </article>

    </main>
  );
}
