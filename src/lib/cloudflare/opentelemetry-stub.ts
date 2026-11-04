class NoopContext {
  constructor(private readonly values = new Map<symbol, unknown>()) {}

  getValue(key: symbol) {
    return this.values.get(key);
  }

  setValue(key: symbol, value: unknown) {
    const values = new Map(this.values);
    values.set(key, value);
    return new NoopContext(values);
  }

  deleteValue(key: symbol) {
    const values = new Map(this.values);
    values.delete(key);
    return new NoopContext(values);
  }
}

const INVALID_CONTEXT = { traceId: "0".repeat(32), spanId: "0".repeat(16), traceFlags: 0 };
const SPAN_KEY = Symbol.for("imagepartners.cloudflare.noop-span");

const noopSpan = {
  spanContext: () => INVALID_CONTEXT,
  setAttribute() { return this; },
  setAttributes() { return this; },
  addEvent() { return this; },
  addLink() { return this; },
  addLinks() { return this; },
  setStatus() { return this; },
  updateName() { return this; },
  end() {},
  isRecording: () => false,
  recordException() {},
};

const noopTracer = {
  startSpan: () => noopSpan,
  startActiveSpan(...args: unknown[]) {
    const callback = [...args].reverse().find((value) => typeof value === "function") as
      | ((span: typeof noopSpan) => unknown)
      | undefined;
    return callback?.(noopSpan);
  },
};

class NoopTracerProvider {
  getTracer() { return noopTracer; }
  getDelegate() { return this; }
}

const tracerProvider = new NoopTracerProvider();

export const ROOT_CONTEXT = new NoopContext();
export const createContextKey = (description: string) => Symbol.for(description);
export const context = {
  active: () => ROOT_CONTEXT,
  with: (_context: unknown, callback: (...args: unknown[]) => unknown, thisArg?: unknown, ...args: unknown[]) =>
    callback.apply(thisArg, args),
  bind: (_context: unknown, target: unknown) => target,
  setGlobalContextManager: () => true,
  disable() {},
};
export const propagation = {
  inject() {},
  extract: (currentContext: unknown) => currentContext,
  fields: () => [],
  setGlobalPropagator: () => true,
  disable() {},
};
export const trace = {
  getTracer: () => noopTracer,
  getTracerProvider: () => tracerProvider,
  getSpan: (currentContext: NoopContext) => currentContext?.getValue(SPAN_KEY),
  getSpanContext: (currentContext: NoopContext) =>
    (currentContext?.getValue(SPAN_KEY) as typeof noopSpan | undefined)?.spanContext(),
  setSpan: (currentContext: NoopContext, span: unknown) => currentContext.setValue(SPAN_KEY, span),
  deleteSpan: (currentContext: NoopContext) => currentContext.deleteValue(SPAN_KEY),
  isSpanContextValid: () => false,
  setGlobalTracerProvider: () => true,
  disable() {},
};
export const SpanStatusCode = { UNSET: 0, OK: 1, ERROR: 2 } as const;
export const SpanKind = { INTERNAL: 0, SERVER: 1, CLIENT: 2, PRODUCER: 3, CONSUMER: 4 } as const;

const api = { ROOT_CONTEXT, createContextKey, context, propagation, trace, SpanStatusCode, SpanKind };
export default api;
