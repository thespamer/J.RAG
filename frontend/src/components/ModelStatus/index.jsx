import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

function ModelStatus() {
  const [status, setStatus] = React.useState({
    state: 'loading', // loading, ready, error
    message: '',
    details: {}
  });

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/model/status');
      const data = await response.json();
      
      setStatus({
        state: data.model_loaded ? 'ready' : data.error ? 'error' : 'loading',
        message: data.message || '',
        details: {
          device: data.device || 'unknown',
          memoryUsage: data.memory_usage || {},
          lastError: data.last_error
        }
      });
    } catch (error) {
      setStatus({
        state: 'error',
        message: 'Failed to fetch model status',
        details: { lastError: error.message }
      });
    }
  };

  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const renderIcon = () => {
    switch (status.state) {
      case 'ready':
        return <CheckIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <CircularProgress size={20} />;
    }
  };

  const getTooltipContent = () => {
    const { details } = status;
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2">
          Device: {details.device}
        </Typography>
        {details.memoryUsage && (
          <>
            <Typography variant="body2">
              RAM Usage: {Math.round(details.memoryUsage.rss)}MB
            </Typography>
            <Typography variant="body2">
              Cache Size: {Math.round(details.memoryUsage.cache_size)}MB
            </Typography>
            <Typography variant="body2">
              Offload Size: {Math.round(details.memoryUsage.offload_size)}MB
            </Typography>
          </>
        )}
        {details.lastError && (
          <Typography variant="body2" color="error">
            Error: {details.lastError}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={getTooltipContent()} arrow>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {renderIcon()}
          <Typography
            variant="body2"
            sx={{ ml: 1 }}
            color={status.state === 'error' ? 'error' : 'textPrimary'}
          >
            Model: {status.state === 'ready' ? 'Ready' : status.message}
          </Typography>
        </Box>
      </Tooltip>
      
      <IconButton
        size="small"
        onClick={fetchStatus}
        sx={{ ml: 1 }}
      >
        <RefreshIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export default ModelStatus;
