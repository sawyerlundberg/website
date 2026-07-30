import type { ReactNode } from "react";

export interface CellData {
  content: ReactNode;
  className?: string;
  /** Columns this cell spans. Merged cells are selected as a single unit. */
  colSpan?: number;
  /** Rows this cell spans. */
  rowSpan?: number;
  /** Wrap text over the cell's height instead of keeping it on one line. */
  wrap?: boolean;
}

export interface CellPosition {
  row: number;
  col: number;
}

/**
 * A uniform lattice. Every row is the same height and every column the same
 * width, so gridlines can be drawn as a single repeating background and every
 * position is a plain multiply. Cells that need more room merge across it.
 */
export const CELL_WIDTH = 120;
export const CELL_HEIGHT = 28;

/** Inset of cell text from its left gridline, matching a real sheet. */
export const CELL_PADDING_X = 6;

/** Frozen header gutters, drawn in the margin outside the grid. */
export const ROW_HEADER_WIDTH = 40;
export const COL_HEADER_HEIGHT = 22;

/**
 * Where cell (0,0) sits on screen. Narrow screens pull the grid tight against
 * the header gutters — an 80px margin costs a third of a phone's width.
 */
const COMPACT_BREAKPOINT = 640;
const ORIGIN = { x: 80, y: 80 };
const COMPACT_ORIGIN = { x: ROW_HEADER_WIDTH, y: COL_HEADER_HEIGHT + 16 };

export function getGridOrigin(viewportWidth: number) {
  return viewportWidth < COMPACT_BREAKPOINT ? COMPACT_ORIGIN : ORIGIN;
}

// Row/col are 0-indexed. The grid extends infinitely — only cells with
// content are defined here.
export const CELLS: Record<string, CellData> = {
  "1,1": {
    content: "Sawyer Lundberg",
    // 40px is the intended size; it scales down only where it would be clipped.
    className:
      "text-[clamp(1.375rem,6vw,2.5rem)] font-medium tracking-tight leading-none",
    colSpan: 3,
    rowSpan: 2,
  },
  "4,1": {
    content: "Jul 29, 2026",
    className: "text-[13px] text-[#666]",
  },
  "7,1": {
    content: (
      <>
        Today, July 29, 2026 the website,{" "}
        <a href="https://sawyerlundberg.com" className="text-[#1a73e8] underline">
          sawyerlundberg.com
        </a>
        , is now live. How exciting! I hope this can be a place where I can
        showcase my work and life in the purest form.
      </>
    ),
    className: "text-[13px] leading-[1.5] text-[#333]",
    colSpan: 8,
    rowSpan: 2,
    wrap: true,
  },
};

/** Starting position for the intro, and where the cursor moves to. */
export const INITIAL_POSITION: CellPosition = { row: 1, col: 1 };
export const INTRO_TARGET: CellPosition = { row: 4, col: 1 };

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function getCellSpan(cell: CellData | undefined) {
  return { cols: cell?.colSpan ?? 1, rows: cell?.rowSpan ?? 1 };
}

export function getCellPixelPosition(row: number, col: number) {
  return { x: col * CELL_WIDTH, y: row * CELL_HEIGHT };
}

export function getCellDimensions(row: number, col: number) {
  const { cols, rows } = getCellSpan(CELLS[cellKey(row, col)]);
  return { width: cols * CELL_WIDTH, height: rows * CELL_HEIGHT };
}

/** Every coordinate covered by a merged cell, mapped to that cell's anchor. */
const MERGE_ANCHORS: ReadonlyMap<string, CellPosition> = (() => {
  const anchors = new Map<string, CellPosition>();

  for (const [key, cell] of Object.entries(CELLS)) {
    const [row, col] = key.split(",").map(Number);
    const { cols, rows } = getCellSpan(cell);
    if (cols === 1 && rows === 1) continue;

    for (let r = row; r < row + rows; r++) {
      for (let c = col; c < col + cols; c++) {
        anchors.set(cellKey(r, c), { row, col });
      }
    }
  }

  return anchors;
})();

/** Resolve a coordinate to the cell that owns it. */
export function resolveAnchor(row: number, col: number): CellPosition {
  return MERGE_ANCHORS.get(cellKey(row, col)) ?? { row, col };
}

/**
 * Step one cell in a direction. Merged cells behave as a single unit, so a
 * move that lands inside the range we're already on keeps going until it
 * leaves — the same as arrowing across a merged range in a real spreadsheet.
 */
export function moveCursor(
  from: CellPosition,
  dRow: number,
  dCol: number
): CellPosition {
  let row = from.row + dRow;
  let col = from.col + dCol;

  while (row >= 0 && col >= 0) {
    const anchor = resolveAnchor(row, col);
    if (anchor.row !== from.row || anchor.col !== from.col) return anchor;
    row += dRow;
    col += dCol;
  }

  return from;
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function columnLabel(index: number): string {
  let label = "";
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
    label = String.fromCharCode(65 + (n % 26)) + label;
  }
  return label;
}

export function cellLabel({ row, col }: CellPosition): string {
  return `${columnLabel(col)}${row + 1}`;
}
