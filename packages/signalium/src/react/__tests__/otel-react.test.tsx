import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context as otelContext } from '@opentelemetry/api';
import React from 'react';
import { state, reactive } from 'signalium';
import { render } from 'vitest-browser-react';
import { describe, test, expect, beforeEach } from 'vitest';
import { OtelComponent } from 'signalium-opentelemetry-react/src/index.tsx';
import { setupReact } from '../index.js';
import { sleep } from '../../__tests__/utils/async.js';

setupReact();

let exporter: InMemorySpanExporter;

beforeEach(() => {
  exporter = new InMemorySpanExporter();
  const provider = new WebTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register();
  
  // Set up the OtelComponent like the official one
  OtelComponent.setTracer('otel-react-tests', '1.0.0');
});

describe('OpenTelemetry React integration', () => {
  test('should create and export spans for async React component with grandchildren', async () => {
    const grandchildValue = state('Hello');
    
    const grandchildDerived = reactive(async () => {
      const v = grandchildValue.get();
      await trace.getTracer('otel-react-tests').startActiveSpan('grandchild-derived-sleep', async (span) => {
        span.setAttribute('value', v);
        console.log('grandchild-derived-sleep span:', span.spanContext().spanId, 'traceId:', span.spanContext().traceId);
        await sleep(10);
        span.end();
      });
      await sleep(100);
      console.log('grandchildDerived finished: ' + `${v}, World`);
      return `${v}, World`;
    });
    
    
    function GrandChild({ asyncValue }: {asyncValue: { isPending: boolean; value: string | undefined }}): React.ReactNode {
      return <div>{asyncValue.isPending ? 'Loading...' : asyncValue.value}</div>;
    }

    function Child(): React.ReactNode {
      const promise = grandchildDerived(); // Call inside render like the working tests
      return <GrandChild asyncValue={promise} />;
    }

    function Parent(): React.ReactElement {
      return <OtelComponent name="parent">
        <Child />
      </OtelComponent>;
    }

    const { getByText, unmount } = render(
      <Parent />
    );

    await expect.element(getByText('Loading...')).toBeInTheDocument();
    await expect.element(getByText('Hello, World')).toBeInTheDocument();

    grandchildValue.set('Hey');

    await expect.element(getByText('Loading...')).toBeInTheDocument();
    await expect.element(getByText('Hey, World')).toBeInTheDocument();

    unmount();

    // Make sure all the spans are connected to the parent span
    await new Promise(res => setTimeout(res, 10));
    const spans = exporter.getFinishedSpans();
    const parentSpan = spans.find(s => s.name === 'parent');
    expect(parentSpan).toBeTruthy();
    spans.forEach(s => {
      expect(s.spanContext().traceId).toBe(parentSpan!.spanContext().traceId);
    });
    
    // Check for specific spans we expect
    const grandchildDerivedSpan = spans.find(s => s.name === 'grandchild-derived-sleep');
    expect(grandchildDerivedSpan).toBeTruthy();
    console.log('Finished spans:', spans.map(s => ({ name: s.name, traceId: s.spanContext().traceId })));
  });
});
