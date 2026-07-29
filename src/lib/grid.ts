export interface CellData {
  content: string;
  className?: string;
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
  },
  "3,1": {
    content: "Jul 29, 2026",
    className: "text-[13px] text-foreground/60 tracking-normal",
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

// Get cell dimensions (title cell is wider and taller)
export function getCellDimensions(row: number) {
  const isTitle = row === 1;
  return {
    width: isTitle ? CELL_WIDTH * TITLE_COL_SPAN : CELL_WIDTH,
    height: isTitle ? TITLE_ROW_HEIGHT : CELL_HEIGHT,
  };
}
