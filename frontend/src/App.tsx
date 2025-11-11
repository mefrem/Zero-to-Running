import { useEffect, useState } from 'react';
import { fetchHealth, type HealthResponse } from './config/api';
import { useLogger } from './utils/logger';
import Dashboard from './components/Dashboard';

type HealthStatus = 'loading' | 'healthy' | 'unhealthy' | 'unavailable';
type Page = 'home' | 'dashboard';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('loading');
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const log = useLogger('App');

  // Handle hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'dashboard') {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('home');
      }
    };

    // Set initial page based on hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    log.lifecycle('mount');

    const checkHealth = async () => {
      try {
        log.debug('Checking backend health status');
        const data = await fetchHealth();
        setHealthData(data);
        setHealthStatus(data.status === 'ok' ? 'healthy' : 'unhealthy');
        setError(null);
        log.info('Health check successful', { status: data.status });
      } catch (err) {
        setHealthStatus('unavailable');
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        log.error('Health check failed', { error: errorMessage });
      }
    };

    checkHealth();
    // Optional: Poll health status every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => {
      clearInterval(interval);
      log.lifecycle('unmount');
    };
  }, []);

  const getStatusColor = () => {
    switch (healthStatus) {
      case 'healthy':
        return 'bg-green-500';
      case 'unhealthy':
        return 'bg-yellow-500';
      case 'unavailable':
        return 'bg-red-500';
      case 'loading':
        return 'bg-gray-500 animate-pulse';
    }
  };

  const getStatusText = () => {
    switch (healthStatus) {
      case 'healthy':
        return 'Backend API: Healthy';
      case 'unhealthy':
        return 'Backend API: Unhealthy';
      case 'unavailable':
        return 'Backend API: Unavailable';
      case 'loading':
        return 'Backend API: Checking...';
    }
  };

  // Render dashboard page
  if (currentPage === 'dashboard') {
    return <Dashboard />;
  }

  // Render home/landing page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Quick Health Status Badge (Top Right) */}
        <div className="fixed top-4 right-4 bg-white/10 backdrop-blur rounded-full px-4 py-2 border border-white/20 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <span className="text-white text-sm font-medium">
            {healthStatus === 'healthy' ? 'All Healthy' :
             healthStatus === 'unhealthy' ? 'Degraded' :
             healthStatus === 'unavailable' ? 'Unavailable' : 'Checking...'}
          </span>
          <a
            href="#dashboard"
            className="ml-2 text-blue-300 hover:text-blue-200 text-sm underline"
            onClick={() => log.info('Navigating to dashboard from quick status')}
          >
            Details
          </a>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Main Heading */}
          <h1 className="text-4xl md:text-5xl font-bold text-center text-white mb-8">
            Zero-to-Running Environment - Ready!
          </h1>

          {/* Status Badge */}
          <div className="flex items-center justify-center mb-8">
            <div className="bg-white/20 backdrop-blur rounded-full px-6 py-3 flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${getStatusColor()}`}></div>
              <span className="text-white font-semibold text-lg">Ready!</span>
            </div>
          </div>

          {/* Health Status Section */}
          <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">System Health Status</h2>

            {/* Backend Health */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-300">{getStatusText()}</span>
              <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            </div>

            {/* Timestamp */}
            {healthData && (
              <div className="text-sm text-gray-400 mb-2">
                <span className="font-semibold">Last Check:</span>{' '}
                {new Date(healthData.timestamp).toLocaleString()}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Connection Details */}
            {healthData && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Status</div>
                    <div className="text-white font-semibold">{healthData.status}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">API Connection</div>
                    <div className="text-green-400 font-semibold">Active</div>
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard Link */}
            <div className="mt-6">
              <a
                href="#dashboard"
                className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                onClick={() => log.info('Navigating to dashboard from landing page')}
              >
                View Full Monitoring Dashboard
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-gray-400 text-sm">
            <p>Frontend service running on port {import.meta.env.VITE_PORT || '3000'}</p>
            <p className="mt-1">Backend API: {import.meta.env.VITE_API_URL || 'http://localhost:3001'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
