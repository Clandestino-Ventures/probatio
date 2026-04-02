import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

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
          {/* Section 1 — Information We Collect */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.informationCollected.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.informationCollected.intro")}
            </p>

            <div className="space-y-6">
              {/* Account Information */}
              <div>
                <h3 className="text-bone font-medium mb-2">
                  {t("sections.informationCollected.account.title")}
                </h3>
                <ul className="space-y-2 text-ash text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-forensic-blue mt-1">&mdash;</span>
                    {t("sections.informationCollected.account.email")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forensic-blue mt-1">&mdash;</span>
                    {t("sections.informationCollected.account.name")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forensic-blue mt-1">&mdash;</span>
                    {t("sections.informationCollected.account.organization")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forensic-blue mt-1">&mdash;</span>
                    {t("sections.informationCollected.account.language")}
                  </li>
                </ul>
              </div>

              {/* Audio Files */}
              <div>
                <h3 className="text-bone font-medium mb-2">
                  {t("sections.informationCollected.audio.title")}
                </h3>
                <p className="text-sm text-ash">
                  {t("sections.informationCollected.audio.description")}
                </p>
              </div>

              {/* Analysis Data */}
              <div>
                <h3 className="text-bone font-medium mb-2">
                  {t("sections.informationCollected.analysis.title")}
                </h3>
                <ul className="space-y-2 text-ash text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-forensic-blue mt-1">&mdash;</span>
                    {t("sections.informationCollected.analysis.results")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forensic-blue mt-1">&mdash;</span>
                    {t("sections.informationCollected.analysis.scores")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forensic-blue mt-1">&mdash;</span>
                    {t("sections.informationCollected.analysis.reports")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forensic-blue mt-1">&mdash;</span>
                    {t("sections.informationCollected.analysis.chainOfCustody")}
                  </li>
                </ul>
              </div>

              {/* Payment Information */}
              <div>
                <h3 className="text-bone font-medium mb-2">
                  {t("sections.informationCollected.payment.title")}
                </h3>
                <p className="text-sm text-ash">
                  {t("sections.informationCollected.payment.description")}
                </p>
              </div>

              {/* Usage Data */}
              <div>
                <h3 className="text-bone font-medium mb-2">
                  {t("sections.informationCollected.usage.title")}
                </h3>
                <p className="text-sm text-ash">
                  {t("sections.informationCollected.usage.description")}
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 — How We Process Your Data */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.dataProcessing.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.dataProcessing.intro")}
            </p>
            <div className="bg-carbon border border-slate rounded-md p-6 font-mono text-sm text-ash">
              <div className="space-y-1">
                <p>
                  <span className="text-forensic-blue">01</span>{" "}
                  {t("sections.dataProcessing.pipeline.demucs")}
                </p>
                <p>
                  <span className="text-forensic-blue">02</span>{" "}
                  {t("sections.dataProcessing.pipeline.crepe")}
                </p>
                <p>
                  <span className="text-forensic-blue">03</span>{" "}
                  {t("sections.dataProcessing.pipeline.clap")}
                </p>
                <p>
                  <span className="text-forensic-blue">04</span>{" "}
                  {t("sections.dataProcessing.pipeline.librosa")}
                </p>
                <p>
                  <span className="text-forensic-blue">05</span>{" "}
                  {t("sections.dataProcessing.pipeline.reports")}
                </p>
                <p>
                  <span className="text-forensic-blue">06</span>{" "}
                  {t("sections.dataProcessing.pipeline.musicbrainz")}
                </p>
              </div>
            </div>
            <p className="text-xs text-ash mt-3">
              {t("sections.dataProcessing.gpuNote")}
            </p>
          </section>

          {/* Section 3 — Third-Party Services */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.thirdParty.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.thirdParty.intro")}
            </p>
            <div className="bg-carbon border border-slate rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate">
                    <th className="text-left p-4 text-bone font-medium">
                      {t("sections.thirdParty.table.service")}
                    </th>
                    <th className="text-left p-4 text-bone font-medium">
                      {t("sections.thirdParty.table.purpose")}
                    </th>
                    <th className="text-left p-4 text-bone font-medium">
                      {t("sections.thirdParty.table.location")}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-ash">
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-bone font-medium">Supabase</td>
                    <td className="p-4">{t("sections.thirdParty.services.supabase")}</td>
                    <td className="p-4 font-mono">{t("sections.thirdParty.locations.us")}</td>
                  </tr>
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-bone font-medium">Modal.com</td>
                    <td className="p-4">{t("sections.thirdParty.services.modal")}</td>
                    <td className="p-4 font-mono">{t("sections.thirdParty.locations.us")}</td>
                  </tr>
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-bone font-medium">Anthropic</td>
                    <td className="p-4">{t("sections.thirdParty.services.anthropic")}</td>
                    <td className="p-4 font-mono">{t("sections.thirdParty.locations.us")}</td>
                  </tr>
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-bone font-medium">Stripe</td>
                    <td className="p-4">{t("sections.thirdParty.services.stripe")}</td>
                    <td className="p-4 font-mono">{t("sections.thirdParty.locations.us")}</td>
                  </tr>
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-bone font-medium">Vercel</td>
                    <td className="p-4">{t("sections.thirdParty.services.vercel")}</td>
                    <td className="p-4 font-mono">{t("sections.thirdParty.locations.global")}</td>
                  </tr>
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-bone font-medium">PostHog</td>
                    <td className="p-4">{t("sections.thirdParty.services.posthog")}</td>
                    <td className="p-4 font-mono">{t("sections.thirdParty.locations.eu")}</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-bone font-medium">Sentry</td>
                    <td className="p-4">{t("sections.thirdParty.services.sentry")}</td>
                    <td className="p-4 font-mono">{t("sections.thirdParty.locations.us")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 — Data Retention */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.dataRetention.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.dataRetention.p1")}
            </p>
            <p className="text-ash leading-relaxed">
              {t("sections.dataRetention.p2")}
            </p>
          </section>

          {/* Section 5 — Your Rights */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.yourRights.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.yourRights.intro")}
            </p>
            <ul className="space-y-2 text-ash">
              <li className="flex items-start gap-2">
                <span className="text-evidence-gold mt-1">&mdash;</span>
                <span>
                  <strong className="text-bone">{t("sections.yourRights.rights.access.title")}</strong>{" "}
                  {t("sections.yourRights.rights.access.description")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-evidence-gold mt-1">&mdash;</span>
                <span>
                  <strong className="text-bone">{t("sections.yourRights.rights.correction.title")}</strong>{" "}
                  {t("sections.yourRights.rights.correction.description")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-evidence-gold mt-1">&mdash;</span>
                <span>
                  <strong className="text-bone">{t("sections.yourRights.rights.deletion.title")}</strong>{" "}
                  {t("sections.yourRights.rights.deletion.description")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-evidence-gold mt-1">&mdash;</span>
                <span>
                  <strong className="text-bone">{t("sections.yourRights.rights.export.title")}</strong>{" "}
                  {t("sections.yourRights.rights.export.description")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-evidence-gold mt-1">&mdash;</span>
                <span>
                  <strong className="text-bone">{t("sections.yourRights.rights.optOut.title")}</strong>{" "}
                  {t("sections.yourRights.rights.optOut.description")}
                </span>
              </li>
            </ul>
          </section>

          {/* Section 6 — Security */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.security.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.security.intro")}
            </p>
            <ul className="space-y-2 text-ash">
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.security.measures.tls")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.security.measures.encryption")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.security.measures.rls")}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-forensic-blue mt-1">&mdash;</span>
                {t("sections.security.measures.audit")}
              </li>
            </ul>
          </section>

          {/* Section 7 — Children */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.children.title")}
            </h2>
            <p className="text-ash leading-relaxed">
              {t("sections.children.description")}
            </p>
          </section>

          {/* Section 8 — Changes */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {t("sections.changes.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {t("sections.changes.p1")}
            </p>
            <p className="text-ash leading-relaxed">
              {t("sections.changes.p2")}
            </p>
          </section>

          {/* Section 9 — Contact */}
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
                  href="mailto:privacy@probatio.audio"
                  className="text-forensic-blue hover:underline"
                >
                  privacy@probatio.audio
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
