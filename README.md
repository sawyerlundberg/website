# sawyerlundberg.com

Personal website built as an invisible spreadsheet. Arrow keys navigate between cells. Two cells have content. Everything else is whitespace.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS, Framer Motion
- Deployable to Vercel

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding content

Edit `src/lib/grid.ts` to add cells:

```ts
export const CELLS: Record<string, CellData> = {
  "1,1": { content: "Sawyer Lundberg", className: "..." },
  "3,1": { content: "Jul 29, 2026", className: "..." },
  "6,1": { content: "Experience", className: "..." },
  "8,1": { content: "Projects", className: "..." },
};
```

Keys are `"row,col"` (0-indexed). The grid extends infinitely.

## Deploy

```bash
npm run build
```

Or connect to [Vercel](https://vercel.com) for automatic deployments.
