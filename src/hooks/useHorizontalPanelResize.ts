import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

interface UseHorizontalPanelResizeOptions {
  /** Initial left panel share of the container (0–1). */
  initialRatio?: number;
  minLeftPx?: number;
  minRightPx?: number;
}

export function useHorizontalPanelResize({
  initialRatio = 0.42,
  minLeftPx = 320,
  minRightPx = 280,
}: UseHorizontalPanelResizeOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftRatio, setLeftRatio] = useState(initialRatio);
  const isDraggingRef = useRef(false);

  const clampRatio = useCallback(
    (ratio: number, containerWidth: number) => {
      if (containerWidth <= 0) return ratio;
      const minLeft = minLeftPx / containerWidth;
      const maxLeft = 1 - minRightPx / containerWidth;
      return Math.min(maxLeft, Math.max(minLeft, ratio));
    },
    [minLeftPx, minRightPx],
  );

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (container === null) return;
      const rect = container.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      setLeftRatio(clampRatio(ratio, rect.width));
    },
    [clampRatio],
  );

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    const onWindowResize = () => {
      const container = containerRef.current;
      if (container === null) return;
      setLeftRatio((prev) => clampRatio(prev, container.getBoundingClientRect().width));
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [clampRatio]);

  return {
    containerRef,
    leftRatio,
    leftPanelStyle: { width: `${leftRatio * 100}%` },
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: endDrag,
    handlePointerCancel: endDrag,
  };
}
