import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#faf9fc] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-10 max-w-md w-full border border-[#c5c6cf]/30 shadow-sm text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-red-400 block">error</span>
            <h1 className="text-xl font-bold text-[#1b1c1e]">Algo salió mal</h1>
            <p className="text-sm text-[#75777f]">
              Ocurrió un error inesperado en la aplicación. Por favor, recarga la página para continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#1c355e] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#152a4a] transition-all text-sm"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
