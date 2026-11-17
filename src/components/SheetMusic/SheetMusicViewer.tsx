import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, CircularProgress, IconButton, ToggleButtonGroup, Typography } from '@mui/joy';
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Hand,
  Highlighter,
  Maximize2,
  Minimize2,
  PenLine,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { AnnotationStroke, SheetMusicAnnotations, SheetMusicOwner } from '../../types';
import { loadAnnotations, loadSheetMusicPdf, saveAnnotations } from '../../services/sheetMusic';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type Tool = 'view' | 'pen' | 'highlighter' | 'eraser';
type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

/** z = 1 means the page fills the screen width; ox/oy is the page's top-left corner in screen px. */
interface View {
  z: number;
  ox: number;
  oy: number;
}

const PEN_WIDTH = 0.0025; // fraction of page width at fit-width zoom
const HIGHLIGHTER_WIDTH = 0.018;
const ERASER_RADIUS_PX = 14;
const MAX_ZOOM = 5;
const SAVE_DEBOUNCE_MS = 1500;
const RERENDER_DEBOUNCE_MS = 120;
const TAP_MAX_MS = 300;
const TAP_MAX_MOVE_PX = 10;
const SWIPE_MIN_PX = 60;
const SWIPE_MAX_MS = 700;
const EDGE_TAP_FRACTION = 0.18; // outer 18% on each side turns pages

const pageKey = (owner: SheetMusicOwner) => `sheetMusic:page:${owner.kind}:${owner.id}`;

const readSavedPage = (owner: SheetMusicOwner) => {
  try {
    return Number(localStorage.getItem(pageKey(owner))) || 1;
  } catch {
    return 1;
  }
};

const drawStroke = (ctx: CanvasRenderingContext2D, s: AnnotationStroke, ox: number, oy: number, pw: number, ph: number) => {
  const pts = s.points;
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, s.width * pw);
  if (s.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.45)';
  } else {
    ctx.strokeStyle = '#000';
  }
  ctx.beginPath();
  ctx.moveTo(ox + pts[0] * pw, oy + pts[1] * ph);
  if (pts.length === 2) ctx.lineTo(ox + pts[0] * pw + 0.01, oy + pts[1] * ph); // a dot
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(ox + pts[i] * pw, oy + pts[i + 1] * ph);
  ctx.stroke();
  ctx.restore();
};

interface SheetMusicViewerProps {
  uid: string;
  /** The goal or repertoire piece whose sheet music to show */
  owner: SheetMusicOwner;
  onClose: () => void;
  /** Rendered at the right end of the toolbar, e.g. the section timer. */
  toolbarExtra?: React.ReactNode;
}

/**
 * Full-screen PDF viewer with pen/highlighter annotations, built for a stylus tablet.
 *
 * Hand mode: swipe left/right to turn pages, pinch to zoom, drag to pan,
 * tap the middle to hide/show the toolbar, tap the outer edges to turn pages.
 * Drawing modes: once a stylus has been used, one finger never draws (palm
 * rejection); two fingers still pinch and pan so you can zoom while annotating.
 * Arrow and PageUp/PageDown keys (Bluetooth page-turn pedals) also turn pages.
 */
export const SheetMusicViewer: React.FC<SheetMusicViewerProps> = ({ uid, owner, onClose, toolbarExtra }) => {
  const sheetMusic = owner.sheetMusic;
  const ownerRef = { kind: owner.kind, id: owner.id };

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(() => readSavedPage(owner));
  const [pageReady, setPageReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('view');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [confirmClear, setConfirmClear] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [zoomedIn, setZoomedIn] = useState(false); // for the fit button's icon
  const [, forceRender] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const pdfPageRef = useRef<PDFPageProxy | null>(null);

  // Geometry (refs, so gestures never wait on React renders)
  const sizeRef = useRef({ cw: 0, ch: 0 }); // container CSS px
  const aspectRef = useRef(1.294); // page height / width
  const viewRef = useRef<View>({ z: 1, ox: 0, oy: 0 });
  const renderedViewRef = useRef<View | null>(null); // view the pdf bitmap was rendered at
  const rerenderTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const annotationsRef = useRef<SheetMusicAnnotations>({ version: 1, pages: {} });
  const annotationsLoadedRef = useRef(false);
  const undoRef = useRef<Record<number, AnnotationStroke[][]>>({});
  const currentStrokeRef = useRef<{ pointerId: number; stroke: AnnotationStroke } | null>(null);
  const penSeenRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  // Touch/mouse gesture tracking
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const singleRef = useRef<{ id: number; x: number; y: number; t: number; view: View; moved: boolean } | null>(null);
  const pinchRef = useRef<{ d: number; mx: number; my: number; view: View } | null>(null);
  const erasingRef = useRef<number | null>(null);

  const pageRef = useRef(page);
  const toolRef = useRef(tool);
  const numPagesRef = useRef(numPages);
  pageRef.current = page;
  toolRef.current = tool;
  numPagesRef.current = numPages;

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
          loadAnnotations(uid, ownerRef).catch(err => {
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
  }, [sheetMusic?.storagePath, uid, owner.kind, owner.id]);

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
      await saveAnnotations(uid, { kind: owner.kind, id: owner.id }, annotationsRef.current);
      setSaveStatus(dirtyRef.current ? 'pending' : 'saved');
    } catch (err) {
      console.error('Failed to save annotations', err);
      dirtyRef.current = true;
      setSaveStatus('error');
    }
  }, [uid, owner.kind, owner.id]);

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

  useEffect(() => {
    try {
      localStorage.setItem(pageKey(owner), String(page));
    } catch {
      /* ignore */
    }
  }, [owner.kind, owner.id, page]);

  // Lock page scroll behind the viewer while it is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ---------- Geometry helpers ----------
  const pageSize = (z: number) => {
    const pw = sizeRef.current.cw * z;
    return { pw, ph: pw * aspectRef.current };
  };

  /** Smallest zoom: the whole page fits on screen. */
  const minZoom = () => {
    const { cw, ch } = sizeRef.current;
    if (!cw || !ch) return 1;
    return Math.min(1, ch / (cw * aspectRef.current));
  };

  const clampView = (v: View): View => {
    const { cw, ch } = sizeRef.current;
    const z = Math.min(MAX_ZOOM, Math.max(minZoom(), v.z));
    const { pw, ph } = pageSize(z);
    const ox = pw <= cw ? (cw - pw) / 2 : Math.min(0, Math.max(cw - pw, v.ox));
    const oy = ph <= ch ? (ch - ph) / 2 : Math.min(0, Math.max(ch - ph, v.oy));
    return { z, ox, oy };
  };

  const canPanX = (v: View) => pageSize(v.z).pw > sizeRef.current.cw + 1;

  // ---------- Drawing ----------
  const pageStrokes = (p: number) => annotationsRef.current.pages[String(p)] || [];

  const redrawInk = () => {
    const canvas = inkCanvasRef.current;
    const { cw, ch } = sizeRef.current;
    if (!canvas || !cw) return;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(canvas.width / cw, 0, 0, canvas.height / ch, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const { z, ox, oy } = viewRef.current;
    const { pw, ph } = pageSize(z);
    for (const s of pageStrokes(pageRef.current)) drawStroke(ctx, s, ox, oy, pw, ph);
    const cur = currentStrokeRef.current;
    if (cur) drawStroke(ctx, cur.stroke, ox, oy, pw, ph);
  };

  /** Render the visible part of the page at the current zoom, then swap it in. */
  const renderPdf = async () => {
    const pdfPage = pdfPageRef.current;
    const canvas = pdfCanvasRef.current;
    const { cw, ch } = sizeRef.current;
    if (!pdfPage || !canvas || !cw || !ch) return;

    const view = { ...viewRef.current };
    const dpr = window.devicePixelRatio || 1;
    const base = pdfPage.getViewport({ scale: 1 });
    const viewport = pdfPage.getViewport({ scale: ((cw * view.z) / base.width) * dpr });

    const off = (offscreenRef.current ||= document.createElement('canvas'));
    off.width = canvas.width;
    off.height = canvas.height;
    const offCtx = off.getContext('2d')!;
    offCtx.fillStyle = '#fff';
    offCtx.fillRect(0, 0, off.width, off.height);

    renderTaskRef.current?.cancel();
    const task = pdfPage.render({
      canvasContext: offCtx,
      viewport,
      transform: [1, 0, 0, 1, view.ox * dpr, view.oy * dpr],
    });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') console.error(err);
      return;
    }
    if (pdfPageRef.current !== pdfPage) return;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(off, 0, 0);
    renderedViewRef.current = view;
    applyBitmapTransform();
  };

  /** While zooming/panning, move the last rendered bitmap with CSS until the re-render lands. */
  const applyBitmapTransform = () => {
    const canvas = pdfCanvasRef.current;
    const r = renderedViewRef.current;
    if (!canvas) return;
    if (!r) {
      canvas.style.transform = 'none';
      return;
    }
    const v = viewRef.current;
    const k = v.z / r.z;
    canvas.style.transform = `translate(${v.ox - r.ox * k}px, ${v.oy - r.oy * k}px) scale(${k})`;
  };

  const scheduleFrame = (rerender: 'debounced' | 'now' | 'none' = 'debounced') => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyBitmapTransform();
        redrawInk();
      });
    }
    if (rerender === 'none') return;
    if (rerenderTimerRef.current !== null) window.clearTimeout(rerenderTimerRef.current);
    rerenderTimerRef.current = window.setTimeout(
      () => {
        rerenderTimerRef.current = null;
        void renderPdf();
      },
      rerender === 'now' ? 0 : RERENDER_DEBOUNCE_MS
    );
  };

  const setView = (v: View, rerender: 'debounced' | 'now' = 'debounced') => {
    viewRef.current = clampView(v);
    setZoomedIn(viewRef.current.z > 1.01);
    scheduleFrame(rerender);
  };

  // ---------- Layout ----------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      const cw = Math.floor(r.width);
      const ch = Math.floor(r.height);
      if (!cw || !ch) return;
      const prev = sizeRef.current;
      sizeRef.current = { cw, ch };
      const dpr = window.devicePixelRatio || 1;
      for (const c of [pdfCanvasRef.current, inkCanvasRef.current]) {
        if (!c) continue;
        c.width = Math.floor(cw * dpr);
        c.height = Math.floor(ch * dpr);
      }
      renderedViewRef.current = null;
      // Keep the same spot of the page at the top when the toolbar hides/shows
      const v = viewRef.current;
      const dx = prev.cw ? (cw - prev.cw) / 2 : 0;
      viewRef.current = clampView({ ...v, ox: v.ox + dx });
      scheduleFrame('now');
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdf]);

  // Load the current page; keep the zoom, start at the top.
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    setPageReady(false);
    (async () => {
      const pdfPage = await pdf.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      aspectRef.current = base.height / base.width;
      pdfPageRef.current = pdfPage;
      renderedViewRef.current = null;
      const ctx = pdfCanvasRef.current?.getContext('2d');
      if (ctx && pdfCanvasRef.current) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, pdfCanvasRef.current.width, pdfCanvasRef.current.height);
      }
      viewRef.current = clampView({ ...viewRef.current, oy: 0 });
      setZoomedIn(viewRef.current.z > 1.01);
      scheduleFrame('now');
      setPageReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, page]);

  // ---------- Navigation ----------
  const goTo = useCallback((p: number) => {
    const n = numPagesRef.current;
    if (!n) return;
    const next = Math.min(n, Math.max(1, p));
    if (next === pageRef.current) return;
    currentStrokeRef.current = null;
    setPage(next);
    setConfirmClear(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        goTo(pageRef.current + 1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        goTo(pageRef.current - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo]);

  // Mouse wheel / trackpad: scroll pans, ctrl+wheel (or trackpad pinch) zooms.
  useEffect(() => {
    const el = inkCanvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (e.ctrlKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const z = Math.min(MAX_ZOOM, Math.max(minZoom(), v.z * Math.exp(-e.deltaY * 0.01)));
        const k = z / v.z;
        setView({ z, ox: mx - (mx - v.ox) * k, oy: my - (my - v.oy) * k });
      } else {
        setView({ ...v, ox: v.ox - e.deltaX, oy: v.oy - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [pdf]);

  const toggleFit = () => {
    const { cw } = sizeRef.current;
    const v = viewRef.current;
    if (v.z > 1.01) {
      setView({ z: 1, ox: 0, oy: (v.oy / v.z) * 1 }, 'now'); // back to full width
    } else if (v.z >= 0.99 && minZoom() < 0.99) {
      setView({ z: minZoom(), ox: 0, oy: 0 }, 'now'); // whole page
    } else {
      setView({ z: 1, ox: (cw - cw) / 2, oy: 0 }, 'now'); // full width
    }
  };

  // ---------- Annotation edits ----------
  const pushUndo = () => {
    const p = pageRef.current;
    const stack = (undoRef.current[p] ||= []);
    stack.push([...pageStrokes(p)]);
    if (stack.length > 50) stack.shift();
  };

  const setPageStrokes = (strokes: AnnotationStroke[]) => {
    annotationsRef.current = {
      ...annotationsRef.current,
      pages: { ...annotationsRef.current.pages, [String(pageRef.current)]: strokes },
    };
  };

  const toPage = (clientX: number, clientY: number) => {
    const rect = inkCanvasRef.current!.getBoundingClientRect();
    const { z, ox, oy } = viewRef.current;
    const { pw, ph } = pageSize(z);
    return [(clientX - rect.left - ox) / pw, (clientY - rect.top - oy) / ph];
  };

  const eraseAt = (clientX: number, clientY: number) => {
    const [nx, ny] = toPage(clientX, clientY);
    const { pw, ph } = pageSize(viewRef.current.z);
    const rx = ERASER_RADIUS_PX / pw;
    const ry = ERASER_RADIUS_PX / ph;
    const strokes = pageStrokes(pageRef.current);
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
      scheduleFrame('none');
    }
  };

  // ---------- Pointer input ----------
  const startGesture = () => {
    const pts = [...pointersRef.current.entries()];
    if (pts.length >= 2) {
      const [[, a], [, b]] = pts;
      pinchRef.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        view: { ...viewRef.current },
      };
      if (singleRef.current) singleRef.current.moved = true; // a pinch is never a tap/swipe
    } else if (pts.length === 1) {
      const [[id, p]] = pts;
      const prevMoved = singleRef.current?.moved ?? false;
      singleRef.current = { id, x: p.x, y: p.y, t: performance.now(), view: { ...viewRef.current }, moved: prevMoved && !!pinchRef.current };
      pinchRef.current = null;
    }
  };

  const capture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
  };

  const localXY = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') penSeenRef.current = true;
    const t = toolRef.current;
    const drawing = t !== 'view';
    const isTouch = e.pointerType === 'touch';
    const fingerMayDraw = !penSeenRef.current;

    // Drawing / erasing
    if (drawing && (!isTouch || (fingerMayDraw && pointersRef.current.size === 0))) {
      capture(e);
      if (t === 'eraser') {
        pushUndo();
        erasingRef.current = e.pointerId;
        eraseAt(e.clientX, e.clientY);
        if (isTouch) pointersRef.current.set(e.pointerId, localXY(e)); // so a 2nd finger becomes a pinch
        return;
      }
      const [x, y] = toPage(e.clientX, e.clientY);
      const z = viewRef.current.z;
      currentStrokeRef.current = {
        pointerId: e.pointerId,
        stroke: {
          tool: t === 'highlighter' ? 'highlighter' : 'pen',
          // Thinner lines when zoomed in, so zooming gives precision rather than fat strokes
          width: (t === 'highlighter' ? HIGHLIGHTER_WIDTH : PEN_WIDTH) / Math.max(1, z),
          points: [x, y],
        },
      };
      if (isTouch) pointersRef.current.set(e.pointerId, localXY(e));
      scheduleFrame('none');
      return;
    }

    // Gestures (hand mode, or fingers while drawing with a stylus)
    if (!isTouch && drawing) return;
    capture(e);
    pointersRef.current.set(e.pointerId, localXY(e));
    // A second finger while drawing with a finger: drop the stroke and pinch instead
    if (currentStrokeRef.current && pointersRef.current.size >= 2) {
      currentStrokeRef.current = null;
      scheduleFrame('none');
    }
    if (erasingRef.current !== null && pointersRef.current.size >= 2) erasingRef.current = null;
    // With a stylus in hand, one finger does nothing in draw modes (palm rejection)
    if (drawing && pointersRef.current.size < 2) return;
    startGesture();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (erasingRef.current === e.pointerId) {
      eraseAt(e.clientX, e.clientY);
      return;
    }
    const cur = currentStrokeRef.current;
    if (cur && cur.pointerId === e.pointerId) {
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events) {
        const [x, y] = toPage(ev.clientX, ev.clientY);
        cur.stroke.points.push(Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000);
      }
      scheduleFrame('none');
      return;
    }
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, localXY(e));

    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const v0 = pinch.view;
      const z = Math.min(MAX_ZOOM, Math.max(minZoom(), (v0.z * d) / pinch.d));
      const k = z / v0.z;
      // Keep the point that was under the fingers under the fingers
      setView({ z, ox: mx - (pinch.mx - v0.ox) * k, oy: my - (pinch.my - v0.oy) * k });
      return;
    }

    const single = singleRef.current;
    if (single && single.id === e.pointerId) {
      const p = pointersRef.current.get(e.pointerId)!;
      const dx = p.x - single.x;
      const dy = p.y - single.y;
      if (Math.hypot(dx, dy) > TAP_MAX_MOVE_PX) single.moved = true;
      if (single.moved) setView({ ...single.view, ox: single.view.ox + dx, oy: single.view.oy + dy });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (erasingRef.current === e.pointerId) {
      erasingRef.current = null;
      pointersRef.current.delete(e.pointerId);
      forceRender(n => n + 1);
      return;
    }
    const cur = currentStrokeRef.current;
    if (cur && cur.pointerId === e.pointerId) {
      currentStrokeRef.current = null;
      pointersRef.current.delete(e.pointerId);
      pushUndo();
      setPageStrokes([...pageStrokes(pageRef.current), cur.stroke]);
      markDirty();
      scheduleFrame('none');
      forceRender(n => n + 1); // refresh undo button state
      return;
    }
    if (!pointersRef.current.has(e.pointerId)) return;

    const single = singleRef.current;
    pointersRef.current.delete(e.pointerId);

    if (single && single.id === e.pointerId && pointersRef.current.size === 0 && !pinchRef.current) {
      singleRef.current = null;
      const p = localXY(e);
      const dx = p.x - single.x;
      const dy = p.y - single.y;
      const dt = performance.now() - single.t;
      const inHandMode = toolRef.current === 'view';

      if (!single.moved && dt < TAP_MAX_MS && inHandMode) {
        const w = sizeRef.current.cw;
        if (p.x < w * EDGE_TAP_FRACTION) goTo(pageRef.current - 1);
        else if (p.x > w * (1 - EDGE_TAP_FRACTION)) goTo(pageRef.current + 1);
        else setChromeVisible(v => !v);
        return;
      }
      if (
        single.moved &&
        dt < SWIPE_MAX_MS &&
        Math.abs(dx) > SWIPE_MIN_PX &&
        Math.abs(dx) > 1.5 * Math.abs(dy) &&
        !canPanX(single.view)
      ) {
        goTo(pageRef.current + (dx < 0 ? 1 : -1));
      }
      return;
    }

    // Finger lifted out of a pinch: continue as a pan with the remaining finger
    if (pointersRef.current.size >= 2) startGesture();
    else if (pointersRef.current.size === 1) {
      startGesture();
      if (singleRef.current) singleRef.current.moved = true;
    } else {
      pinchRef.current = null;
      singleRef.current = null;
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (currentStrokeRef.current?.pointerId === e.pointerId) currentStrokeRef.current = null;
    if (erasingRef.current === e.pointerId) erasingRef.current = null;
    if (pointersRef.current.size === 0) {
      pinchRef.current = null;
      singleRef.current = null;
    }
    scheduleFrame('none');
  };

  const undo = () => {
    const prev = undoRef.current[pageRef.current]?.pop();
    if (!prev) return;
    setPageStrokes(prev);
    markDirty();
    scheduleFrame('none');
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
    scheduleFrame('none');
    setConfirmClear(false);
  };

  const canUndo = (undoRef.current[page]?.length || 0) > 0;
  const saveLabel: Record<SaveStatus, string> = {
    saved: 'Saved',
    pending: 'Unsaved',
    saving: 'Saving…',
    error: 'Not saved',
  };

  // ---------- UI ----------
  const btn = { minWidth: 40, minHeight: 40, '--IconButton-size': '40px' };

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
      {/* One compact toolbar; tap the middle of the page to hide/show it */}
      {chromeVisible && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 0.75,
            py: 0.5,
            borderBottom: '2px solid #000',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            flexShrink: 0,
            '& > *': { flexShrink: 0 },
          }}
        >
          <IconButton variant="outlined" onClick={handleClose} aria-label="Close sheet music" sx={btn}>
            <X size={20} />
          </IconButton>
          <Typography
            level="title-sm"
            noWrap
            sx={{ minWidth: 40, maxWidth: 200, flexShrink: '1 !important', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {owner.name}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton variant="plain" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Previous page" sx={btn}>
              <ChevronLeft size={22} />
            </IconButton>
            <Typography level="body-sm" sx={{ minWidth: 44, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
              {numPages ? `${page}/${numPages}` : '–'}
            </Typography>
            <IconButton
              variant="plain"
              onClick={() => goTo(page + 1)}
              disabled={!numPages || page >= numPages}
              aria-label="Next page"
              sx={btn}
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
            <IconButton value="view" aria-label="Hand: swipe, zoom, tap" sx={btn}>
              <Hand size={19} />
            </IconButton>
            <IconButton value="pen" aria-label="Pen" sx={btn}>
              <PenLine size={19} />
            </IconButton>
            <IconButton value="highlighter" aria-label="Highlighter" sx={btn}>
              <Highlighter size={19} />
            </IconButton>
            <IconButton value="eraser" aria-label="Eraser" sx={btn}>
              <Eraser size={19} />
            </IconButton>
          </ToggleButtonGroup>

          <IconButton variant="outlined" onClick={undo} disabled={!canUndo} aria-label="Undo" sx={btn}>
            <Undo2 size={19} />
          </IconButton>
          <IconButton
            variant={confirmClear ? 'solid' : 'outlined'}
            color="neutral"
            onClick={clearPage}
            aria-label={confirmClear ? 'Tap again to clear this page' : 'Clear page'}
            sx={{ ...btn, ...(confirmClear ? { px: 1 } : {}) }}
          >
            {confirmClear ? <Typography level="body-xs" sx={{ color: '#fff' }}>Clear?</Typography> : <Trash2 size={19} />}
          </IconButton>
          <IconButton
            variant="outlined"
            onClick={toggleFit}
            aria-label={zoomedIn ? 'Fit to width' : 'Toggle full width / whole page'}
            sx={btn}
          >
            {zoomedIn ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
          </IconButton>
          <Typography
            level="body-xs"
            title={saveLabel[saveStatus]}
            sx={{ color: saveStatus === 'error' ? '#000' : '#666', fontWeight: saveStatus === 'error' ? 700 : 400, minWidth: 48 }}
          >
            {saveLabel[saveStatus]}
          </Typography>

          <Box sx={{ flex: '1 1 auto' }} />
          {toolbarExtra}
        </Box>
      )}

      {/* Page */}
      <Box ref={containerRef} sx={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', bgcolor: '#fff' }}>
        <canvas
          ref={pdfCanvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transformOrigin: '0 0', display: 'block' }}
        />
        <canvas
          ref={inkCanvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
        {(loadError || !pageReady) && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            {loadError ? <Typography>{loadError}</Typography> : <CircularProgress />}
          </Box>
        )}
        {!chromeVisible && numPages > 0 && (
          <Typography
            level="body-xs"
            sx={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              px: 1,
              py: 0.25,
              border: '1px solid #000',
              borderRadius: 'sm',
              bgcolor: '#fff',
              pointerEvents: 'none',
            }}
          >
            {page}/{numPages}
          </Typography>
        )}
      </Box>
    </Box>,
    document.body
  );
};

export default SheetMusicViewer;
