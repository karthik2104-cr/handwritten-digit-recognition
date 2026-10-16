import { Eraser, Loader2, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { canvasHasInk, pointerToCanvas } from "../lib/canvas";
import { primaryButtonClass, quietButtonClass } from "../lib/styles";

const CANVAS_SIZE = 420;

interface DrawingCanvasProps {
  brush: number;
  onBrushChange: (value: number) => void;
  predicting: boolean;
  onPredict: (dataUrl: string) => void;
  onBlank: () => void;
  onClear?: () => void;
}

export function DrawingCanvas({ brush, onBrushChange, predicting, onPredict, onBlank, onClear }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const undoStack = useRef<ImageData[]>([]);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const undoRef = useRef<() => void>(() => undefined);

  function context2d() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function paintBackground() {
    const canvas = canvasRef.current;
    const context = context2d();
    if (!canvas || !context) return;
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => {
    paintBackground();
  }, []);

  useEffect(() => {
    if (!predicting) return;
    drawing.current = false;
    lastPoint.current = null;
  }, [predicting]);

  function undo() {
    const context = context2d();
    const snapshot = undoStack.current.pop();
    if (!context || !snapshot) return;
    context.putImageData(snapshot, 0, 0);
  }

  undoRef.current = undo;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      undoRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = context2d();
    if (!canvas || !context || predicting) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    undoStack.current = [...undoStack.current.slice(-24), context.getImageData(0, 0, canvas.width, canvas.height)];
    drawing.current = true;
    const point = pointerToCanvas(canvas, event.clientX, event.clientY);
    lastPoint.current = point;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(point.x, point.y, brush / 2, 0, Math.PI * 2);
    context.fill();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const context = context2d();
    const previous = lastPoint.current;
    if (!canvas || !context || !previous) return;
    const point = pointerToCanvas(canvas, event.clientX, event.clientY);
    context.strokeStyle = "#ffffff";
    context.lineWidth = brush;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPoint.current = point;
  }

  function endStroke() {
    drawing.current = false;
    lastPoint.current = null;
  }

  function clear() {
    paintBackground();
    undoStack.current = [];
    drawing.current = false;
    lastPoint.current = null;
    onClear?.();
  }

  function predict() {
    const canvas = canvasRef.current;
    const context = context2d();
    if (!canvas || !context) return;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!canvasHasInk(pixels)) {
      onBlank();
      return;
    }
    onPredict(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          data-testid="drawing-canvas"
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          aria-label="Digit drawing canvas"
          className="aspect-square w-full touch-none rounded-2xl bg-black ring-1 ring-[var(--ns-border)]"
          style={predicting ? { pointerEvents: "none" } : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onLostPointerCapture={endStroke}
          onContextMenu={(event) => event.preventDefault()}
        />
        <div className="canvas-grid pointer-events-none absolute inset-0 rounded-2xl" />
      </div>
      <p className="text-sm leading-6 text-[var(--ns-muted)]">Draw with a mouse or touchscreen. A single thick digit from 0 to 9 works best.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-48 flex-1 items-center gap-3 text-sm text-[var(--ns-muted)]">
          Brush
          <input
            data-testid="brush-size"
            type="range"
            min={8}
            max={48}
            value={brush}
            onChange={(event) => onBrushChange(Number(event.target.value))}
            className="w-full accent-[var(--ns-accent)]"
          />
          <span className="w-12 font-mono text-xs">{brush}px</span>
        </label>
        <button type="button" data-testid="undo-button" onClick={undo} className={quietButtonClass}>
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          Undo
        </button>
        <button type="button" data-testid="clear-button" onClick={clear} className={quietButtonClass}>
          <Eraser className="h-4 w-4" aria-hidden="true" />
          Clear
        </button>
        <button type="button" data-testid="predict-button" onClick={predict} disabled={predicting} className={primaryButtonClass}>
          {predicting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {predicting ? "Predicting" : "Predict Digit"}
        </button>
      </div>
    </div>
  );
}
