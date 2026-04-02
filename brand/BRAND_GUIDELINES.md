# SPECTRA Brand Guidelines

**Version:** 1.0.0
**Last Updated:** 2026-03-18
**Owner:** Clandestino Ventures

---

## Brand Essence

**Positioning:** SPECTRA is the forensic intelligence layer for music copyright.

**Brand Promise:** We turn audio into evidence.

**Brand Personality:** Authoritative. Precise. Inevitable. Never flashy. Never cute.

**Voice:** Like a senior partner at a law firm who also happens to be a music theory PhD. Direct, confident, zero fluff. Technical when needed, human when it matters.

**Tagline:** "Every frequency tells the truth."

---

## Visual Identity System

### Primary Palette

| Name         | Hex       | Usage                                              |
|--------------|-----------|---------------------------------------------------|
| Obsidian     | `#0A0A0B` | Primary background — the "lab" darkness             |
| Bone         | `#F5F0EB` | Primary text on dark, editorial warmth              |
| Signal Red   | `#E63926` | Critical alerts, risk indicators, demands action    |
| Forensic Blue| `#2E6CE6` | Interactive elements, links, data viz primary       |
| Evidence Gold| `#C4992E` | Chain of custody indicators, verified/sealed states |

### Extended Palette

| Name         | Hex       | Usage                                |
|--------------|-----------|--------------------------------------|
| Carbon       | `#161618` | Elevated surfaces, cards on dark     |
| Graphite     | `#1E1E21` | Secondary surfaces                   |
| Ash          | `#8A8A8E` | Secondary text, metadata             |
| Slate        | `#3A3A3F` | Borders, dividers                    |
| Ivory        | `#FAF8F5` | Light mode backgrounds (sparingly)   |
| Risk Green   | `#22C55E` | Low risk indicator                   |
| Risk Amber   | `#F59E0B` | Medium risk indicator                |
| Risk Orange  | `#F97316` | High risk indicator                  |

### Color Philosophy

Dark-first. The product lives in darkness like a forensic lab or a recording studio control room. Light is used surgically — to draw the eye, to signal importance, to create hierarchy. Never light mode by default. The darkness is the brand.

---

### Typography

| Role           | Typeface                        | Fallback          | Usage                                          |
|----------------|--------------------------------|--------------------|-------------------------------------------------|
| Display/Headlines | Instrument Serif (Google Fonts) | Playfair Display   | Hero text, report titles, case names            |
| UI/Body        | Geist (Vercel, open source)    | -apple-system      | All interface text, body copy                   |
| Mono/Data      | Geist Mono                     | JetBrains Mono     | Hashes, timestamps, code, forensic data         |

**Type Scale:** 12 / 14 / 16 / 20 / 24 / 32 / 40 / 56 / 72. Nothing in between. Discipline.

**Never:** Inter. Never system fonts in production renders.

---

### Spacing System

- **Base unit:** 4px. Everything is a multiple of 4.
- **Component padding:** 12px / 16px / 20px / 24px
- **Section spacing:** 48px / 64px / 96px / 128px
- **Maximum content width:** 1280px (dashboard), 960px (marketing prose)

The product should breathe. Generous whitespace is not wasted space — it's authority.

---

### Iconography

- **Base set:** Lucide icons
- **Custom icons:** waveform, spectrum, fingerprint, chain-of-custody seal, risk shield
- **Style:** 1.5px stroke, rounded caps, 24x24 grid
- **Rule:** Never use filled icons except for status indicators.

---

### Motion

- **Philosophy:** Motion is information, not decoration. Things move to show state change, not to look cool.
- **Micro-interactions:** 200ms ease-out
- **Panel reveals:** 400ms ease-out
- **Page transitions:** 600ms ease-out
- **Pipeline animation:** The ONE place where motion can be cinematic — analysis stages should feel like watching a forensic lab process evidence.
- **Library:** Framer Motion for React components. CSS transitions for simple hover states.

---

### Photography / Imagery Direction

- No stock photos. Ever. No generic "people looking at screens."
- **Visual language:** Spectrogram textures, waveform patterns, audio fingerprint visualizations used as abstract graphic elements.
- **If imagery is needed:** Extreme close-ups of mixing consoles, vinyl grooves under microscope, courtroom details (gavels, evidence seals), recording studio hardware. Always dark, always moody, always real.

---

### Logo

- **Primary:** Wordmark. The name itself IS the logo.
  - Instrument Serif, tracked +2%, all caps: **SPECTRA**
- **Monogram:** The letter "S" inside a circle with a subtle waveform cut through it — like a forensic seal.
- **Usage:**
  - Wordmark on dark backgrounds: Bone (#F5F0EB) on Obsidian (#0A0A0B)
  - Monogram for favicons, compact spaces, loading states
- **Clear space:** Minimum 1x the height of the "S" on all sides

---

### Brand Applications

**OG Image (1200x630):**
Obsidian background. SPECTRA wordmark centered in Bone. Tagline below in Ash. Subtle spectrogram texture radiating from center, fading to edges. No gradients. No glow effects.

**Favicon:**
Monogram "S" with waveform cut, Bone on transparent. Sizes: 16x16, 32x32, 180x180 (Apple touch).

**Loading State:**
Monogram with a subtle pulse animation — like a heartbeat or audio waveform oscillation. 1.5s cycle, ease-in-out.

---

## Voice & Tone Examples

**Do:**
- "Analysis complete. 3 matches detected. 1 requires immediate review."
- "Your evidence package is sealed and ready for download."
- "Pipeline version 2.1.0. All thresholds logged."

**Don't:**
- "Great news! We found some matches for you! 🎉"
- "Oops! Something went wrong. Try again?"
- "Welcome to SPECTRA — the AI-powered music similarity tool!"

---

## Legal

- **Company:** Clandestino Ventures
- **Copyright:** Clandestino Ventures © 2026
- **Trademark:** SPECTRA™ (registration pending)
- **Statement Descriptor:** CLANDESTINO*SPECTRA
