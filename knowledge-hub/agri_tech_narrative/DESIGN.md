---
name: Agri-Tech Narrative
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
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 30px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
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
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The design system is built for a knowledge acquisition platform that bridges traditional farming wisdom with modern AI. The personality is "The Helpful Expert"—knowledgeable but deeply rooted in the earth. The emotional response should be one of safety, growth, and accessibility.

The visual style is **Modern Organic**. It blends the cleanliness of **Minimalism** with **Tactile** elements. We use generous whitespace to ensure clarity for users of all technical levels, paired with soft, large-radius containers that mimic the curves of nature. Visuals should avoid cold, industrial aesthetics, opting instead for warmth and human-centric layouts that feel as much like a community garden as a digital tool.

## Colors

The palette is derived from a lush Thai agricultural landscape. 

- **Primary (#4CAF50):** Representing vitality and growth. Used for main actions and success states.
- **Secondary (#81C784):** A softer green for supportive elements and decorative backgrounds.
- **Background (#FFF8E7):** A warm, cream-tinted off-white that reduces eye strain and feels more approachable than pure white.
- **Natural Brown (#8D6E63):** Used for grounding elements, secondary text, or "earthy" accents to distinguish from tech-only platforms.
- **Accent (#FFB74D):** Harvest orange, used sparingly to draw attention to progress, alerts, or featured knowledge.

## Typography

This design system utilizes **Be Vietnam Pro** for its excellent Thai glyph support and friendly, contemporary proportions. The type scale is generous to prioritize readability for older users or those in outdoor conditions.

- **Headlines:** Use Bold or SemiBold weights to create a strong hierarchy.
- **Body:** Use the 18px (Large) variant for primary content like articles or AI responses to ensure maximum legibility.
- **Labels:** Used for metadata, tags (CropTag), and navigation hints.

## Layout & Spacing

The layout follows a **Fluid Grid** model with high-breathability. 

- **Desktop:** 12-column grid with a max-width of 1280px. Gutters are fixed at 24px to provide clear separation between cards.
- **Mobile:** 4-column grid with 16px side margins.
- **Rhythm:** Spacing follows an 8px base unit. Use `md` (24px) for padding inside cards and `lg` (40px) for vertical section spacing.

Layouts should favor vertical stacking on mobile to accommodate longer Thai text strings without truncation.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Ambient Shadows**. 

- **Level 0 (Background):** The warm #FFF8E7 surface.
- **Level 1 (Cards):** Pure white (#FFFFFF) with a very soft, diffused shadow (Offset: 0, 4px; Blur: 20px; Opacity: 6% of Primary Text Color).
- **Level 2 (Interactive/Hover):** Increased shadow depth (Blur: 30px; Opacity: 10%) and a slight 2px upward translation.
- **Overlays:** Use a semi-transparent blur (Glassmorphism) of the background color for navigation bars to maintain the sense of place while scrolling.

## Shapes

The shape language is defined by **Soft Continuity**. 

- **Cards:** Use a large radius (24px) to feel friendly and non-threatening.
- **Buttons:** Fully rounded (pill-shaped) for primary actions to distinguish them from content containers.
- **Inputs:** 12px radius to balance the "softness" with the "structure" required for data entry.
- **Illustrations:** Should incorporate organic, non-geometric blobs in the background to reinforce the agricultural theme.

## Components

### Buttons
- **Primary:** Pill-shaped, Primary Green background, White text. High-contrast and bold.
- **Secondary:** Outlined with a 2px stroke of Primary Green.
- **Ghost:** Natural Brown text with no background, used for tertiary actions.

### Agriculture Tags (CropTag / FarmTag)
- Small, rounded containers (8px radius).
- **CropTag:** Secondary Green (#81C784) background with dark green text.
- **FarmTag:** Natural Brown (#8D6E63) background with white text.
- Always include a small icon (e.g., a leaf or a location pin) for instant recognition.

### Progress Bars
- Thick (8px-12px) tracks with fully rounded caps. 
- Track color: 15% opacity of Primary Green. 
- Indicator color: Primary Green or Accent Orange (for urgent milestones).

### Cards
- White surface, 24px border-radius, soft shadow.
- Content should have 24px internal padding.
- Imagery within cards should also follow the 16px internal border-radius.

### Inputs
- Background: #FFFFFF.
- Border: 1px solid #E0E0E0. 
- Focus State: 2px solid Primary Green with a soft glow effect.
- Labels should always be visible above the input field, never just placeholder text.