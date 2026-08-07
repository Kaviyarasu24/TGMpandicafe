import React from 'react';

// Class-based Error Boundary: catches render/runtime errors in the subtree
// and shows a recoverable fallback instead of a blank white screen.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log for diagnostics; in production this could be sent to a monitoring service.
    console.error('Uncaught error in component tree:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: "'Inter', sans-serif",
          background: '#F8FAFC',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#64748B', marginBottom: '1.5rem', maxWidth: '480px' }}>
            The application hit an unexpected error. Your data is safe. Try returning to the dashboard.
          </p>
          {this.state.error && (
            <pre style={{
              background: '#FEF2F2',
              color: '#B91C1C',
              padding: '1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              maxWidth: '600px',
              overflow: 'auto',
              marginBottom: '1.5rem',
              textAlign: 'left',
            }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #10B981 0%, #22C55E 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
