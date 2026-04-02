import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("methodologyPage");
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function MethodologyPage() {
  const t = await getTranslations("methodologyPage");
  const s = await getTranslations("methodologyPage.sections");

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
            <span>{t("pipelineVersion")}</span>
            <span className="w-px h-3 bg-slate" />
            <span>{t("lastUpdated")}</span>
            <span className="w-px h-3 bg-slate" />
            <span>{t("documentId")}</span>
          </div>
        </header>

        <div className="space-y-16 text-bone/90">
          {/* Section 1: Pipeline Overview */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {s("pipelineOverview.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {s("pipelineOverview.description")}
            </p>
            <div className="bg-carbon border border-slate rounded-md p-6 font-mono text-sm text-ash">
              <div className="space-y-1">
                {([0, 1, 2, 3, 4, 5, 6, 7] as const).map((i) => (
                  <p key={i}>
                    <span className="text-forensic-blue">
                      {String(i + 1).padStart(2, "0")}
                    </span>{" "}
                    {s(`pipelineOverview.steps.${i}`)}
                  </p>
                ))}
              </div>
            </div>
          </section>

          {/* Section 2: Normalization */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {s("normalization.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {s("normalization.description")}
            </p>
            <ul className="space-y-2 text-ash">
              {([0, 1, 2, 3, 4] as const).map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-forensic-blue mt-1">&mdash;</span>
                  {s(`normalization.specs.${i}`)}
                </li>
              ))}
            </ul>
          </section>

          {/* Section 3: Source Separation */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {s("sourceSeparation.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {s("sourceSeparation.p1")}
            </p>
            <p className="text-ash leading-relaxed">
              {s("sourceSeparation.p2")}
            </p>
          </section>

          {/* Section 4: Feature Extraction */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {s("featureExtraction.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {s("featureExtraction.intro")}
            </p>
            <ul className="space-y-2 text-ash mb-4">
              {(["pitch", "chroma", "onset", "beat", "structure"] as const).map(
                (key) => (
                  <li key={key} className="flex items-start gap-2">
                    <span className="text-forensic-blue mt-1">&mdash;</span>
                    <span>
                      <strong className="text-bone">
                        {s(`featureExtraction.features.${key}.label`)}
                      </strong>{" "}
                      {s(`featureExtraction.features.${key}.description`)}
                    </span>
                  </li>
                )
              )}
            </ul>
          </section>

          {/* Section 5: Similarity Scoring */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {s("similarityScoring.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {s("similarityScoring.intro")}
            </p>
            <div className="bg-carbon border border-slate rounded-md p-6 space-y-4">
              {(["melody", "harmony", "rhythm", "timbre"] as const).map(
                (dim) => (
                  <div key={dim}>
                    <h4 className="text-bone font-medium mb-1">
                      {s(`similarityScoring.${dim}.title`)}
                    </h4>
                    <p className="text-sm text-ash">
                      {s(`similarityScoring.${dim}.description`)}
                    </p>
                  </div>
                )
              )}
            </div>
          </section>

          {/* Section 6: Risk Classification */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {s("riskClassification.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {s("riskClassification.intro")}
            </p>
            <div className="bg-carbon border border-slate rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate">
                    <th className="text-left p-4 text-bone font-medium">
                      {s("riskClassification.tableHeaders.level")}
                    </th>
                    <th className="text-left p-4 text-bone font-medium">
                      {s("riskClassification.tableHeaders.melody")}
                    </th>
                    <th className="text-left p-4 text-bone font-medium">
                      {s("riskClassification.tableHeaders.overall")}
                    </th>
                    <th className="text-left p-4 text-bone font-medium">
                      {s("riskClassification.tableHeaders.action")}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-ash">
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-signal-red font-medium">
                      {s("riskClassification.critical.level")}
                    </td>
                    <td className="p-4 font-mono">
                      {s("riskClassification.critical.melody")}
                    </td>
                    <td className="p-4 font-mono">
                      {s("riskClassification.critical.overall")}
                    </td>
                    <td className="p-4">
                      {s("riskClassification.critical.action")}
                    </td>
                  </tr>
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-risk-high font-medium">
                      {s("riskClassification.high.level")}
                    </td>
                    <td className="p-4 font-mono">
                      {s("riskClassification.high.melody")}
                    </td>
                    <td className="p-4 font-mono">
                      {s("riskClassification.high.overall")}
                    </td>
                    <td className="p-4">
                      {s("riskClassification.high.action")}
                    </td>
                  </tr>
                  <tr className="border-b border-slate/50">
                    <td className="p-4 text-risk-moderate font-medium">
                      {s("riskClassification.medium.level")}
                    </td>
                    <td className="p-4 font-mono">
                      {s("riskClassification.medium.melody")}
                    </td>
                    <td className="p-4 font-mono">
                      {s("riskClassification.medium.overall")}
                    </td>
                    <td className="p-4">
                      {s("riskClassification.medium.action")}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 text-risk-low font-medium">
                      {s("riskClassification.low.level")}
                    </td>
                    <td className="p-4 font-mono">
                      {s("riskClassification.low.melody")}
                    </td>
                    <td className="p-4 font-mono">
                      {s("riskClassification.low.overall")}
                    </td>
                    <td className="p-4">
                      {s("riskClassification.low.action")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ash mt-3">
              {s("riskClassification.note")}
            </p>
          </section>

          {/* Section 7: Chain of Custody */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {s("chainOfCustody.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {s("chainOfCustody.intro")}
            </p>
            <ul className="space-y-2 text-ash">
              {([0, 1, 2, 3, 4] as const).map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-evidence-gold mt-1">&mdash;</span>
                  {s(`chainOfCustody.entries.${i}`)}
                </li>
              ))}
            </ul>
            <p className="text-ash leading-relaxed mt-4">
              {s("chainOfCustody.auditLogNote")}
            </p>
          </section>

          {/* Section 8: Daubert Compliance */}
          <section>
            <h2 className="font-display text-2xl text-bone mb-4">
              {s("daubertCompliance.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-4">
              {s("daubertCompliance.intro")}
            </p>
            <ol className="space-y-4 text-ash">
              {(
                [
                  "testability",
                  "peerReview",
                  "errorRate",
                  "standards",
                  "acceptance",
                ] as const
              ).map((key) => (
                <li key={key}>
                  <strong className="text-bone">
                    {s(`daubertCompliance.factors.${key}.label`)}
                  </strong>{" "}
                  {s(`daubertCompliance.factors.${key}.description`)}
                </li>
              ))}
            </ol>
          </section>

          {/* Methodology Documentation CTA */}
          <section className="bg-carbon border border-slate rounded-md p-8">
            <h2 className="font-display text-xl text-bone mb-3">
              {t("cta.title")}
            </h2>
            <p className="text-ash leading-relaxed mb-6">
              {t("cta.description")}
            </p>
            <a
              href="mailto:legal@probatio.audio?subject=Methodology%20Whitepaper%20Request"
              className="inline-flex items-center justify-center rounded-md bg-evidence-gold px-6 py-2.5 font-sans text-sm font-medium text-obsidian transition-all duration-200 hover:bg-evidence-gold/85"
            >
              {t("cta.button")}
            </a>
          </section>

          {/* Disclaimer */}
          <section className="border-t border-slate pt-8">
            <p className="text-xs text-ash leading-relaxed">
              {t("disclaimer")}
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
