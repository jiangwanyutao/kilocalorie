---
name: Warm Diary Aesthetic
colors:
  surface: '#fff8f5'
  surface-dim: '#e1d8d4'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fbf2ee'
  surface-container: '#f6ece8'
  surface-container-high: '#f0e6e2'
  surface-container-highest: '#eae1dd'
  on-surface: '#1f1b19'
  on-surface-variant: '#58413c'
  inverse-surface: '#342f2d'
  inverse-on-surface: '#f8efeb'
  outline: '#8c716a'
  outline-variant: '#e0bfb7'
  surface-tint: '#a93717'
  primary: '#a53314'
  on-primary: '#ffffff'
  primary-container: '#c64b2a'
  on-primary-container: '#fff9f8'
  inverse-primary: '#ffb4a1'
  secondary: '#536523'
  on-secondary: '#ffffff'
  secondary-container: '#d6ec9a'
  on-secondary-container: '#596b28'
  tertiary: '#7e5100'
  on-tertiary: '#ffffff'
  tertiary-container: '#9f6702'
  on-tertiary-container: '#fff9f5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd2'
  primary-fixed-dim: '#ffb4a1'
  on-primary-fixed: '#3c0800'
  on-primary-fixed-variant: '#881f01'
  secondary-fixed: '#d6ec9a'
  secondary-fixed-dim: '#bacf81'
  on-secondary-fixed: '#161f00'
  on-secondary-fixed-variant: '#3c4d0c'
  tertiary-fixed: '#ffddb5'
  tertiary-fixed-dim: '#ffb958'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#643f00'
  background: '#fff8f5'
  on-background: '#1f1b19'
  surface-variant: '#eae1dd'
typography:
  hero-34:
    fontFamily: PingFang SC
    fontSize: 34px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.01em
  title-28:
    fontFamily: PingFang SC
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  section-22:
    fontFamily: PingFang SC
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
  body-17:
    fontFamily: PingFang SC
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 26px
  caption-13:
    fontFamily: PingFang SC
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-11:
    fontFamily: PingFang SC
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  margin-mobile: 20px
  gutter: 12px
---

## Brand & Style

This design system is built upon a "Warm, Calm, Ivory Paper" aesthetic, designed specifically for a personal diet and health diary. The visual narrative moves away from the clinical or hyper-gamified nature of modern fitness apps, opting instead for a tactile, editorial feel that evokes the experience of writing in a high-quality physical journal.

The style is a blend of **Minimalism** and **Tactile Modernism**. It prioritizes generous negative space, high-quality typography, and subtle organic textures to create a safe, non-judgmental space for reflection. The goal is to make daily logging feel like a ritual rather than a chore. 

**Target Audience:** Health-conscious individuals seeking a quiet, private, and sophisticated tool for mindfulness and nutrition tracking.
**Emotional Response:** Grounded, calm, honest, and intentional.

## Colors

The palette is inspired by traditional East Asian pigments, providing a warm and natural foundation.

- **Primary (Soy Orange):** Used for primary actions, active states, and brand highlights. It provides warmth and energy without being aggressive.
- **Tea Green & Honey Gold:** Used as semantic accents for nutrition categories (e.g., green for healthy streaks or vegetables, gold for high-protein or achievements).
- **Background (Ivory):** The base of the design system. It mimics high-grade paper to reduce eye strain and provide a premium, tactile feel.
- **Text (Warm Black):** A softened black that maintains high contrast while feeling more natural against the ivory background than a pure #000.

**Dark Mode Strategy:**
Transition to a "Midnight Studio" aesthetic. The background shifts to a deep, warm charcoal (#17140F). The primary Soy Orange is brightened slightly (#E86A44) to maintain accessibility and vibrancy against the dark canvas.

## Typography

The typography system is centered on **PingFang SC** for a clean, legible Chinese reading experience. To ensure data is easy to scan, **Tabular Numerals** (from the Work Sans family) must be used for all calorie counts, weights, and time-stamps to prevent shifting layouts during numerical updates.

**Hierarchical Rules:**
- **Hero/Title:** Reserved for daily calorie summaries and date headers.
- **Section:** Used for meal categories (Breakfast, Lunch, etc.).
- **Body:** The workhorse for food names and diary entries.
- **Label:** Used for macro-nutrient headers (P, F, C), always in all-caps for Latin characters or slightly increased tracking for Chinese characters.

## Layout & Spacing

This design system uses a **Fluid Grid** approach tailored for mobile devices (PWA). 

- **Margins:** A standard horizontal margin of 20px is applied to the main viewport to create a breathable, "framed" look.
- **Spacing Rhythm:** Based on a 4px baseline. Use 16px (md) for most internal card padding and 24px (lg) for vertical spacing between different content blocks.
- **Safe Areas:** Ensure content respects the top notch and bottom home indicator areas, typical of modern PWA environments.
- **Reflow:** On wider mobile screens or tablets, cards should expand to a maximum width of 600px and center-align to maintain the editorial diary aesthetic.

## Elevation & Depth

To maintain the "paper" aesthetic, this design system avoids heavy drop shadows. Depth is communicated through **Tonal Layers** and **Soft Ambient Shadows**.

- **Level 0 (Base):** The Ivory background (#FAF9F5).
- **Level 1 (Cards):** Pure white (#FFFFFF) surfaces with an extremely soft, large-radius shadow (Color: #1D1917 at 4% opacity, Y: 4px, Blur: 12px).
- **Level 2 (Modals/Overlays):** Pure white with a slightly more defined shadow (8% opacity) to indicate temporary interaction.
- **Interaction:** When pressed, buttons and cards should not lift; instead, they should subtly dim in opacity or "sink" via a tiny scale reduction (0.98x) to mimic physical paper being pressed.

## Shapes

The shape language is "Soft-Organic." It avoids the aggressive roundness of "app-like" designs while remaining approachable.

- **Cards:** Use a 16px radius. This is the primary container for meal entries and data visualizations.
- **Buttons:** Use a 10px radius. This "squircle-adjacent" look feels more professional and diary-like than a full pill.
- **Chips/Tags:** Use a full Pill shape (999px) for food tags (e.g., "High Protein," "Vegetarian") to distinguish them clearly from actionable buttons.
- **Inputs:** Follow the button radius (10px) with a subtle 1px border in the Muted text color (#5C5852).

## Components

**Buttons**
- **Primary:** Soy Orange background, Ivory text. No border.
- **Secondary:** Transparent background, Soy Orange 1.5px border and text.
- **Tertiary:** Transparent background, Warm Black text, no border (used for "Cancel" or "Back").

**Chips (Food Tags)**
- Lightly tinted backgrounds based on category (e.g., 10% Tea Green background with Tea Green text). Pill-shaped.

**Cards**
- Always white on the ivory background. Use for grouping meal items.
- Layout: Title (Meal name) + Subtitle (Time/Location) + Right-aligned Total Calories.

**Input Fields**
- Clean, 1px bottom border for a "ruled paper" look in diary entries, or a 10px rounded box for data entry.

**Lists**
- Use subtle horizontal dividers (1px, #EFECE4). 
- Food items in lists should feature the food name in Body-17 and the calorie count in Tabular Numerals.

**Icons**
- 1.5px stroke weight. Single color (Warm Black or Soy Orange). Avoid filled icons unless indicating an "active" bottom-nav state.

**Diary Entry**
- A specific component for text-based notes. Uses a larger line-height (1.8) and the Body-17 style to encourage long-form reflection.