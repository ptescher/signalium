import { 
  trace, 
  context as otelContext, 
  Span, 
  SpanOptions, 
  DiagLogger, 
  diag,
  Tracer,
  Context 
} from '@opentelemetry/api';
import React from 'react';

// Internal component to provide OpenTelemetry context to React tree
interface SpanContextProviderProps {
  context: Context;
  children: React.ReactNode;
}

const SpanContextProvider: React.FC<SpanContextProviderProps> = ({ context, children }) => {
  React.useLayoutEffect(() => {
    // Set the active context for this component tree
    const token = otelContext.with(context, () => {
      // Return a cleanup token or similar mechanism if needed
      return null;
    });
    
    return () => {
      // Cleanup if needed
    };
  }, [context]);

  // Use a custom effect to ensure all child operations run in this context
  const wrappedChildren = React.useMemo(() => {
    // Wrap all async operations and renders in the provided context
    let result: React.ReactNode;
    otelContext.with(context, () => {
      result = children;
    });
    return result;
  }, [context, children]);

  return <>{wrappedChildren}</>;
};

export interface OtelComponentProps {
  name: string;
  options?: SpanOptions;
  children?: React.ReactNode;
}

/**
 * Base OpenTelemetry React component for lifecycle instrumentation.
 * Similar to the official BaseOpenTelemetryComponent from @opentelemetry/plugin-react-load.
 * 
 * Usage patterns:
 * 1. Set once for entire plugin:
 *    OtelComponent.setLogger(logger);
 *    OtelComponent.setTracer('my-app', '1.0.0');
 * 
 * 2. Use directly with name prop:
 *    <OtelComponent name="my-component">
 *      <MyContent />
 *    </OtelComponent>
 * 
 * 3. Extend for custom components:
 *    export class MyComponent extends OtelComponent {
 *      constructor(props) {
 *        super({ ...props, name: 'MyComponent' });
 *      }
 *      // Custom component logic...
 *    }
 */
export class OtelComponent<P extends OtelComponentProps = OtelComponentProps, S = object> extends React.Component<P, S> {
  private static _tracer: Tracer;
  private static _logger: DiagLogger = diag;
  
  private _span: Span | null = null;
  private _spanName: string;

  /**
   * Sets the tracer for all OtelComponent instances.
   * Call this once during application setup.
   * @param name Name of tracer
   * @param version Version of tracer (optional)
   */
  static setTracer(name: string, version?: string): void {
    OtelComponent._tracer = trace.getTracer(name, version);
  }

  /**
   * Sets the logger for all OtelComponent instances.
   * Call this once during application setup.
   * @param logger DiagLogger instance
   */
  static setLogger(logger: DiagLogger): void {
    diag.setLogger(logger);
    OtelComponent._logger = logger;
  }

  constructor(props: P) {
    super(props);
    this._spanName = props.name;
    
    // Ensure tracer is available
    if (!OtelComponent._tracer) {
      // Fall back to default tracer if not explicitly set
      OtelComponent._tracer = trace.getTracer('signalium-opentelemetry-react');
    }
  }

  componentDidMount() {
    this._span = OtelComponent._tracer.startSpan(this._spanName, this.props.options);
    OtelComponent._logger.debug(`Started span: ${this._spanName}`);
    
    // Force update to ensure render picks up the span context
    this.forceUpdate();
  }

  componentWillUnmount() {
    if (this._span) {
      this._span.end();
      OtelComponent._logger.debug(`Ended span: ${this._spanName}`);
      this._span = null;
    }
  }

  render() {
    if (!this._span) {
      // Don't render children until span is created
      return null;
    }

    // Create a context wrapper that provides the span context to all children
    const spanContext = trace.setSpan(otelContext.active(), this._span);
    
    // We need to wrap the children in a context provider that makes the span active
    // during the entire rendering tree and any async operations
    return React.createElement(SpanContextProvider, { 
      context: spanContext,
      children: this.props.children
    });
  }
}
