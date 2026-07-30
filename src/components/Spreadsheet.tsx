"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CELLS,
  CELL_PADDING_X,
  INITIAL_POSITION,
  INTRO_TARGET,
  type CellPosition,
  cellLabel,
  getCellDimensions,
  getCellPixelPosition,
  getGridOrigin,
  moveCursor,
} from "@/lib/grid";

/**
 * The grid is never drawn. The cursor is the only thing that reveals it, so it
 * glides rather than snaps — the movement between cells is the whole tell.
 */
const EASING = "cubic-bezier(0.2, 0, 0, 1)";
const DURATION = 200;

/** Breathing room kept between the cursor and the viewport edge when panning. */
const EDGE_MARGIN = 40;

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

  // The grid fills a fixed inset-0 box, so the window *is* the viewport.
  // Reading it directly avoids depending on element layout having settled —
  // measuring the container yielded a 0x0 rect and stranded the pan off-grid.
  useEffect(() => {
    const measure = () => {
      const size = { width: window.innerWidth, height: window.innerHeight };
      if (size.width <= 0 || size.height <= 0) return;

      const prev = viewportRef.current;
      if (prev && prev.width === size.width && prev.height === size.height) return;

      viewportRef.current = size;
      setViewport(size);
      setView((view) => {
        const pan = settlePan(view.cursor, view.pan, size);
        return pan === view.pan ? view : { ...view, pan };
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
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
  const contentCells = useMemo(() => renderContentCells(origin), [origin]);

  // Everything on the page shares one left edge — the hint included.
  const contentLeft =
    origin.x + getCellPixelPosition(0, INITIAL_POSITION.col).x + CELL_PADDING_X;

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-white"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="application"
      aria-label="Interactive spreadsheet. Use arrow keys to move the selection."
    >
      {/* Cells and cursor share the panned layer so they never drift apart. */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
          transition: glide("transform"),
        }}
      >
        {contentCells}

        {/* The only thing that ever reveals the grid. */}
        <div
          className="fade-in absolute pointer-events-none rounded-[3px]"
          style={{
            width: cursorDims.width,
            height: cursorDims.height,
            transform: `translate3d(${origin.x + cursorPos.x}px, ${
              origin.y + cursorPos.y
            }px, 0)`,
            transition: glide("transform"),
            border: "1px solid rgba(0, 0, 0, 0.55)",
            backgroundColor: "rgba(0, 0, 0, 0.015)",
            animationDelay: "200ms",
          }}
        />
      </div>

      <div aria-live="polite" className="sr-only">
        {`Cell ${cellLabel(cursor)}`}
      </div>

      {/* Touch fallback for the arrow keys. Quiet enough to read as nothing. */}
      <div className="fixed bottom-8 right-6 md:hidden">
        <MobileControls onMove={move} />
      </div>

      {/*
        The one hint that the page is navigable. Without it the signature
        interaction is undiscoverable, so it stays — as text, not as chrome.
      */}
      <div
        className="fade-in fixed bottom-10 hidden items-center gap-2 text-[11px] text-black/25 md:flex"
        style={{ left: contentLeft, animationDelay: "2.2s" }}
      >
        <span className="tracking-[0.25em]">↑↓←→</span>
        <span>to navigate</span>
      </div>
    </div>
  );
}

function MobileControls({ onMove }: { onMove: (dRow: number, dCol: number) => void }) {
  const button =
    "flex h-11 w-11 items-center justify-center text-sm text-black/20 active:text-black/50";

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
