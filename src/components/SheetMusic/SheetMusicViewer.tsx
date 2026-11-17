import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Button, CircularProgress, IconButton, ToggleButtonGroup, Typography } from '@mui/joy';
import { ChevronLeft, ChevronRight, Eraser, Hand, Highlighter, PenLine, Trash2, Undo2, X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { AnnotationStroke, Goal, SheetMusicAnnotations } from '../../types';
import { loadAnnotations, loadSheetMusicPdf, saveAnnotations } from '../../services/sheetMusic';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type Tool = 'view' | 'pen' | 'highlighter' | 'eraser';
type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

const PEN_WIDTH = 0.0025; // fraction of page width
const HIGHLIGHTER_WIDTH = 0.018;
const ERASER_RADIUS_PX = 14;
const SAVE_DEBOUNCE_MS = 1500;
const TAP_MAX_MS = 300;
const TAP_MAX_MOVE_PX = 12;

const pageKey = (goalId: string) => `sheetMusic:page:${goalId}`;

const readSavedPage = (goalId: string) => {
  try {
    return Number(localStorage.getItem(pageKey(goalId))) || 1;
  } catch {
    return 1;
  }
};

const drawStroke = (ctx: CanvasRenderingContext2D, s: AnnotationStroke, w: number, h: number) => {
  const pts = s.points;
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, s.width * w);
  if (s.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.45)';
  } else {
    ctx.strokeStyle = '#000';
  }
  ctx.beginPath();
  ctx.moveTo(pts[0] * w, pts[1] * h);
  if (pts.length === 2) ctx.lineTo(pts[0] * w + 0.01, pts[1] * h); // a dot
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * w, pts[i + 1] * h);
  ctx.stroke();
  ctx.restore();
};

interface SheetMusicViewerProps {
  uid: string;
  goal: Goal;
  onClose: () => void;
  /** Rendered at the right end of the toolbar, e.g. the section timer. */
  toolbarExtra?: React.ReactNode;
}

/**
 * Full-screen PDF viewer with pen/highlighter annotations, tuned for a
 * stylus tablet: once a pen is detected, fingers never draw (palm rejection)
 * and a quick finger tap on the left/right half turns the page. Arrow and
 * PageUp/PageDown keys (Bluetooth page-turn pedals) also turn pages.
 */
export const SheetMusicViewer: React.FC<SheetMusicViewerProps> = ({ uid, goal, onClose, toolbarExtra }) => {
  const sheetMusic = goal.sheetMusic;

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(() => readSavedPage(goal.id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('view');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [confirmClear, setConfirmClear] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 }); // available space
  const [pageCss, setPageCss] = useState({ w: 0, h: 0 }); // rendered page size in CSS px
  const [, forceRender] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const annotationsRef = useRef<SheetMusicAnnotations>({ version: 1, pages: {} });
  const annotationsLoadedRef = useRef(false);
  const undoRef = useRef<Record<number, AnnotationStroke[][]>>({});
  const currentStrokeRef = useRef<AnnotationStroke | null>(null);
  const penSeenRef = useRef(false);
  const tapRef = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  // Mirrors of state for use inside async/rAF callbacks
  const pageRef = useRef(page);
  const pageCssRef = useRef(pageCss);
  pageRef.current = page;

  // ---------- Loading ----------
  useEffect(() => {
    if (!sheetMusic) return;
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    setLoadError(null);

    (async () => {
      try {
        const [bytes, annotations] = await Promise.all([
          loadSheetMusicPdf(sheetMusic),
          loadAnnotations(uid, goal.id).catch(err => {
            console.error('Could not load annotations', err);
            return null;
          }),
        ]);
        if (cancelled) return;
        if (annotations) {
          annotationsRef.current = annotations;
          annotationsLoadedRef.current = true;
        }
        doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdf(doc);
        setNumPages(doc.numPages);
        setPage(p => Math.min(Math.max(1, p), doc!.numPages));
      } catch (err: any) {
        console.error('Failed to load sheet music', err);
        if (!cancelled) setLoadError(err?.message || 'Could not load the sheet music.');
      }
    })();

    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [sheetMusic?.storagePath, uid, goal.id]);

  // ---------- Saving ----------
  const flushSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!dirtyRef.current) return;
    // Never overwrite saved annotations if we failed to load them.
    if (!annotationsLoadedRef.current) {
      setSaveStatus('error');
      return;
    }
    dirtyRef.current = false;
    setSaveStatus('saving');
    try {
      await saveAnnotations(uid, goal.id, annotationsRef.current);
      setSaveStatus(dirtyRef.current ? 'pending' : 'saved');
    } catch (err) {
      console.error('Failed to save annotations', err);
      dirtyRef.current = true;
      setSaveStatus('error');
    }
  }, [uid, goal.id]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus('pending');
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  useEffect(() => () => void flushSave(), [flushSave]);

  const handleClose = async () => {
    await flushSave();
    onClose();
  };

  // ---------- Layout ----------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setBox({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(pageKey(goal.id), String(page));
    } catch {
      /* ignore */
    }
  }, [goal.id, page]);

  // ---------- Ink ----------
  const pageStrokes = (p: number) => annotationsRef.current.pages[String(p)] || [];

  const redrawInk = useCallback(() => {
    const canvas = inkCanvasRef.current;
    const { w, h } = pageCssRef.current;
    if (!canvas || !w) return;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of pageStrokes(pageRef.current)) drawStroke(ctx, s, w, h);
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current, w, h);
  }, []);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redrawInk();
    });
  }, [redrawInk]);

  // ---------- PDF rendering ----------
  useEffect(() => {
    if (!pdf || !box.w || !box.h) return;
    let cancelled = false;

    (async () => {
      const pdfPage = await pdf.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(box.w / base.width, box.h / base.height);
      const cssW = Math.floor(base.width * scale);
      const cssH = Math.floor(base.height * scale);
      const dpr = window.devicePixelRatio || 1;
      const viewport = pdfPage.getViewport({ scale: scale * dpr });

      const canvas = pdfCanvasRef.current;
      const ink = inkCanvasRef.current;
      if (!canvas || !ink) return;

      renderTaskRef.current?.cancel();
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      ink.width = canvas.width;
      ink.height = canvas.height;
      pageCssRef.current = { w: cssW, h: cssH };
      setPageCss({ w: cssW, h: cssH });
      redrawInk();

      const task = pdfPage.render({ canvasContext: canvas.getContext('2d')!, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') console.error(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, page, box, redrawInk]);

  // ---------- Navigation ----------
  const goTo = useCallback(
    (p: number) => {
      if (!numPages) return;
      setPage(Math.min(numPages, Math.max(1, p)));
      setConfirmClear(false);
    },
    [numPages]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        goTo(page + 1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        goTo(page - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, page]);

  // ---------- Pointer handling ----------
  const toNormalized = (e: React.PointerEvent | PointerEvent) => {
    const rect = inkCanvasRef.current!.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const pushUndo = () => {
    const stack = (undoRef.current[page] ||= []);
    stack.push([...pageStrokes(page)]);
    if (stack.length > 50) stack.shift();
  };

  const setPageStrokes = (strokes: AnnotationStroke[]) => {
    annotationsRef.current = {
      ...annotationsRef.current,
      pages: { ...annotationsRef.current.pages, [String(page)]: strokes },
    };
  };

  const eraseAt = (e: React.PointerEvent | PointerEvent) => {
    const [nx, ny] = toNormalized(e);
    const rx = ERASER_RADIUS_PX / pageCss.w;
    const ry = ERASER_RADIUS_PX / pageCss.h;
    const strokes = pageStrokes(page);
    const kept = strokes.filter(s => {
      for (let i = 0; i < s.points.length; i += 2) {
        const dx = (s.points[i] - nx) / rx;
        const dy = (s.points[i + 1] - ny) / ry;
        if (dx * dx + dy * dy <= 1) return false;
      }
      return true;
    });
    if (kept.length !== strokes.length) {
      setPageStrokes(kept);
      markDirty();
      scheduleRedraw();
    }
  };

  const isDrawingPointer = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') penSeenRef.current = true;
    if (tool === 'view') return false;
    // Palm rejection: once a stylus has been used, fingers only navigate.
    return !(e.pointerType === 'touch' && penSeenRef.current);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingPointer(e)) {
      tapRef.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'eraser') {
      pushUndo();
      eraseAt(e);
      return;
    }
    const [x, y] = toNormalized(e);
    currentStrokeRef.current = {
      tool: tool === 'highlighter' ? 'highlighter' : 'pen',
      width: tool === 'highlighter' ? HIGHLIGHTER_WIDTH : PEN_WIDTH,
      points: [x, y],
    };
    scheduleRedraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'eraser' && e.buttons && e.currentTarget.hasPointerCapture(e.pointerId)) {
      eraseAt(e);
      return;
    }
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events) {
      const [x, y] = toNormalized(ev);
      stroke.points.push(Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000);
    }
    scheduleRedraw();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const tap = tapRef.current;
    if (tap && tap.id === e.pointerId) {
      tapRef.current = null;
      const quick = performance.now() - tap.t < TAP_MAX_MS;
      const still = Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < TAP_MAX_MOVE_PX;
      if (quick && still) {
        const rect = e.currentTarget.getBoundingClientRect();
        goTo(e.clientX - rect.left < rect.width / 2 ? page - 1 : page + 1);
      }
      return;
    }
    const stroke = currentStrokeRef.current;
    if (stroke) {
      currentStrokeRef.current = null;
      pushUndo();
      setPageStrokes([...pageStrokes(page), stroke]);
      markDirty();
      scheduleRedraw();
      forceRender(n => n + 1); // refresh undo button state
    }
  };

  const onPointerCancel = () => {
    tapRef.current = null;
    currentStrokeRef.current = null;
    scheduleRedraw();
  };

  const undo = () => {
    const prev = undoRef.current[page]?.pop();
    if (!prev) return;
    setPageStrokes(prev);
    markDirty();
    redrawInk();
    forceRender(n => n + 1);
  };

  const clearPage = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    pushUndo();
    setPageStrokes([]);
    markDirty();
    redrawInk();
    setConfirmClear(false);
  };

  const canUndo = (undoRef.current[page]?.length || 0) > 0;
  const saveLabel: Record<SaveStatus, string> = {
    saved: 'Saved',
    pending: 'Unsaved',
    saving: 'Saving…',
    error: 'Not saved',
  };

  // Lock page scroll behind the viewer while it is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ---------- UI ----------
  const touchBtn = { minWidth: 44, minHeight: 44 };

  // Portal to <body> so no ancestor's stacking context (cards, accordions)
  // can paint over the viewer. The metronome (z 1100) still floats above it.
  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        isolation: 'isolate',
        bgcolor: '#fff',
        color: '#000',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          py: 0.5,
          borderBottom: '2px solid #000',
          flexWrap: 'wrap',
        }}
      >
        <IconButton variant="outlined" onClick={handleClose} aria-label="Close sheet music" sx={touchBtn}>
          <X size={22} />
        </IconButton>
        <Typography level="title-md" noWrap sx={{ minWidth: 0, flexShrink: 1, maxWidth: 220 }}>
          {goal.name}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton variant="outlined" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Previous page" sx={touchBtn}>
            <ChevronLeft size={22} />
          </IconButton>
          <Typography level="body-md" sx={{ minWidth: 64, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {numPages ? `${page} / ${numPages}` : '–'}
          </Typography>
          <IconButton
            variant="outlined"
            onClick={() => goTo(page + 1)}
            disabled={!numPages || page >= numPages}
            aria-label="Next page"
            sx={touchBtn}
          >
            <ChevronRight size={22} />
          </IconButton>
        </Box>

        <ToggleButtonGroup
          value={tool}
          onChange={(_, v) => v && setTool(v as Tool)}
          variant="outlined"
          sx={{ '& button[aria-pressed="true"]': { bgcolor: '#000', color: '#fff' } }}
        >
          <IconButton value="view" aria-label="Turn pages" sx={touchBtn}>
            <Hand size={20} />
          </IconButton>
          <IconButton value="pen" aria-label="Pen" sx={touchBtn}>
            <PenLine size={20} />
          </IconButton>
          <IconButton value="highlighter" aria-label="Highlighter" sx={touchBtn}>
            <Highlighter size={20} />
          </IconButton>
          <IconButton value="eraser" aria-label="Eraser" sx={touchBtn}>
            <Eraser size={20} />
          </IconButton>
        </ToggleButtonGroup>

        <IconButton variant="outlined" onClick={undo} disabled={!canUndo} aria-label="Undo" sx={touchBtn}>
          <Undo2 size={20} />
        </IconButton>
        <Button
          variant={confirmClear ? 'solid' : 'outlined'}
          color="neutral"
          onClick={clearPage}
          startDecorator={<Trash2 size={18} />}
          sx={{ minHeight: 44 }}
        >
          {confirmClear ? 'Tap to clear page' : 'Clear'}
        </Button>
        <Typography level="body-xs" sx={{ color: saveStatus === 'error' ? '#000' : '#555', fontWeight: saveStatus === 'error' ? 700 : 400 }}>
          {saveLabel[saveStatus]}
        </Typography>

        <Box sx={{ flex: 1 }} />
        {toolbarExtra}
      </Box>

      {/* Page */}
      <Box
        ref={containerRef}
        sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: 1 }}
      >
        {loadError ? (
          <Typography>{loadError}</Typography>
        ) : !pdf ? (
          <CircularProgress />
        ) : null}
        <Box sx={{ position: 'relative', width: pageCss.w, height: pageCss.h, display: pdf && !loadError ? 'block' : 'none' }}>
          <canvas ref={pdfCanvasRef} style={{ width: pageCss.w, height: pageCss.h, display: 'block' }} />
          <canvas
            ref={inkCanvasRef}
            style={{ position: 'absolute', inset: 0, width: pageCss.w, height: pageCss.h, touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        </Box>
      </Box>
    </Box>,
    document.body
  );
};

export default SheetMusicViewer;
