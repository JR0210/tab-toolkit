# Tab Toolkit

A local-first Chrome extension for exporting, copying, organising, and managing browser tabs.

The project is currently at the foundation stage. Chrome APIs, the Manifest V3 package, and the designed extension interface will be added in subsequent changes.

## Principles

- Local-only operation with no accounts, database, analytics, or data collection.
- Minimal Chrome permissions and no page-content modification.
- A compact, accessible interface designed for a browser extension popup.
- Manifest V3 and modern Chrome APIs.

## Stack

- React 19
- TypeScript 6
- Vite+ 0.2

Vite+ provides the Vite/Rolldown build, Vitest, Oxlint, Oxfmt, and TypeScript checking through one project-local toolchain. It is currently in beta and is being used here deliberately while the project is still greenfield.

## Development

Node.js 22.12 or newer is required.

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` starts the Vite development server.
- `npm run format` formats the project with Oxfmt.
- `npm run lint` runs Oxlint.
- `npm run typecheck` runs Vite+'s TypeScript check.
- `npm run check` runs formatting, linting, and type-checking.
- `npm run check:fix` formats and applies safe lint fixes.
- `npm test` runs Vitest through Vite+.
- `npm run build` creates a production build in `dist`.
- `npm run preview` serves the production build locally.

## Privacy

Tab Toolkit is intended to work entirely on the user's device. It will not collect, sell, or transmit browsing data.

## License

No open-source license has been selected yet.
