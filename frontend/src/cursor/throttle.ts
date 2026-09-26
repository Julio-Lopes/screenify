export interface Throttled<T> {
  (value: T): void;
  cancel: () => void;
}

/**
 * Chama a função no máximo uma vez por intervalo: a primeira chamada sai na hora e,
 * se chegarem outras no meio do intervalo, só a última sai quando ele termina.
 * Assim o cursor dos outros não "gruda" na penúltima posição quando você para de mexer.
 */
export function throttle<T>(fn: (value: T) => void, intervalMs: number): Throttled<T> {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;

  const run = (value: T) => {
    last = Date.now();
    fn(value);
  };

  const throttled = (value: T) => {
    const wait = intervalMs - (Date.now() - last);
    if (wait <= 0 && !timer) {
      run(value);
      return;
    }
    pending = { value };
    timer ??= setTimeout(() => {
      timer = null;
      if (pending) {
        run(pending.value);
        pending = null;
      }
    }, Math.max(wait, 0));
  };

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  return throttled;
}