/**
 * Dashboard Component
 *
 * Displays real-time health monitoring for all services
 * Auto-refreshes every 10 seconds
 */

import { useState, useEffect } from 'react';
import { fetchDashboardHealth, DashboardHealthResponse } from '../config/api';
import { logger } from '../utils/logger';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'error' | 'checking';
  displayName: string;
}

export default function Dashboard() {
  const [healthData, setHealthData] = useState<DashboardHealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchHealth = async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      const data = await fetchDashboardHealth();
      setHealthData(data);
      setLastCheck(new Date());
      setLoading(false);

      logger.info('Dashboard health data fetched', {
        status: data.status,
        responseTime: data.responseTime,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch health data';
      setError(errorMessage);
      setLoading(false);

      logger.error('Dashboard health fetch failed', { error: errorMessage });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial load and auto-refresh every 10 seconds
  useEffect(() => {
    fetchHealth();

    const interval = setInterval(() => {
      fetchHealth();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    logger.info('Manual refresh triggered');
    fetchHealth();
  };

  const getServiceStatus = (): ServiceStatus[] => {
    if (!healthData) {
      return [
        { name: 'frontend', status: 'checking', displayName: 'Frontend' },
        { name: 'backend', status: 'checking', displayName: 'Backend' },
        { name: 'database', status: 'checking', displayName: 'Database' },
        { name: 'redis', status: 'checking', displayName: 'Redis' },
      ];
    }

    return [
      { name: 'frontend', status: 'ok', displayName: 'Frontend' }, // Frontend is ok if dashboard loads
      { name: 'backend', status: healthData.services.backend as 'ok' | 'error', displayName: 'Backend' },
      { name: 'database', status: healthData.services.database as 'ok' | 'error', displayName: 'Database' },
      { name: 'redis', status: healthData.services.cache as 'ok' | 'error', displayName: 'Redis' },
    ];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ok':
        return 'text-green-600 bg-green-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'checking':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'ok':
        return '✓';
      case 'error':
        return '✗';
      case 'checking':
        return '⟳';
      default:
        return '?';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'ok':
        return 'Healthy';
      case 'error':
        return 'Unhealthy';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const services = getServiceStatus();
  const overallStatus = healthData?.status || 'checking';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Service Health Dashboard</h1>
            <p className="text-gray-600">Real-time monitoring of all services</p>
          </div>
          <a
            href="#"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </a>
        </div>

        {/* Overall Status Banner */}
        <div className={`mb-6 p-4 rounded-lg ${
          overallStatus === 'ready' ? 'bg-green-50 border border-green-200' :
          overallStatus === 'degraded' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-gray-50 border border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Overall Status: {
                  overallStatus === 'ready' ? 'All Systems Healthy' :
                  overallStatus === 'degraded' ? 'Some Systems Degraded' :
                  'Checking...'
                }
              </h2>
              {lastCheck && (
                <p className="text-sm text-gray-600">
                  Last checked: {formatTimestamp(lastCheck)}
                </p>
              )}
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-red-800 font-semibold mb-1">Error</h3>
            <p className="text-red-600">{error}</p>
            <p className="text-sm text-red-500 mt-2">
              The backend may be unreachable. Check that services are running with <code className="bg-red-100 px-1 rounded">make status</code>
            </p>
          </div>
        )}

        {/* Service Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {services.map((service) => (
            <div
              key={service.name}
              className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{service.displayName}</h3>
                <span className={`text-2xl ${getStatusColor(service.status)} px-3 py-1 rounded-full`}>
                  {getStatusIcon(service.status)}
                </span>
              </div>
              <div className="space-y-2">
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(service.status)}`}>
                  {getStatusText(service.status)}
                </div>
                {healthData?.errors?.[service.name] && (
                  <p className="text-xs text-red-600 mt-2" title={healthData.errors[service.name]}>
                    Error: {healthData.errors[service.name].substring(0, 50)}...
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Metrics Section */}
        {healthData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Response Time</h3>
              <p className="text-3xl font-bold text-gray-900">{healthData.responseTime}ms</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Auto-Refresh Interval</h3>
              <p className="text-3xl font-bold text-gray-900">10s</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Last Update</h3>
              <p className="text-xl font-bold text-gray-900">
                {lastCheck ? formatTimestamp(lastCheck) : 'Never'}
              </p>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Troubleshooting</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• Run <code className="bg-blue-100 px-2 py-1 rounded">make status</code> to view CLI service status</li>
            <li>• Run <code className="bg-blue-100 px-2 py-1 rounded">make logs</code> to view service logs</li>
            <li>• Run <code className="bg-blue-100 px-2 py-1 rounded">make logs service=backend</code> to view specific service logs</li>
            <li>• Run <code className="bg-blue-100 px-2 py-1 rounded">make dev</code> to start/restart all services</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
