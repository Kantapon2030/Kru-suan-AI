---
name: Kru Suan
colors:
  surface: '#f0fded'
  surface-dim: '#d1dece'
  surface-bright: '#f0fded'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#ebf7e7'
  surface-container: '#e5f1e1'
  surface-container-high: '#dfecdc'
  surface-container-highest: '#d9e6d6'
  on-surface: '#141e14'
  on-surface-variant: '#3f4a3c'
  inverse-surface: '#283328'
  inverse-on-surface: '#e8f4e4'
  outline: '#6f7a6b'
  outline-variant: '#becab9'
  surface-tint: '#006e1c'
  primary: '#006e1c'
  on-primary: '#ffffff'
  primary-container: '#4caf50'
  on-primary-container: '#003c0b'
  inverse-primary: '#78dc77'
  secondary: '#286b33'
  on-secondary: '#ffffff'
  secondary-container: '#abf4ac'
  on-secondary-container: '#2e7238'
  tertiary: '#75584d'
  on-tertiary: '#ffffff'
  tertiary-container: '#b69488'
  on-tertiary-container: '#452d25'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#94f990'
  primary-fixed-dim: '#78dc77'
  on-primary-fixed: '#002204'
  on-primary-fixed-variant: '#005313'
  secondary-fixed: '#abf4ac'
  secondary-fixed-dim: '#90d792'
  on-secondary-fixed: '#002107'
  on-secondary-fixed-variant: '#07521d'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#e4beb2'
  on-tertiary-fixed: '#2b160f'
  on-tertiary-fixed-variant: '#5b4137'
  background: '#f0fded'
  on-background: '#141e14'
  surface-variant: '#d9e6d6'
typography:
  headline-xl:
    fontFamily: Noto Sans Thai
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Noto Sans Thai
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Noto Sans Thai
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Noto Sans Thai
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Noto Sans Thai
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Noto Sans Thai
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Noto Sans Thai
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-xl-mobile:
    fontFamily: Noto Sans Thai
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style

The design system is built on a "Friendly Farm for Real Use" philosophy. It merges the high-engagement mechanics of educational gamification (like Duolingo) with the grounded, professional utility of a modern agricultural SaaS. The visual mood is welcoming, nurturing, and optimistic, aimed at making complex AI-driven agricultural data feel accessible and actionable.

The aesthetic follows a **Modern Tactile** style. It utilizes clean, generous whitespace and modern typography but infuses warmth through "squishy" high-radius components, organic illustrations, and a color palette rooted in the earth. The goal is to evoke a sense of growth and reliability, ensuring users feel like they are "tending" to their data rather than just managing it.

- **Audience:** Farmers, agricultural students, and hobbyist gardeners.
- **Tone:** Encouraging, clear, expert yet humble.
- **Key Visuals:** Soft-edged cards, illustrative progress indicators, and a persistent AI gardener persona.

## Colors

The palette is inspired by a healthy, sun-drenched orchard. 

- **Primary Green (#4CAF50):** Used for "Success" states and high-priority actions like "Harvest" or "Save." It represents healthy growth.
- **Warm Cream Background (#FFF8E7):** Replaces clinical whites with a softer, parchment-like tone that reduces eye strain in outdoor settings.
- **Soil Brown (#8D6E63):** Used for grounding elements, secondary navigation, or structural borders to provide a connection to the earth.
- **High-Contrast Text (#2F3A2F):** A deep evergreen charcoal ensures maximum legibility against the cream background while maintaining the organic theme.

Color should be used functionally: Green for progress, Amber for warnings (like soil moisture alerts), and Red for critical errors (pest detection).

## Typography

This design system uses **Noto Sans Thai** to ensure cross-platform consistency and exceptional legibility for both Thai and Latin characters. The typographic scale is intentionally large to accommodate users in various lighting conditions (e.g., direct sunlight on a farm).

- **Headlines:** Use Bold (700) weights to create clear section hierarchy.
- **Body:** Standardized at 16px for optimal readability. 18px is preferred for AI chat bubbles to give the "Persona" a friendly, prominent voice.
- **Labels:** Use Semi-Bold (600) for button text and card categories to ensure they stand out against vibrant background colors.

## Layout & Spacing

This design system adopts a **Mobile-First Fluid Grid** model. 

- **Desktop:** Features a fixed left-side navigation sidebar (280px width) with a fluid content area. Content is typically constrained to a max-width of 1200px to maintain readability.
- **Mobile:** Uses a bottom navigation bar for reachability. Safe-area margins of 20px are maintained on the left and right.
- **Spacing Rhythm:** Based on an 8px root unit. Cards use 16px internal padding (md) for standard info and 24px (lg) for featured content. 
- **Vertical Flow:** Stack cards with 16px gaps to create a clear "to-do" list feel.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** and **Ambient Shadows**.

- **Level 0 (Background):** #FFF8E7 (Warm Cream).
- **Level 1 (Cards/Sheets):** #FFFFFF (Pure White). These use a soft, diffused shadow: `0px 4px 12px rgba(47, 58, 47, 0.08)`. This makes the cards appear "lifted" and touchable.
- **Level 2 (Interactive/Hover):** When a card or button is pressed, the shadow deepens and the element may scale slightly (1.02x), mimicking a physical "squish."
- **Overlays:** Modals and AI chat drawers use a 40% opacity tint of the Text color (#2F3A2F) for the backdrop to keep the focus on the task at hand.

## Shapes

The shape language is **Rounded and Friendly**. 

- **Standard Components:** Buttons, input fields, and small cards use a 0.5rem (8px) radius.
- **Main Containers:** FarmCards and TaskCards use `rounded-lg` (16px) or `rounded-xl` (24px) to emphasize the approachable, toy-like "farming game" aesthetic.
- **Progress Bars:** Fully rounded (pill-shaped) to represent smooth, continuous growth.
- **Icons:** Use "Rounded" variants of icon sets to match the soft corners of the UI.

## Components

- **FarmCards:** The central UI element. Must include a title, a thumbnail (icon or plant illustration), and a prominent **Pill-shaped Progress Bar** in Primary Green.
- **TaskCards:** Smaller cards with a "Checkmark" action. When checked, use a strike-through and 50% opacity for the card to provide immediate satisfaction.
- **AI Chat Interface:** Messages from the AI gardener persona appear in #81C784 bubbles with a small tail. The user’s messages are in #FFFFFF bubbles with a thin #8D6E63 border.
- **Vertical Timeline:** A dotted brown line (#8D6E63) connecting circular nodes. Active nodes are filled with Primary Green; upcoming nodes are hollow brown circles.
- **Buttons:**
    - *Primary:* Solid #4CAF50 with White text. Bold weight.
    - *Secondary:* #FFFFFF background with #4CAF50 border and text.
    - *Tertiary (Eco):* Clear background with #8D6E63 text for "Settings" or "Cancel."
- **Marketplace Cards:** High-quality imagery on top, title and price below, and a prominent green "+" button in the bottom right corner for quick adding.