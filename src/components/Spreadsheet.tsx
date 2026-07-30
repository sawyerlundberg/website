"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CELLS,
  CELL_HEIGHT,
  CELL_PADDING_X,
  CELL_WIDTH,
  COL_HEADER_HEIGHT,
  INITIAL_POSITION,
  INTRO_TARGET,
  ROW_HEADER_WIDTH,
  type CellPosition,
  cellKey,
  cellLabel,
  columnLabel,
  getCellDimensions,
  getCellPixelPosition,
  getCellSpan,
  getGridOrigin,
  moveCursor,
} from "@/lib/grid";

/** Selection blue, matching a spreadsheet's active-cell chrome. */
const ACCENT = "#1a73e8";

/** Everything that moves shares one easing so the grid stays locked together. */
const EASING = "cubic-bezier(0.2, 0, 0, 1)";
const DURATION = 90;

/** Breathing room kept between the cursor and the viewport edge when panning. */
const EDGE_MARGIN = 40;

/** Header labels rendered per axis — enough to cover a 4K display. */
const HEADER_COLS = 33;
const HEADER_ROWS = 78;

/** The cursor drifts to a second cell shortly after load, unless you move first. */
const INTRO_MOVE_DELAY = 1400;

const KEY_MOVES: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

interface Size {
  width: number;
  height: number;
}

interface Offset {
  x: number;
  y: number;
}

/** Cursor and pan move together, so they live in one piece of state. */
interface View {
  cursor: CellPosition;
  pan: Offset;
}

/**
 * Pan one axis just far enough to keep the selection on screen. Expressed as
 * bounds rather than sequential overwrites so the result stays sane when a
 * cell is wider than the viewport: revealing the far edge never wins over
 * keeping the near edge visible, and nothing ever scrolls past the origin.
 */
function clampAxis(
  pan: number,
  cellStart: number,
  cellSize: number,
  viewSize: number,
  origin: number
): number {
  const toRevealFarEdge = viewSize - EDGE_MARGIN - cellStart - cellSize;
  const toKeepNearEdge = origin - cellStart;

  let next = pan;
  if (next > toRevealFarEdge) next = toRevealFarEdge;
  if (next < toKeepNearEdge) next = toKeepNearEdge;

  // Never past the origin, and whole pixels only — fractions blur hairlines.
  return Math.round(Math.min(0, next));
}

/** The pan that brings `cursor` into view, or the current one if it already is. */
function settlePan(cursor: CellPosition, pan: Offset, viewport: Size | null): Offset {
  if (!viewport) return pan;

  const origin = getGridOrigin(viewport.width);
  const { x, y } = getCellPixelPosition(cursor.row, cursor.col);
  const { width, height } = getCellDimensions(cursor.row, cursor.col);

  const nextX = clampAxis(pan.x, origin.x + x, width, viewport.width, origin.x);
  const nextY = clampAxis(pan.y, origin.y + y, height, viewport.height, origin.y);

  return nextX === pan.x && nextY === pan.y ? pan : { x: nextX, y: nextY };
}

/** Cells sit at their anchor and fill their merged range. */
function renderContentCells(origin: Offset) {
  return Object.entries(CELLS).map(([key, data]) => {
    const [row, col] = key.split(",").map(Number);
    const { x, y } = getCellPixelPosition(row, col);
    const { width, height } = getCellDimensions(row, col);

    return (
      <div
        key={key}
        className="fade-in absolute flex items-center"
        style={{
          left: origin.x + x,
          top: origin.y + y,
          width,
          height,
          paddingLeft: CELL_PADDING_X,
          paddingRight: CELL_PADDING_X,
          whiteSpace: data.wrap ? "normal" : "nowrap",
          animationDelay: "300ms",
        }}
      >
        <span className={data.className}>{data.content}</span>
      </div>
    );
  });
}

export default function Spreadsheet() {
  const [{ cursor, pan }, setView] = useState<View>({
    cursor: INITIAL_POSITION,
    pan: { x: 0, y: 0 },
  });
  const [viewport, setViewport] = useState<Size | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Size | null>(null);
  const userMoved = useRef(false);

  const origin = getGridOrigin(viewport?.width ?? Infinity);

  // Until the first measurement lands the origin is a guess. Correct it without
  // animating, so the grid never visibly slides into place on load.
  const glide = (property: string) =>
    viewport ? `${property} ${DURATION}ms ${EASING}` : "none";

  /** Move the selection and settle the viewport around it in one update. */
  const select = useCallback((next: (from: CellPosition) => CellPosition) => {
    setView((prev) => {
      const cursor = next(prev.cursor);
      if (cursor === prev.cursor) return prev;
      return { cursor, pan: settlePan(cursor, prev.pan, viewportRef.current) };
    });
  }, []);

  const move = useCallback(
    (dRow: number, dCol: number) => {
      userMoved.current = true;
      select((from) => moveCursor(from, dRow, dCol));
    },
    [select]
  );

  // Scripted intro move, abandoned the moment the visitor takes over.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!userMoved.current) select(() => INTRO_TARGET);
    }, INTRO_MOVE_DELAY);

    return () => clearTimeout(timer);
  }, [select]);

  // Measure the container rather than the window, and only ever with a real
  // laid-out size — clamping against a 0x0 rect would strand the pan off-grid.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;

      const size = { width, height };
      viewportRef.current = size;
      setViewport(size);
      setView((prev) => {
        const pan = settlePan(prev.cursor, prev.pan, size);
        return pan === prev.pan ? prev : { ...prev, pan };
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const arrow = KEY_MOVES[e.key];
      if (arrow) {
        e.preventDefault();
        move(arrow[0], arrow[1]);
        return;
      }

      // Enter advances a row, Shift+Enter goes back — as it does in a sheet.
      if (e.key === "Enter") {
        e.preventDefault();
        move(e.shiftKey ? -1 : 1, 0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const threshold = 30;
      touchStart.current = null;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > threshold) move(0, dx > 0 ? -1 : 1);
      } else if (Math.abs(dy) > threshold) {
        move(dy > 0 ? -1 : 1, 0);
      }
    },
    [move]
  );

  const cursorPos = getCellPixelPosition(cursor.row, cursor.col);
  const cursorDims = getCellDimensions(cursor.row, cursor.col);
  const cursorSpan = getCellSpan(CELLS[cellKey(cursor.row, cursor.col)]);

  // Only the labels in view need rendering; the range shifts as you pan.
  const firstCol = Math.max(0, Math.floor(-pan.x / CELL_WIDTH));
  const firstRow = Math.max(0, Math.floor(-pan.y / CELL_HEIGHT));

  const colIndices = useMemo(
    () => Array.from({ length: HEADER_COLS }, (_, i) => firstCol + i),
    [firstCol]
  );
  const rowIndices = useMemo(
    () => Array.from({ length: HEADER_ROWS }, (_, i) => firstRow + i),
    [firstRow]
  );

  const contentCells = useMemo(() => renderContentCells(origin), [origin]);

  const isColActive = (col: number) =>
    col >= cursor.col && col < cursor.col + cursorSpan.cols;
  const isRowActive = (row: number) =>
    row >= cursor.row && row < cursor.row + cursorSpan.rows;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-white"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="application"
      aria-label="Interactive spreadsheet. Use arrow keys to move the selection."
    >
      {/* Gridlines — one element, tiled from the origin outward. */}
      <div
        className="grid-lines absolute"
        style={{
          left: origin.x,
          top: origin.y,
          right: 0,
          bottom: 0,
          backgroundSize: `${CELL_WIDTH}px ${CELL_HEIGHT}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          transition: glide("background-position"),
        }}
      />

      {/* Corner box: the current cell reference. */}
      <div
        className="absolute flex items-center justify-end text-[10px] tabular-nums text-black/45"
        style={{
          left: origin.x - ROW_HEADER_WIDTH,
          top: origin.y - COL_HEADER_HEIGHT,
          width: ROW_HEADER_WIDTH,
          height: COL_HEADER_HEIGHT,
          paddingRight: CELL_PADDING_X + 2,
        }}
        aria-hidden
      >
        {cellLabel(cursor)}
      </div>

      {/* Column headers — frozen vertically, panning with the grid. */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: origin.x,
          top: origin.y - COL_HEADER_HEIGHT,
          right: 0,
          height: COL_HEADER_HEIGHT,
        }}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate3d(${pan.x}px, 0, 0)`,
            transition: glide("transform"),
          }}
        >
          {colIndices.map((col) => (
            <div
              key={col}
              className="absolute flex items-center justify-center text-[10px]"
              style={{
                left: col * CELL_WIDTH,
                width: CELL_WIDTH,
                height: COL_HEADER_HEIGHT,
                color: isColActive(col) ? ACCENT : "rgba(0,0,0,0.28)",
              }}
            >
              {columnLabel(col)}
            </div>
          ))}
        </div>
      </div>

      {/* Row headers — frozen horizontally, panning with the grid. */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: origin.x - ROW_HEADER_WIDTH,
          top: origin.y,
          width: ROW_HEADER_WIDTH,
          bottom: 0,
        }}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate3d(0, ${pan.y}px, 0)`,
            transition: glide("transform"),
          }}
        >
          {rowIndices.map((row) => (
            <div
              key={row}
              className="absolute flex items-center justify-end text-[10px] tabular-nums"
              style={{
                top: row * CELL_HEIGHT,
                width: ROW_HEADER_WIDTH,
                height: CELL_HEIGHT,
                paddingRight: CELL_PADDING_X + 2,
                color: isRowActive(row) ? ACCENT : "rgba(0,0,0,0.28)",
              }}
            >
              {row + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Cells and selection share the panned layer so they never drift apart. */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
          transition: glide("transform"),
        }}
      >
        {contentCells}

        <div
          className="fade-in absolute pointer-events-none"
          style={{
            width: cursorDims.width,
            height: cursorDims.height,
            transform: `translate3d(${origin.x + cursorPos.x}px, ${
              origin.y + cursorPos.y
            }px, 0)`,
            transition: glide("transform"),
            border: `2px solid ${ACCENT}`,
            backgroundColor: "rgba(26, 115, 232, 0.04)",
            animationDelay: "200ms",
          }}
        >
          {/* Fill handle, as on a real selection. */}
          <div
            className="absolute -bottom-[3px] -right-[3px] h-[6px] w-[6px]"
            style={{ backgroundColor: ACCENT }}
          />
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {`Cell ${cellLabel(cursor)}`}
      </div>

      {/* Mobile controls, aligned to the grid's right edge. */}
      <div className="fixed bottom-10 right-10 md:hidden">
        <MobileControls onMove={move} />
      </div>

      {/* Keyboard hint, snapped to the grid origin and lifted off the lines. */}
      <div
        className="fade-in fixed bottom-10 hidden items-center gap-1.5 bg-white pr-3 text-[11px] tracking-wide text-black/30 md:flex"
        style={{ left: origin.x, animationDelay: "1.9s" }}
      >
        {["↑", "↓", "←", "→"].map((key) => (
          <kbd
            key={key}
            className="rounded-[2px] border border-black/10 px-1.5 py-0.5 text-[10px]"
          >
            {key}
          </kbd>
        ))}
        <span className="ml-1">to navigate</span>
      </div>
    </div>
  );
}

function MobileControls({ onMove }: { onMove: (dRow: number, dCol: number) => void }) {
  const button =
    "flex h-10 w-10 items-center justify-center rounded-[2px] border border-black/10 bg-white text-sm text-black/40 active:bg-black/5";

  return (
    <div className="grid grid-cols-3 gap-1">
      <div />
      <button className={button} onClick={() => onMove(-1, 0)} aria-label="Move up">
        ↑
      </button>
      <div />
      <button className={button} onClick={() => onMove(0, -1)} aria-label="Move left">
        ←
      </button>
      <button className={button} onClick={() => onMove(1, 0)} aria-label="Move down">
        ↓
      </button>
      <button className={button} onClick={() => onMove(0, 1)} aria-label="Move right">
        →
      </button>
    </div>
  );
}
