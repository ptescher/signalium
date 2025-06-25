import { describe, test, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-react';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OtelComponent } from './index.tsx';

let exporter: InMemorySpanExporter;

beforeEach(() => {
  exporter = new InMemorySpanExporter();
  const provider = new WebTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register();
});

describe('OtelComponent', () => {
  test('creates and ends a span for the React subtree', async () => {
    function TestComponent() {
      return <div>hello</div>;
    }
    const { getByText, unmount } = render(
      <OtelComponent name="test-span">
        <TestComponent />
      </OtelComponent>
    );
    await expect.element(getByText('hello')).toBeInTheDocument();
    unmount();
    await new Promise(res => setTimeout(res, 10));
    const spans = exporter.getFinishedSpans();
    expect(spans.some(s => s.name === 'test-span')).toBe(true);
  });
});
