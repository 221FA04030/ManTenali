import { Component } from 'react';
import { ErrorState } from '../components/ui/ErrorState.jsx';

/** Catches render errors so one broken screen never blanks the whole app. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4">
          <ErrorState onRetry={() => this.setState({ error: null })} />
        </div>
      );
    }
    return this.props.children;
  }
}
