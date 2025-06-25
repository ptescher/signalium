import { trace } from '@opentelemetry/api';

// Export a tracer instance for use in signalium
export const tracer = trace.getTracer('signalium');
