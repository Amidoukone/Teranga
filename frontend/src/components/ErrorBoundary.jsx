import React from 'react';
import { withTranslation } from 'react-i18next';
import { reportFrontendError } from '../utils/errorReporter';

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    reportFrontendError(error, { componentStack: errorInfo?.componentStack });
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
    if (isDev) {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary runtime error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { t } = this.props;

    return (
      <div className="min-h-screen bg-surface-main flex items-center justify-center px-4">
        <div className="max-w-xl w-full bg-surface-card shadow-lg rounded-2xl border border-border p-6 sm:p-10 text-center">
          <div role="alert" aria-live="assertive">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-500">
            {t('errorBoundary.kicker')}
          </p>
          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-text-primary">
            {t('errorBoundary.title')}
          </h1>
          <p className="mt-4 text-text-secondary">
            {t('errorBoundary.description')}
          </p>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full sm:w-auto rounded-full border border-border px-5 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-main/80"
            >
              {t('errorBoundary.retry')}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              {t('errorBoundary.reload')}
            </button>
          </div>

          {isDev && this.state.error && (
            <details className="mt-6 text-left text-xs text-text-muted">
              <summary className="cursor-pointer font-semibold text-text-secondary">
                {t('errorBoundary.details')}
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error?.toString()}
                {'\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default withTranslation()(ErrorBoundary);


