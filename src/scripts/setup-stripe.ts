/**
 * PROBATIO — Stripe Product Setup Script
 * Run: npx tsx src/scripts/setup-stripe.ts
 *
 * Creates products and prices in Stripe. Idempotent — safe to run multiple times.
 * Outputs env vars to copy into .env.local.
 */

async function setup() {
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia" as any,
  });

  console.log("Setting up Stripe products for Probatio...\n");

  const existingProducts = await stripe.products.list({ limit: 100 });

  // ── Starter Plan ────────────────────────────────────────
  let starterProduct = existingProducts.data.find(
    (p) => p.metadata?.probatio_plan === "starter"
  );
  if (!starterProduct) {
    starterProduct = await stripe.products.create({
      name: "Probatio Starter",
      description: "50 analyses/month, PDF reports, email support",
      metadata: { probatio_plan: "starter" },
    });
    console.log(`✓ Created product: Probatio Starter (${starterProduct.id})`);
  } else {
    console.log(`  Starter product exists: ${starterProduct.id}`);
  }

  const starterPrices = await stripe.prices.list({
    product: starterProduct.id,
    active: true,
  });
  let starterPrice = starterPrices.data.find(
    (p) => p.unit_amount === 14900 && p.recurring?.interval === "month"
  );
  if (!starterPrice) {
    starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 14900,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { probatio_plan: "starter" },
    });
    console.log(`✓ Created price: $149/month (${starterPrice.id})`);
  } else {
    console.log(`  Starter price exists: ${starterPrice.id}`);
  }

  // ── Professional Plan ───────────────────────────────────
  let proProduct = existingProducts.data.find(
    (p) => p.metadata?.probatio_plan === "professional"
  );
  if (!proProduct) {
    proProduct = await stripe.products.create({
      name: "Probatio Professional",
      description:
        "200 analyses/month, forensic access, API, evidence packages, priority support",
      metadata: { probatio_plan: "professional" },
    });
    console.log(`✓ Created product: Probatio Professional (${proProduct.id})`);
  } else {
    console.log(`  Professional product exists: ${proProduct.id}`);
  }

  const proPrices = await stripe.prices.list({
    product: proProduct.id,
    active: true,
  });
  let proPrice = proPrices.data.find(
    (p) => p.unit_amount === 49900 && p.recurring?.interval === "month"
  );
  if (!proPrice) {
    proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 49900,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { probatio_plan: "professional" },
    });
    console.log(`✓ Created price: $499/month (${proPrice.id})`);
  } else {
    console.log(`  Professional price exists: ${proPrice.id}`);
  }

  // ── Forensic Analysis (One-time) ───────────────────────
  let forensicProduct = existingProducts.data.find(
    (p) => p.metadata?.probatio_type === "forensic"
  );
  if (!forensicProduct) {
    forensicProduct = await stripe.products.create({
      name: "Probatio Forensic Analysis",
      description:
        "Court-admissible Track A vs Track B comparison with chain of custody and evidence package",
      metadata: { probatio_type: "forensic" },
    });
    console.log(
      `✓ Created product: Probatio Forensic (${forensicProduct.id})`
    );
  } else {
    console.log(`  Forensic product exists: ${forensicProduct.id}`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Copy these to .env.local:");
  console.log("═══════════════════════════════════════════\n");
  console.log(`STRIPE_PRICE_STARTER=${starterPrice.id}`);
  console.log(`STRIPE_PRICE_PROFESSIONAL=${proPrice.id}`);
  console.log(`STRIPE_PRODUCT_FORENSIC=${forensicProduct.id}`);
  console.log("");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
