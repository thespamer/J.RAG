// API configuration
export const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3000') + '/api';  // Backend API URL from environment variable

// System requirements
export const MIN_DISK_SPACE = 1024 * 1024 * 1024; // 1GB
export const MIN_MEMORY = 512 * 1024 * 1024; // 512MB

// Model configuration
export const MODEL_CONFIG = {
    lowCpuMemUsage: true,
    useSafetensors: true,
    offloadEnabled: true,
    deviceMap: 'auto'
};

// File upload configuration
export const UPLOAD_CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['.pdf', '.txt', '.doc', '.docx'],
    maxConcurrent: 5
};

// Analytics configuration
export const ANALYTICS_CONFIG = {
    enabled: true,
    refreshInterval: 5000, // 5 seconds
    retentionDays: 30
};

// Cache configuration
export const CACHE_CONFIG = {
    cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 100 * 1024 * 1024 // 100MB
};

// UI Configuration
export const UI_CONFIG = {
    theme: 'light',
    sidebarWidth: 240,
    headerHeight: 64
};
