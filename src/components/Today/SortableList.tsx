import React, { useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mui/joy';

export interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  style: React.CSSProperties;
}

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  renderItem: (item: T, handle: DragHandleProps, dragging: boolean) => React.ReactNode;
  onReorder: (orderedIds: string[]) => void;
}

interface DragState {
  id: string;
  from: number;
  startPageY: number;
  dy: number;
  tops: number[]; // page-space top of each row at drag start
  heights: number[];
}

/**
 * Vertical list you reorder by dragging a handle. The dragged row lifts and follows
 * the pointer; the rows it passes slide out of the way. Pointer events, so finger,
 * stylus and mouse all work.
 */
export function SortableList<T>({ items, getId, renderItem, onReorder }: SortableListProps<T>) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settling, setSettling] = useState(false); // one frame without transitions after a drop

  useLayoutEffect(() => {
    if (!settling) return;
    const id = requestAnimationFrame(() => setSettling(false));
    return () => cancelAnimationFrame(id);
  }, [settling]);

  const targetIndex = (d: DragState) => {
    const center = d.tops[d.from] + d.heights[d.from] / 2 + d.dy;
    let over = 0;
    d.tops.forEach((top, i) => {
      if (i !== d.from && center > top + d.heights[i] / 2) over++;
    });
    return over;
  };

  const shiftFor = (i: number, d: DragState, over: number) => {
    const h = d.heights[d.from];
    if (d.from < over && i > d.from && i <= over) return -h;
    if (d.from > over && i >= over && i < d.from) return h;
    return 0;
  };

  const handleFor = (index: number, id: string): DragHandleProps => ({
    style: { touchAction: 'none', cursor: drag ? 'grabbing' : 'grab' },
    onPointerDown: e => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const rects = rowRefs.current.slice(0, items.length).map(el => el?.getBoundingClientRect());
      setDrag({
        id,
        from: index,
        startPageY: e.clientY + window.scrollY,
        dy: 0,
        tops: rects.map(r => (r ? r.top + window.scrollY : 0)),
        heights: rects.map(r => r?.height ?? 0),
      });
    },
    onPointerMove: e => {
      if (!drag || drag.id !== id) return;
      // Nudge the page when dragging near the top/bottom edge
      if (e.clientY < 72) window.scrollBy(0, -12);
      else if (e.clientY > window.innerHeight - 72) window.scrollBy(0, 12);
      setDrag({ ...drag, dy: e.clientY + window.scrollY - drag.startPageY });
    },
    onPointerUp: () => {
      if (!drag || drag.id !== id) return;
      const over = targetIndex(drag);
      setDrag(null);
      if (over === drag.from) return;
      const ids = items.map(getId);
      const [moved] = ids.splice(drag.from, 1);
      ids.splice(over, 0, moved);
      setSettling(true);
      onReorder(ids);
    },
    onPointerCancel: () => setDrag(null),
  });

  const over = drag ? targetIndex(drag) : -1;

  return (
    <>
      {items.map((item, i) => {
        const id = getId(item);
        const isDragged = drag?.id === id;
        const y = drag ? (isDragged ? drag.dy : shiftFor(i, drag, over)) : 0;
        return (
          <Box
            key={id}
            ref={(el: HTMLDivElement | null) => {
              rowRefs.current[i] = el;
            }}
            sx={{
              position: 'relative',
              zIndex: isDragged ? 10 : 'auto',
              transform: y ? `translateY(${y}px)` : undefined,
              transition: isDragged || settling || !drag ? 'none' : 'transform 160ms ease',
              bgcolor: 'background.body',
              ...(isDragged && {
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                outline: '2px solid #000',
                bgcolor: 'background.surface',
              }),
            }}
          >
            {renderItem(item, handleFor(i, id), isDragged)}
          </Box>
        );
      })}
    </>
  );
}
