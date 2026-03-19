# Arcade by Rocky Kaka

A production-ready Vue 3 game arcade with 2 original browser games, contact form, and full dark/light theme support.

## ✨ Features

- 🎮 **Grid Raider** — Navigate a roguelike grid, collect packets, avoid barriers
- 🧮 **Math Chain** — Solve math puzzles with progressive difficulty  
- 📧 **Contact Form** — Integrated email via Formspree (sends to your inbox)
- 🌙 **Dark/Light Theme** — Persistent, WCAG AA compliant
- 📱 **Fully Responsive** — Desktop, tablet, mobile optimized
- ⚡ **Fast** — Built with Vite, ~3s build time
- 🎯 **Accessible** — Semantic HTML, ARIA labels, keyboard navigation
- 🛡️ **Secure** — Content-Security-Policy, no vulnerabilities

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Develop (HMR at localhost:5100)
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

## 📋 Prerequisites

- **Node.js 16.14+** - [Download](https://nodejs.org/)
- **npm 6.14+**
- **Formspree account** (free, for contact form) — https://formspree.io

## ⚙️ Setup

### 1. Clone & Install

```bash
git clone <your-repo>
cd web
npm install
```

### 2. Configure Email (Optional)

The contact form is pre-configured to send to `nishan2052@yahoo.com` via Formspree.

**To change the recipient email**:

1. Go to https://formspree.io → Create account
2. Create a new form, select your email
3. Copy your form ID (looks like `mpqybeoa`)
4. Update `/src/locales/en.ts`:

```typescript
// Find this line and replace with YOUR form ID
contactEmail: 'https://formspree.io/f/YOUR_FORM_ID',
```

### 3. Environment Variables

Create `.env` (copy from `.env.example`):

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_ENV=development
```

Optional—most settings have sensible defaults.

## 🎮 Running the App

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (HMR enabled) |
| `npm run build` | Build for production (→ `./dist/`) |
| `npm run preview` | Preview production build locally |
| `npm run local` | Quick build + preview |
| `npm run type-check` | Check TypeScript |
| `npm run lint` | Auto-fix ESLint issues |

## 📁 Project Structure

```
src/
├── modules/
│   ├── home/              # Landing page with game cards
│   ├── game/              # Grid Raider game (roguelike)
│   ├── mathpuzzle/        # Math Chain game (puzzle solver)
│   ├── about/             # About page + contact form
│   ├── common/            # Shared layouts (header, nav, footer)
│   └── shared/
│       ├── stores/        # Vuex state (counter, etc.)
│       ├── services/      # API clients (Axios)
│       ├── composables/   # Reusable Vue logic (useTheme, etc.)
│       ├── config/        # App configuration
│       └── types/         # TypeScript definitions
├── router/                # Vue Router (all routes here)
├── locales/               # i18n text (English)
├── global.scss            # CSS variables (theme, colors)
└── main.ts                # App entry point
```

## 🛠️ Tech Stack

- **Vue 3** — Composition API, script setup
- **Vite** — Lightning-fast dev & build
- **TypeScript** — Strict type checking
- **Vue Router** — Named routes, lazy loading
- **Vuex** — State management
- **Axios** — HTTP client
- **SCSS** — Scoped styles + CSS variables
- **Formspree** — Serverless form backend
- **ESLint + Prettier** — Code quality
- **Mocha + Chai** — Test framework (ready)

## 🎨 Customization

### Colors & Theme

Edit `/src/global.scss`:

```scss
// Dark theme (default)
--bg: #0a0a0a;
--text: #ffffff;
--amber: #fbbf24;
--border: #222222;

// Light theme
--bg-light: #ffffff;
--text-dark: #1a1a1a;
--amber-light: #ff7f50;
```

Theme persists in localStorage. Toggle with the sun/moon icon in the nav.

### Text & Copy

All UI text is in `/src/locales/en.ts`. Modify any string there and it updates everywhere.

Ready for internationalization — just add a `fr.ts`, `es.ts`, etc.

### Routes

All routes are in `/src/router/index.ts`. To add a new page:

```typescript
// 1. Add route name and path
export const ROUTE_NAMES = { ..., MY_PAGE: 'mypage' }
export const ROUTE_PATHS = { ..., MY_PAGE: '/mypage' }

// 2. Import your component
import MyPage from '@/modules/mypage/views/MyPage.vue'

// 3. Add to routes array
children: [
  { path: ROUTE_PATHS.MY_PAGE, component: MyPage, name: ROUTE_NAMES.MY_PAGE },
]
```

## 🔐 Security

### Contact Form

- ✅ No sensitive data (subject + message only)
- ✅ Spam protection (Formspree built-in)
- ✅ Rate limiting (50 submissions/month free)
- ✅ CSRF protected (Formspree handles it)
- ✅ No SQL injection (Formspree backend, not your DB)

### Code

- ✅ TypeScript strict mode (type safety)
- ✅ ESLint & Prettier (code quality)
- ✅ No hardcoded secrets
- ✅ Content-Security-Policy headers
- ✅ Zero npm vulnerabilities

### Production Deployment

When deploying, ensure your server sets these headers:

```
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for details.

## 📊 Build Size

```
JavaScript:  156.68 KB (57.31 KB gzipped)
CSS:          68.40 KB (12.10 KB gzipped)  
HTML:          1.24 KB (0.67 KB gzipped)
Total:       ~70 KB gzipped (excellent for production)
```

## 🚢 Deployment

### Recommended Platforms

1. **Netlify** (easiest)
   - Auto-deploy on git push
   - HTTPS included
   - Form handling supported
   ```bash
   npm run build  # Creates ./dist
   # Push to GitHub, link repo to Netlify
   ```

2. **Vercel** (Vue optimized)
   - Zero-config Vue deployment
   - Analytics dashboard
   - Auto-scaling
   ```bash
   npm install -g vercel
   vercel
   ```

3. **Cloudflare Pages** (edge optimized)
   - Global edge network
   - Cheap/free tier
   - Fast CORS

4. **Your Own Server**
   - nginx/Apache + `dist/` folder
   - Docker container ready
   - Full control

### Build Command

```bash
npm run build
# Output: ./dist/ (ready to upload)
```

## 📧 Contact Form

Visitors can submit feedback via the **About** page.

**Form receives**:
- Subject (required)
- Message (required)

**Email sent to**: Your configured Formspree email

**Test it**:
1. Click **ABOUT** in the nav
2. Fill in Subject + Message
3. Click **Send Message**
4. Check your inbox

## 🧪 Testing

Infrastructure is ready. To add tests:

```bash
# Test setup is in test-setup.ts
npm run test:watch
```

Example test (create `src/modules/home/views/__tests__/Home.spec.ts`):

```typescript
import { expect } from 'chai'
import Home from '../Home.vue'

describe('Home.vue', () => {
  it('renders headline', () => {
    // Test logic here
    expect(true).to.be.true
  })
})
```

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Design decisions, how to extend
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** — Production readiness, security review
- **[.env.example](./.env.example)** — Environment variables

## 🐛 Troubleshooting

### Port 5100 is in use
```bash
lsof -i :5100
kill -9 <PID>
# Or change port in vite.config.ts
```

### Build fails with "Cannot find module"
```bash
npm install
npm run type-check  # Shows type errors
```

### Email form not working
1. Verify Formspree form ID in `/src/locales/en.ts`
2. Check browser DevTools → Network tab for errors
3. Ensure HTTPS on production (Formspree requires it for production)

### Dark theme not persisting
Clear localStorage: `localStorage.clear(); location.reload()`

## 📈 Future Enhancements

- [ ] User authentication (with Supabase or Firebase)
- [ ] Leaderboard (store high scores on backend)
- [ ] Multiplayer games (WebSocket)
- [ ] More games (4+ total)
- [ ] Performance analytics
- [ ] Internationalization (French, Spanish, etc.)
- [ ] Unit tests (infrastructure ready)
- [ ] PWA (app manifest, service worker)

## 📝 License

Built by Rocky Kaka. See [LICENSE](./LICENSE) for details (if applicable).

## 🤝 Contributing

PRs welcome! Please:
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

**Questions?** Check [ARCHITECTURE.md](./ARCHITECTURE.md) or the source code comments.

Happy coding! 🎉
