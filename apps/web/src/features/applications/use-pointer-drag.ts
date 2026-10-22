'use client';

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** Where a dragged card would be dropped: a column, and the card it would land above (none = end). */
export interface DropTarget<TColumn extends string> {
  column: TColumn;
  beforeId?: string;
}

/** The card being dragged, with its size so the floating copy matches it. */
export interface ActiveDrag {
  id: string;
  width: number;
  height: number;
}

interface Options<TColumn extends string> {
  /** Horizontally scrolling container of the columns (auto-scrolled near its edges). */
  scrollRef: RefObject<HTMLElement | null>;
  /**
   * Target for the pointer over a card (`hovered`; `lowerHalf`: below its middle) or over a column's empty space.
   * `draggedId` is the card being dragged.
   */
  resolveTarget: (
    column: TColumn,
    hovered: { id: string; lowerHalf: boolean } | undefined,
    draggedId: string,
  ) => DropTarget<TColumn>;
  onDrop: (id: string, target: DropTarget<TColumn>) => void;
}

/** Mouse/pen: a click until the pointer moves this far (px), then a drag. */
const MOUSE_SLOP = 5;
/** Touch: hold this long (ms) without moving to pick a card up; moving earlier scrolls the page as usual. */
const TOUCH_DELAY = 200;
const TOUCH_SLOP = 8;
/** Distance from an edge (px) where auto-scrolling starts, and its top speed (px per frame). */
const EDGE = 56;
const MAX_SPEED = 18;

interface Gesture {
  id: string;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Pointer position inside the card, so the copy stays under the finger where it was grabbed. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  active: boolean;
  touchTimer?: ReturnType<typeof setTimeout>;
}

/**
 * @description Drag and drop with Pointer Events, the way libraries such as dnd-kit do it, without a library:
 * - a full copy of the card follows the pointer (rendered by the caller at `overlayRef`, positioned here
 *   without re-rendering React on every move);
 * - the drop target comes from what is under the pointer (`[data-drag-id]` cards, `[data-drop-column]` columns);
 * - works with mouse, pen and touch (hold briefly to pick up), scrolls near edges, Escape cancels, and the click
 *   that ends a drag doesn't open the card's link.
 * Keyboard and screen-reader users have another way to move cards (the column select); this is pointer-only.
 */
export function usePointerDrag<TColumn extends string>({
  scrollRef,
  resolveTarget,
  onDrop,
}: Options<TColumn>) {
  const [active, setActive] = useState<ActiveDrag | null>(null);
  const [target, setTarget] = useState<DropTarget<TColumn> | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const targetRef = useRef<DropTarget<TColumn> | null>(null);
  const frame = useRef<number | null>(null);
  const suppressClick = useRef(false);
  // Latest callbacks, read from the window listeners without re-binding them (updated after each render).
  const callbacks = useRef({ resolveTarget, onDrop });
  useLayoutEffect(() => {
    callbacks.current = { resolveTarget, onDrop };
  });

  const placeOverlay = useCallback(() => {
    const g = gesture.current;
    const overlay = overlayRef.current;
    if (!g || !overlay) return;
    overlay.style.transform = `translate3d(${g.x - g.offsetX}px, ${g.y - g.offsetY}px, 0)`;
  }, []);

  /** What is under the pointer. The copy has `pointer-events: none`, so it is never the hit. */
  const hitTest = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    const element = document.elementFromPoint(g.x, g.y);
    const columnElement = element?.closest<HTMLElement>('[data-drop-column]');
    let next: DropTarget<TColumn> | null = null;
    if (columnElement) {
      const column = columnElement.dataset.dropColumn as TColumn;
      const card = element?.closest<HTMLElement>('[data-drag-id]');
      if (card) {
        const rect = card.getBoundingClientRect();
        next = callbacks.current.resolveTarget(
          column,
          { id: card.dataset.dragId!, lowerHalf: g.y > rect.top + rect.height / 2 },
          g.id,
        );
      } else {
        next = callbacks.current.resolveTarget(column, undefined, g.id);
      }
    }
    const previous = targetRef.current;
    if (previous?.column !== next?.column || previous?.beforeId !== next?.beforeId) {
      targetRef.current = next;
      setTarget(next);
    }
  }, []);

  /** One frame: move the copy, scroll if near an edge, then re-check the target (scrolling moves things). */
  // Named so the frame can schedule the next one while auto-scrolling.
  const tick = useCallback(
    function step() {
      frame.current = null;
      const g = gesture.current;
      if (!g?.active) return;
      placeOverlay();
      let scrolled = false;
      const container = scrollRef.current;
      if (container && container.scrollWidth > container.clientWidth) {
        const rect = container.getBoundingClientRect();
        const speed = edgeSpeed(g.x - rect.left, rect.right - g.x);
        if (speed !== 0) {
          container.scrollLeft += speed;
          scrolled = true;
        }
      }
      const vertical = edgeSpeed(g.y, window.innerHeight - g.y);
      if (vertical !== 0) {
        window.scrollBy(0, vertical);
        scrolled = true;
      }
      hitTest();
      // Keep scrolling while the pointer rests near an edge.
      if (scrolled) frame.current = requestAnimationFrame(step);
    },
    [hitTest, placeOverlay, scrollRef],
  );

  const schedule = useCallback(() => {
    frame.current ??= requestAnimationFrame(tick);
  }, [tick]);

  const end = useCallback((drop: boolean) => {
    const g = gesture.current;
    if (!g) return;
    clearTimeout(g.touchTimer);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (g.active) {
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
      // The click that follows pointerup would open the card's link.
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      if (drop && targetRef.current) callbacks.current.onDrop(g.id, targetRef.current);
    }
    gesture.current = null;
    targetRef.current = null;
    setActive(null);
    setTarget(null);
  }, []);

  const activate = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    g.active = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    setActive({ id: g.id, width: g.width, height: g.height });
    hitTest();
  }, [hitTest]);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      g.x = event.clientX;
      g.y = event.clientY;
      const distance = Math.hypot(g.x - g.startX, g.y - g.startY);
      if (!g.active) {
        if (g.pointerType === 'touch') {
          // Moved before the hold finished: it's a scroll, not a drag.
          if (distance > TOUCH_SLOP) end(false);
          return;
        }
        if (distance < MOUSE_SLOP) return;
        activate();
      }
      schedule();
    }
    // Once a touch drag has started, stop the page from scrolling under the finger.
    function onTouchMove(event: TouchEvent) {
      if (gesture.current?.active) event.preventDefault();
    }
    const onUp = (event: PointerEvent) => event.pointerId === gesture.current?.pointerId && end(true);
    const onCancel = (event: PointerEvent) => event.pointerId === gesture.current?.pointerId && end(false);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && gesture.current?.active && end(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchmove', onTouchMove);
      end(false);
    };
  }, [activate, end, schedule]);

  // Put the copy under the pointer before the browser paints it (no flash at the top-left corner).
  useLayoutEffect(() => {
    if (active) placeOverlay();
  }, [active, placeOverlay]);

  /** Props for a draggable card element. */
  function dragHandleProps(id: string) {
    return {
      'data-drag-id': id,
      onPointerDown(event: ReactPointerEvent<HTMLElement>) {
        // Primary button only; the card's own controls (the column select) keep working.
        if (event.button !== 0 || gesture.current) return;
        if ((event.target as HTMLElement).closest('select, button, input, textarea')) return;
        const rect = event.currentTarget.getBoundingClientRect();
        gesture.current = {
          id,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          width: rect.width,
          height: rect.height,
          active: false,
        };
        if (event.pointerType === 'touch') gesture.current.touchTimer = setTimeout(activate, TOUCH_DELAY);
      },
      onClickCapture(event: ReactMouseEvent) {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
      },
      // Links and text are natively draggable; that would cancel the pointer gesture.
      onDragStart(event: ReactMouseEvent) {
        event.preventDefault();
      },
    };
  }

  return { active, target, overlayRef, dragHandleProps };
}

/**
 * @description Auto-scroll speed from the distances to the two edges: negative near the start edge, positive
 * near the end edge, faster closer to it, 0 elsewhere.
 */
function edgeSpeed(toStart: number, toEnd: number): number {
  if (toStart < EDGE) return -Math.ceil(((EDGE - Math.max(toStart, 0)) / EDGE) * MAX_SPEED);
  if (toEnd < EDGE) return Math.ceil(((EDGE - Math.max(toEnd, 0)) / EDGE) * MAX_SPEED);
  return 0;
}
