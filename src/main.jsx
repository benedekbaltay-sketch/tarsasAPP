import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-gray-900">Váratlan hiba történt</h2>
            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg text-left font-mono break-all border border-gray-200">
              {this.state.error?.message || "Ismeretlen hiba"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2 px-3 bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Oldal újratöltése
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("tarsashaz_state");
                    localStorage.removeItem("tarsashaz_logged_in_user");
                    sessionStorage.removeItem("tarsas_nav_state");
                    sessionStorage.removeItem("tarsashaz_session_user");
                  } catch (e) {}
                  window.location.reload();
                }}
                className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Alaphelyzetbe állítás
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
