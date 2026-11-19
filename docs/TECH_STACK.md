# Technology Stack Specification

This document details the exact technical stack, dependencies, design choices, and tooling used in the **Társasházkezelő Portál** (Condominium Management Platform).

---

## 1. Stack Overview

The technology stack is intentionally built using the **most battle-tested, widely adopted, and stable tools** in the JavaScript ecosystem. No experimental or complex frameworks were introduced, ensuring maximum reliability, maintainability, and longevity.

| Layer | Selected Technology | Version | Purpose & Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **React** | `^18.2.0` | Industry-standard component model. Zero-magic functional components and Context API for global state. |
| **DOM Renderer** | **React DOM** | `^18.2.0` | Client-side DOM rendering targeting `#root`. |
| **Build & Dev Tool** | **Vite** | `^5.0.8` | Blazing-fast development server with Hot Module Replacement (HMR) and production Rollup bundling. |
| **Styling Framework** | **Tailwind CSS** | `^3.4.1` | Utility-first CSS framework enabling fast, consistent UI development with low bundle sizes. |
| **CSS Post-processor**| **PostCSS + Autoprefixer**| `^8.4.35` / `^10.4.17` | Automatic browser vendor prefixing and CSS transformation. |
| **Cloud Database** | **Firebase SDK** | `^10.8.0` | Official client SDK connecting directly to Firebase Realtime Database (RTDB). |
| **Icons** | **Lucide React** | `^0.344.0` | Feather-based lightweight SVG vector icons matching modern UI standards. |
| **Spreadsheet Tool** | **SheetJS (`xlsx`)** | `^0.18.5` | Client-side workbook generation for `.xlsx` export of ledgers and statements. |
| **Typography** | **Google Fonts** | Hosted | `Inter` (UI/text) and `Outfit` (numerical KPI headers). |

---

## 2. Dependencies (`package.json`)

```json
{
  "name": "tarsas-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "^10.8.0",
    "lucide-react": "^0.344.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "vite": "^5.0.8"
  }
}
```

---

## 3. Tooling & Configurations

### 3.1 Vite (`vite.config.js`)
Configured with `@vitejs/plugin-react` to support JSX compilation and Fast Refresh.
- Development port: `3000`
- Output directory: `dist/`
- Module format: ES Modules (`"type": "module"`)

### 3.2 Tailwind CSS (`tailwind.config.js`)
Extends the default Tailwind theme with the application's brand tokens:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1E3A8A',       // Primary navy blue
          blueHover: '#1e40af',
          blueLight: '#EFF6FF',
        },
        primary: {
          DEFAULT: '#1E3A8A',
          hover: '#1e40af',
          light: '#EFF6FF',
          dark: '#0f172a',
        },
        accent: {
          DEFAULT: '#16a34a',     // Emerald green for credits/inflows
          hover: '#15803d',
          light: '#dcfce7',
        },
        danger: {
          DEFAULT: '#dc2626',     // Red for arrears/outflows
          hover: '#b91c1c',
          light: '#fee2e2',
        },
        warning: {
          DEFAULT: '#d97706',     // Amber for alerts/documents
          light: '#fef3c7',
        },
        purple: {
          DEFAULT: '#7c3aed',     // Purple for Renovation Fund (FA)
          light: '#ede9fe',
        },
        bgBody: '#F3F4F6',       // Cool light gray page background
        bgCard: '#FFFFFF',       // Clean white card background
        borderCustom: '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
      },
      boxShadow: {
        lux: '0 20px 30px -5px rgba(30, 58, 138, 0.09), 0 8px 12px -6px rgba(30, 58, 138, 0.05)',
      }
    },
  },
  plugins: [],
}
```

### 3.3 Custom Styling & Scrollbars (`src/index.css`)
- Thin, sleek scrollbars styled with `::-webkit-scrollbar` (`width: 6px`).
- Keyframe animations: `fadeIn` (for modal popups), `slideLeft` (for iOS drawer), and `shake` (for auth error prompts).

---

## 4. Browser & Device Compatibility

- **Browsers**: Evergreen Chrome, Edge, Safari (macOS & iOS), Firefox.
- **Mobile First**: Viewport configured with `maximum-scale=1.0` in `index.html` to deliver an app-like iOS and Android web experience without horizontal scrolling or viewport zoom anomalies.
- **Touch Support**: Slide-in drawer supports swipe gestures; touch events are handled for hold-to-peek password actions.

---

## 5. Build & Verification Process

The build command compiles all JSX, bundles all assets, minifies CSS/JS via Rollup, and generates a production distribution:
```powershell
npm run build
```
Target output in `dist/`:
- `dist/index.html` (~0.9 kB)
- `dist/assets/index-*.css` (~40 kB)
- `dist/assets/index-*.js` (~960 kB)

---

## 6. Firebase Hosting Deployment

The modern Vite React SPA is deployed directly to Google Firebase Hosting:
- **Project Configuration (`.firebaserc`)**: Mapped to default project `tarsashaz-cfe5d`.
- **Hosting Configuration (`firebase.json`)**: Points public directory to `dist/`, includes client-side SPA URL rewrite to `/index.html`, and sets `no-cache` headers on `index.html` to guarantee instant delivery of updates.
- **Deployment Command**:
  ```powershell
  firebase deploy --only hosting
  ```
  > [!IMPORTANT]
  > Always deploy using `--only hosting`. This ensures that static frontend assets are published without modifying, resetting, or overriding any Firebase Realtime Database rules or live condominium data.
- **Live Production URL**: [https://tarsashaz-cfe5d.web.app/](https://tarsashaz-cfe5d.web.app/) (also available at [https://tarsashaz-cfe5d.firebaseapp.com/](https://tarsashaz-cfe5d.firebaseapp.com/)).
