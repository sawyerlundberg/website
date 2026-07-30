export interface CellData {
  content: string;
  className?: string;
  colSpan?: number;
  html?: boolean;
}

export interface CellPosition {
  row: number;
  col: number;
}

// Cell dimensions
export const CELL_WIDTH = 120;
export const CELL_HEIGHT = 28;

// Title cell spans multiple columns
export const TITLE_COL_SPAN = 8;
export const TITLE_ROW_HEIGHT = 52;

// Define cells with content. Row/col are 0-indexed.
// The grid extends infinitely — only cells with content are defined here.
export const CELLS: Record<string, CellData> = {
  "1,1": {
    content: "Sawyer Lundberg",
    className: "text-[32px] font-medium tracking-tight leading-none",
    colSpan: TITLE_COL_SPAN,
  },
  "3,1": {
    content: "Jul 29, 2026",
    className: "text-[13px] text-[#666] tracking-normal",
  },
  "6,1": {
    content:
      'Today, July 29, 2026 the website, <a href="https://sawyerlundberg.com" class="text-[#1a73e8] underline">sawyerlundberg.com</a>, is now live. How exciting! I hope this can be a place where I can showcase my work and life in the purest form.',
    className: "text-[13px] text-[#333] tracking-normal leading-[1.6]",
    colSpan: 8,
    html: true,
  },
};

// Starting position for the intro animation
export const INITIAL_POSITION: CellPosition = { row: 1, col: 1 };

// Where the cursor moves to during intro
export const INTRO_TARGET: CellPosition = { row: 3, col: 1 };

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function getCellData(row: number, col: number): CellData | undefined {
  return CELLS[cellKey(row, col)];
}

// Get pixel position for a cell
export function getCellPixelPosition(row: number, col: number) {
  let y = 0;
  for (let r = 0; r < row; r++) {
    if (r === 1) {
      y += TITLE_ROW_HEIGHT;
    } else {
      y += CELL_HEIGHT;
    }
  }

  return {
    x: col * CELL_WIDTH,
    y,
  };
}

// Get cell dimensions
export function getCellDimensions(row: number, col?: number) {
  const key = col !== undefined ? cellKey(row, col) : undefined;
  const cell = key ? CELLS[key] : undefined;
  const colSpan = cell?.colSpan;

  const isTitle = row === 1;
  return {
    width: colSpan
      ? CELL_WIDTH * colSpan
      : isTitle
        ? CELL_WIDTH * TITLE_COL_SPAN
        : CELL_WIDTH,
    height: isTitle ? TITLE_ROW_HEIGHT : CELL_HEIGHT,
  };
}
