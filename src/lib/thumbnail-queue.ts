// thumbnail-queue.ts
// Purpose: A serial job queue for generating 3D-model thumbnails, framework-
//          agnostic on purpose so it can be imported from any component
//          without prop-drilling. Backs a single shared, hidden WebGL canvas
//          (see thumbnail-generator-host.tsx) instead of the old approach —
//          one live <Canvas> per card — which blew past the browser's
//          concurrent-WebGL-context cap (commonly ~16) the moment more than
//          a handful of character/library cards were on screen at once,
//          forcibly losing the *oldest* contexts. That's what showed up as
//          a blank white canvas after switching away and back: the browser
//          killing older previews to make room for newer ones.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

export interface ThumbnailJob {
  key: string;
  url: string;
  format: string;
}

type Listener = (job: ThumbnailJob | null) => void;

interface PendingJob extends ThumbnailJob {
  resolve: (dataUrl: string) => void;
  reject: (error: unknown) => void;
}

let current: PendingJob | null = null;
const queue: PendingJob[] = [];
let listener: Listener | null = null;
let nextId = 0;

function advance() {
  current = queue.shift() ?? null;
  listener?.(current ? { key: current.key, url: current.url, format: current.format } : null);
}

// The host component calls this once, on mount, to start receiving jobs —
// and drains anything queued before it existed.
export function subscribeThumbnailQueue(next: Listener): () => void {
  listener = next;
  if (!current && queue.length > 0) advance();
  else listener(current ? { key: current.key, url: current.url, format: current.format } : null);
  return () => {
    if (listener === next) listener = null;
  };
}

export function requestThumbnail(url: string, format: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const job: PendingJob = { key: `${url}#${nextId++}`, url, format, resolve, reject };
    queue.push(job);
    if (!current) advance();
  });
}

export function completeThumbnailJob(key: string, dataUrl: string) {
  if (current?.key !== key) return;
  current.resolve(dataUrl);
  advance();
}

export function failThumbnailJob(key: string, error: unknown) {
  if (current?.key !== key) return;
  current.reject(error);
  advance();
}
