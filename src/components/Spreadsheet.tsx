"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import {
  CELLS,
  CELL_WIDTH,
  INITIAL_POSITION,
  INTRO_TARGET,
  TITLE_COL_SPAN,
  TITLE_ROW_HEIGHT,
  getCellDimensions,
  getCellPixelPosition,
} from "@/lib/grid";

// Grid origin offset — where row 0, col 0 sits on screen
const GRID_PADDING_X = 80;
const GRID_PADDING_Y = 80;

// Spring config for cursor movement — snappy but smooth
const springConfig = { stiffness: 500, damping: 38, mass: 0.8 };

export default function Spreadsheet() {
  const [cursor, setCursor] = useState(INITIAL_POSITION);
  const [introComplete, setIntroComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track the viewport offset (panning)
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const smoothPanX = useSpring(panX, { stiffness: 300, damping: 35, mass: 0.6 });
  const smoothPanY = useSpring(panY, { stiffness: 300, damping: 35, mass: 0.6 });

  // Cursor position springs
  const cursorPixel = getCellPixelPosition(cursor.row, cursor.col);
  const cursorDims = getCellDimensions(cursor.row, cursor.col);
  const cursorX = useSpring(cursorPixel.x + GRID_PADDING_X, springConfig);
  const cursorY = useSpring(cursorPixel.y + GRID_PADDING_Y, springConfig);
  const cursorW = useSpring(cursorDims.width, springConfig);
  const cursorH = useSpring(cursorDims.height, springConfig);

  // Divider line position
  const dividerRow1Pos = getCellPixelPosition(1, 1);
  const dividerY = dividerRow1Pos.y + TITLE_ROW_HEIGHT;

  // Intro animation sequence
  useEffect(() => {
    const showTimer = setTimeout(() => setShowCursor(true), 200);
    const moveTimer = setTimeout(() => {
      setCursor(INTRO_TARGET);
      setIntroComplete(true);
    }, 1400);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(moveTimer);
    };
  }, []);

  // Update cursor spring targets when cursor moves
  useEffect(() => {
    const pos = getCellPixelPosition(cursor.row, cursor.col);
    const dims = getCellDimensions(cursor.row, cursor.col);
    cursorX.set(pos.x + GRID_PADDING_X);
    cursorY.set(pos.y + GRID_PADDING_Y);
    cursorW.set(dims.width);
    cursorH.set(dims.height);
  }, [cursor, cursorX, cursorY, cursorW, cursorH]);

  // Keep cursor in viewport by panning
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = getCellPixelPosition(cursor.row, cursor.col);
    const dims = getCellDimensions(cursor.row, cursor.col);
    const cellRight = pos.x + GRID_PADDING_X + dims.width;
    const cellBottom = pos.y + GRID_PADDING_Y + dims.height;
    const cellLeft = pos.x + GRID_PADDING_X;
    const cellTop = pos.y + GRID_PADDING_Y;

    let newPanX = panX.get();
    let newPanY = panY.get();
    const margin = 40;

    if (cellRight + newPanX > rect.width - margin) {
      newPanX = rect.width - margin - cellRight;
    }
    if (cellLeft + newPanX < margin) {
      newPanX = margin - cellLeft;
    }
    if (cellBottom + newPanY > rect.height - margin) {
      newPanY = rect.height - margin - cellBottom;
    }
    if (cellTop + newPanY < margin) {
      newPanY = margin - cellTop;
    }

    panX.set(newPanX);
    panY.set(newPanY);
  }, [cursor, panX, panY]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!introComplete) return;

      const moves: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };

      const move = moves[e.key];
      if (!move) return;

      e.preventDefault();
      setCursor((prev) => ({
        row: Math.max(0, prev.row + move[0]),
        col: Math.max(0, prev.col + move[1]),
      }));
    },
    [introComplete]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Touch/swipe support
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || !introComplete) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const threshold = 30;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        setCursor((prev) => ({
          ...prev,
          col: Math.max(0, prev.col + (dx > 0 ? -1 : 1)),
        }));
      } else if (Math.abs(dy) > threshold) {
        setCursor((prev) => ({
          ...prev,
          row: Math.max(0, prev.row + (dy > 0 ? -1 : 1)),
        }));
      }

      touchStart.current = null;
    },
    [introComplete]
  );

  // Render content cells
  const contentCells = Object.entries(CELLS).map(([key, data]) => {
    const [row, col] = key.split(",").map(Number);
    const pos = getCellPixelPosition(row, col);
    const dims = getCellDimensions(row, col);

    return (
      <motion.div
        key={key}
        className="absolute flex items-center"
        style={{
          left: pos.x + GRID_PADDING_X,
          top: pos.y + GRID_PADDING_Y,
          width: dims.width,
          height: dims.height,
          paddingLeft: 6,
          paddingRight: 6,
          whiteSpace: "nowrap",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        {data.html ? (
          <span
            className={data.className}
            dangerouslySetInnerHTML={{ __html: data.content }}
          />
        ) : (
          <span className={data.className}>{data.content}</span>
        )}
      </motion.div>
    );
  });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-white"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="application"
      aria-label="Interactive spreadsheet navigation. Use arrow keys to move the selection cursor."
    >
      <motion.div
        className="absolute inset-0"
        style={{ x: smoothPanX, y: smoothPanY }}
      >
        {/* Thin divider line below the title */}
        <motion.div
          className="absolute bg-black/10"
          style={{
            left: GRID_PADDING_X + 4,
            top: dividerY + GRID_PADDING_Y,
            height: 1,
            width: CELL_WIDTH * TITLE_COL_SPAN - 8,
            transformOrigin: "left",
          }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
        />

        {/* Content cells */}
        {contentCells}

        {/* Selection cursor */}
        <AnimatePresence>
          {showCursor && (
            <motion.div
              className="absolute pointer-events-none"
              style={{
                x: cursorX,
                y: cursorY,
                width: cursorW,
                height: cursorH,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {/* Outer border */}
              <div
                className="absolute inset-0 rounded-[1px]"
                style={{
                  border: "2px solid rgb(26, 115, 232)",
                  boxShadow: "0 0 0 1px rgba(26, 115, 232, 0.1)",
                }}
              />
              {/* Corner handle (bottom-right) */}
              <div
                className="absolute -bottom-[3px] -right-[3px] w-[6px] h-[6px] rounded-[1px]"
                style={{ backgroundColor: "rgb(26, 115, 232)" }}
              />
              {/* Subtle fill */}
              <div
                className="absolute inset-0"
                style={{ backgroundColor: "rgba(26, 115, 232, 0.04)" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Mobile arrow controls */}
      <div className="fixed bottom-8 right-8 md:hidden">
        <MobileControls
          onMove={(dr, dc) => {
            if (!introComplete) return;
            setCursor((prev) => ({
              row: Math.max(0, prev.row + dr),
              col: Math.max(0, prev.col + dc),
            }));
          }}
        />
      </div>

      {/* Keyboard hint — fades away */}
      <AnimatePresence>
        {introComplete && (
          <motion.div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 text-[11px] text-black/25 tracking-wide"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <kbd className="px-1.5 py-0.5 rounded border border-black/10 text-[10px]">
              ↑
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-black/10 text-[10px]">
              ↓
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-black/10 text-[10px]">
              ←
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-black/10 text-[10px]">
              →
            </kbd>
            <span className="ml-1">to navigate</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileControls({ onMove }: { onMove: (dr: number, dc: number) => void }) {
  const btnClass =
    "w-10 h-10 flex items-center justify-center rounded-lg bg-black/5 active:bg-black/10 text-black/40 text-sm transition-colors";

  return (
    <div className="grid grid-cols-3 gap-1">
      <div />
      <button className={btnClass} onClick={() => onMove(-1, 0)} aria-label="Move up">
        ↑
      </button>
      <div />
      <button className={btnClass} onClick={() => onMove(0, -1)} aria-label="Move left">
        ←
      </button>
      <button className={btnClass} onClick={() => onMove(1, 0)} aria-label="Move down">
        ↓
      </button>
      <button className={btnClass} onClick={() => onMove(0, 1)} aria-label="Move right">
        →
      </button>
    </div>
  );
}
