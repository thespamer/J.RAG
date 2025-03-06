import React from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Warning as WarningIcon,
  DeleteSweep as CleanupIcon
} from '@mui/icons-material';

function MemoryMonitor() {
  const [memoryStats, setMemoryStats] = React.useState({
    ram: {
      used: 0,
      total: 0,
      percentage: 0
    },
    cache: {
      size: 0,
      limit: 10 * 1024, // 10GB in MB
      percentage: 0
    },
    offload: {
      size: 0,
      limit: 20 * 1024, // 20GB in MB
      percentage: 0
    }
  });

  const fetchMemoryStats = async () => {
    try {
      const response = await fetch('/api/system/memory');
      const data = await response.json();
      setMemoryStats(data);
    } catch (error) {
      console.error('Error fetching memory stats:', error);
    }
  };

  React.useEffect(() => {
    fetchMemoryStats();
    const interval = setInterval(fetchMemoryStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCleanup = async () => {
    try {
      await fetch('/api/system/cleanup-cache', { method: 'POST' });
      fetchMemoryStats();
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  };

  const formatSize = (mb) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${Math.round(mb)}MB`;
  };

  const MemoryBar = ({ value, limit, label, warning = 80 }) => (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            {formatSize(value)} / {formatSize(limit)}
          </Typography>
          {(value / limit * 100) > warning && (
            <Tooltip title="High usage warning">
              <WarningIcon color="warning" sx={{ ml: 1, fontSize: 16 }} />
            </Tooltip>
          )}
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min((value / limit) * 100, 100)}
        color={(value / limit * 100) > warning ? "warning" : "primary"}
      />
    </Box>
  );

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Memory Usage
        </Typography>
        <Tooltip title="Clean up cache">
          <IconButton size="small" onClick={handleCleanup}>
            <CleanupIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <MemoryBar
        value={memoryStats.ram.used}
        limit={memoryStats.ram.total}
        label="RAM Usage"
        warning={90}
      />

      <MemoryBar
        value={memoryStats.cache.size}
        limit={memoryStats.cache.limit}
        label="Cache Storage"
      />

      <MemoryBar
        value={memoryStats.offload.size}
        limit={memoryStats.offload.limit}
        label="Model Offload"
      />

      {(memoryStats.ram.percentage > 90 || memoryStats.cache.percentage > 80) && (
        <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
          High memory usage detected. Consider cleaning up cache or enabling model offloading.
        </Typography>
      )}
    </Paper>
  );
}

export default MemoryMonitor;
