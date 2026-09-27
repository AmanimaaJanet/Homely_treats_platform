import React from 'react';

/**
 * Last line of defence against a white screen.
 *
 * With routes loaded on demand, there is a new way for a page to fail that has nothing
 * to do with a bug in the page: its file may not arrive. That happens when a customer
 * loses signal between the menu and the basket, or when the site is redeployed while
 * someone has it open and the old page-chunk name no longer exists on the server. React
 * cannot catch that itself — the failure happens while React is loading the component —
 * so without a boundary the whole app unmounts and the customer is left staring at an
 * empty page with no way forward.
 *
 * This catches both cases, says something true and calm, and offers a way out. The real
 * error still goes to the console and to the monitoring hook, so it is never swallowed.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // A chunk that failed to load is a connectivity/deploy problem, not a code fault.
    const message = String(error?.message || '');
    const isChunkError =
      /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message);

    console.error('[Homely Treats] render failed', { chunk: isChunkError, error, info });

    // The monitoring hook installed by the app (see server/src/services/monitoring.js for
    // the server side); optional, so the app works with or without it.
    if (typeof window !== 'undefined' && typeof window.__homelyReportError === 'function') {
      window.__homelyReportError(error, { scope: 'react', chunk: isChunkError });
    }

    this.setState({ isChunkError });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const { isChunkError } = this.state;

    return (
      <div className="page error-page" role="alert">
        <div className="error-card">
          <h1>{isChunkError ? 'That page did not finish loading' : 'Something went wrong on this page'}</h1>
          <p className="muted">
            {isChunkError
              ? 'Your connection may have dropped, or the site was just updated. Your basket is saved on this device — reloading will bring it back.'
              : 'The rest of the site still works. Reloading usually clears this.'}
          </p>
          <div className="error-actions">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <a className="btn btn-ghost" href="/">
              Back to the homepage
            </a>
          </div>
          <details className="error-detail">
            <summary>Show the technical detail</summary>
            <pre>{String(this.state.error?.message || this.state.error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}
