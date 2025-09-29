import React, { useEffect, useState } from 'react';
import type { HealthCheckResponse, ApiResponse } from '@ppm/types';
import { apiService } from '../services/api';

const Home: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response: ApiResponse<HealthCheckResponse> = await apiService.healthCheck();
        if (response.success) {
          setHealthStatus(response.data);
        }
      } catch (error) {
        console.error('Health check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Welcome to PPM FS Challenge
      </h1>
      <p className="text-gray-600 mb-4">
        This is the home page of your application.
      </p>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Server Status</h2>
        {loading ? (
          <p className="text-gray-500">Checking server status...</p>
        ) : healthStatus ? (
          <div className="space-y-2">
            <p className="text-green-600 font-medium">
              Status: {healthStatus.status}
            </p>
            <p className="text-gray-600">
              Message: {healthStatus.message}
            </p>
            {healthStatus.uptime && (
              <p className="text-gray-600">
                Uptime: {healthStatus.uptime} seconds
              </p>
            )}
            {healthStatus.version && (
              <p className="text-gray-600">
                Version: {healthStatus.version}
              </p>
            )}
          </div>
        ) : (
          <p className="text-red-600">Failed to connect to server</p>
        )}
      </div>
    </div>
  );
};

export default Home;