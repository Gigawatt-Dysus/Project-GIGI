import React, { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

// FIX: The ErrorBoundary class now extends React.Component to function as a stateful React component, which provides access to `this.setState` and `this.props`.
class ErrorBoundary extends React.Component<Props, State> {
  // Initialize state using a class property for modern, concise syntax.
  state: State = {
    hasError: false,
    error: undefined,
    errorInfo: undefined,
  };

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    console.error("[ErrorBoundary] Caught a rendering error:", error);
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error details:", error, errorInfo);
    // Correctly call `this.setState` to update the component's state with detailed error information.
    this.setState({ errorInfo: errorInfo });
  }

  private handleReset = () => {
    console.warn("[ErrorBoundary] User triggered a hard reset.");
    try {
      const dbRequest = indexedDB.deleteDatabase('GigiDB');
      
      dbRequest.onsuccess = () => {
        console.log("[ErrorBoundary] IndexedDB 'GigiDB' deleted successfully.");
        // After DB is deleted, clear storage and reload.
        localStorage.clear();
        window.location.reload();
      };
      
      dbRequest.onerror = (event) => {
        console.error("[ErrorBoundary] Failed to delete IndexedDB:", (event.target as IDBOpenDBRequest).error);
        // Still attempt to recover by clearing storage and reloading.
        localStorage.clear();
        window.location.reload();
      };
      
      dbRequest.onblocked = () => {
        console.warn("[ErrorBoundary] IndexedDB deletion blocked. Please close other tabs with this app open.");
        alert("Could not delete the database because it's in use. Please close all other tabs with this application open and try again.");
      };

    } catch (error) {
      console.error("[ErrorBoundary] Error during hard reset attempt:", error);
      // Fallback for safety.
      localStorage.clear();
      window.location.reload();
    }
  };


  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4" style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2400')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}>
            <div className="max-w-2xl w-full bg-red-900/50 backdrop-blur-md border border-red-500 rounded-lg p-8 shadow-2xl text-left">
                <h1 className="text-3xl font-bold text-red-300">Application Error</h1>
                <p className="mt-2 text-red-200">
                    Gigi has encountered a critical error and cannot continue. This usually happens after a data import if the data is corrupt or in an unexpected format.
                </p>
                <div className="mt-4 bg-black/50 p-4 rounded-md font-mono text-sm overflow-auto max-h-96">
                    <h2 className="font-bold text-red-300">Error Details:</h2>
                    <p className="mt-2 text-red-100">{this.state.error?.toString()}</p>
                    <h2 className="font-bold text-red-300 mt-4">Component Stack:</h2>
                    <pre className="mt-1 text-red-100 whitespace-pre-wrap">
                        {this.state.errorInfo?.componentStack}
                    </pre>
                </div>
                 <p className="mt-6 text-yellow-300 text-sm">
                    If the application is stuck, you may need to perform a hard reset. This will delete all stored data and restart the application.
                </p>
                <div className="mt-6 text-center">
                    <button
                        onClick={this.handleReset}
                        className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-900 focus:ring-white"
                    >
                        Hard Reset Application
                    </button>
                </div>
            </div>
        </div>
      );
    }

    // Access `this.props.children` to render the component's children when there is no error.
    return this.props.children;
  }
}

export default ErrorBoundary;