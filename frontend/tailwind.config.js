import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Legacy palette — preserved so existing components keep rendering,
        // but the surface.* mappings now route to translucent shadcn tokens
        // so every `bg-surface-card` / `bg-surface-input` / `bg-surface-hover`
        // callsite picks up the frosted-glass aesthetic.
        surface: {
          DEFAULT: "hsl(var(--ui-background))",
          card: "hsl(var(--ui-card) / 0.55)",
          input: "hsl(var(--ui-card) / 0.40)",
          hover: "hsl(var(--ui-muted) / 0.50)",
        },
        "border-light": "var(--border-light)",
        primary: {
          DEFAULT: "var(--text)",
          dim: "var(--text-dim)",
          muted: "var(--text-muted)",
        },
        accent: {
          // Legacy brand cyan — preserved so existing `text-accent` / `bg-accent`
          // callsites keep rendering. The new shadcn primitives intentionally
          // route their hover-state semantic to `muted` instead of `accent`.
          DEFAULT: "var(--accent)",
          dark: "var(--accent-dark)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        purple: "var(--purple)",

        // New shadcn-style palette — uses --ui-* HSL triplets so it doesn't
        // collide with the legacy hex --border / --accent variables above.
        border: "hsl(var(--ui-border))",
        input: "hsl(var(--ui-input))",
        ring: "hsl(var(--ui-ring))",
        background: "hsl(var(--ui-background))",
        foreground: "hsl(var(--ui-foreground))",
        muted: {
          DEFAULT: "hsl(var(--ui-muted))",
          foreground: "hsl(var(--ui-muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--ui-card))",
          foreground: "hsl(var(--ui-card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--ui-popover))",
          foreground: "hsl(var(--ui-popover-foreground))",
        },
        brand: {
          DEFAULT: "hsl(var(--ui-brand))",
          foreground: "hsl(var(--ui-brand-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--ui-destructive))",
          foreground: "hsl(var(--ui-destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--ui-radius)",
        md: "calc(var(--ui-radius) - 2px)",
        sm: "calc(var(--ui-radius) - 4px)",
      },
      fontFamily: {
        sans: ["'Inter'", "'Segoe UI'", "'SF Pro Display'", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px hsl(var(--ui-foreground) / 0.12)",
        "glow-sm": "0 0 10px hsl(var(--ui-foreground) / 0.08)",
        card: "0 4px 24px rgba(0, 0, 0, 0.12)",
        "card-hover": "0 8px 32px rgba(0, 0, 0, 0.18)",
        modal: "0 24px 64px rgba(2, 6, 23, 0.55)",
        glass: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 8px 24px -8px rgba(0,0,0,0.45)",
        "glass-hover": "0 1px 0 0 rgba(255,255,255,0.10) inset, 0 12px 32px -8px rgba(0,0,0,0.55)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(ellipse at top, var(--tw-gradient-stops))",
        "glass-gradient": "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)",
        "glass-gradient-light": "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.25) 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "spin-slow": "spin 1.5s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 8px hsl(var(--ui-foreground) / 0.12)" },
          "50%": { boxShadow: "0 0 20px hsl(var(--ui-foreground) / 0.22)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
