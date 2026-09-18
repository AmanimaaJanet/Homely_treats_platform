import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary.jsx';

/**
 * The error boundary is the only thing standing between a failed page-chunk and a blank
 * screen, so both of its behaviours matter: it must say something true, and it must give
 * the customer a way forward.
 */

function Boom({ error }) {
  throw error;
}

beforeEach(() => {
  // React logs the caught error; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  delete window.__homelyReportError;
});

describe('ErrorBoundary', () => {
  it('renders children untouched when nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <p>Basket contents</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('Basket contents')).toBeInTheDocument();
  });

  it('catches a render failure and explains it calmly', () => {
    render(
      <ErrorBoundary>
        <Boom error={new Error('Cannot read properties of undefined')} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong on this page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to the homepage/i })).toHaveAttribute('href', '/');
  });

  it('recognises a failed page download and tells the customer their basket is safe', () => {
    const chunkError = new Error('Failed to fetch dynamically imported module: /assets/Cart-abc123.js');
    render(
      <ErrorBoundary>
        <Boom error={chunkError} />
      </ErrorBoundary>
    );

    expect(screen.getByText('That page did not finish loading')).toBeInTheDocument();
    expect(screen.getByText(/Your connection may have dropped/i)).toBeInTheDocument();
  });

  it('recognises the Safari/WebKit wording for the same failure', () => {
    render(
      <ErrorBoundary>
        <Boom error={new Error('Importing a module script failed.')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('That page did not finish loading')).toBeInTheDocument();
  });

  it('shows the technical detail for whoever is debugging', () => {
    render(
      <ErrorBoundary>
        <Boom error={new Error('Zone "Achimota" not found')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Show the technical detail')).toBeInTheDocument();
    expect(screen.getByText('Zone "Achimota" not found')).toBeInTheDocument();
  });

  it('reports the error to the monitoring hook when the app provides one', () => {
    const report = vi.fn();
    window.__homelyReportError = report;

    render(
      <ErrorBoundary>
        <Boom error={new Error('Boom')} />
      </ErrorBoundary>
    );

    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][1]).toMatchObject({ scope: 'react', chunk: false });
  });
});
