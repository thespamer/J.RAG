import React from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  LinearProgress,
  Alert,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import axios from '../../services/axios';

function SystemStatus() {
  const [systemStatus, setSystemStatus] = React.useState({
    diskSpace: {
      total: 0,
      used: 0,
      available: 0
    },
    memory: {
      total: 0,
      used: 0,
      available: 0
    },
    model: {
      status: 'unknown', // unknown, downloading, loading, ready, error
      downloadProgress: 0,
      loadProgress: 0,
      error: null,
      integrityCheck: null
    },
    cache: {
      size: 0,
      files: 0,
      lastCleanup: null
    }
  });

  const [modelConfig, setModelConfig] = React.useState({
    lowCpuMemUsage: true,
    useSafetensors: true,
    offloadEnabled: true,
    offloadFolder: '/app/models_cache/offload',
    deviceMap: 'auto',
    minDiskSpace: 10 * 1024 * 1024 * 1024, // 10GB
    minMemory: 2 * 1024 * 1024 * 1024 // 2GB
  });

  const [configDialogOpen, setConfigDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchSystemStatus = async () => {
    try {
      const response = await axios.get('/system/status');
      setSystemStatus(response.data);
    } catch (error) {
      setError(error.response?.data?.error || 'Error fetching system status');
    }
  };

  const handleConfigChange = async (field) => {
    try {
      setLoading(true);
      const newConfig = {
        ...modelConfig,
        [field]: !modelConfig[field]
      };
      
      await axios.post('/system/config', newConfig);
      setModelConfig(newConfig);
    } catch (error) {
      setError(error.response?.data?.error || 'Error updating configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCacheCleanup = async () => {
    try {
      setLoading(true);
      await axios.post('/system/cache/cleanup');
      await fetchSystemStatus();
    } catch (error) {
      setError(error.response?.data?.error || 'Error cleaning cache');
    } finally {
      setLoading(false);
    }
  };

  const handleOffloadFolderChange = async (folder) => {
    try {
      setLoading(true);
      await axios.post('/system/config', {
        ...modelConfig,
        offloadFolder: folder
      });
      setModelConfig(prev => ({
        ...prev,
        offloadFolder: folder
      }));
    } catch (error) {
      setError(error.response?.data?.error || 'Error updating offload folder');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getStatusColor = (value, threshold) => {
    if (value >= threshold.high) return 'error';
    if (value >= threshold.medium) return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          System Status
        </Typography>
        <Box>
          <IconButton onClick={fetchSystemStatus} disabled={loading}>
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={() => setConfigDialogOpen(true)} disabled={loading}>
            <SettingsIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Disk Space Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StorageIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Disk Space
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Available: {formatBytes(systemStatus.diskSpace.available)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(systemStatus.diskSpace.used / systemStatus.diskSpace.total) * 100}
                  color={getStatusColor(
                    (systemStatus.diskSpace.used / systemStatus.diskSpace.total) * 100,
                    { medium: 70, high: 90 }
                  )}
                />
                <Typography variant="caption" color="textSecondary">
                  {formatBytes(systemStatus.diskSpace.used)} of {formatBytes(systemStatus.diskSpace.total)} used
                </Typography>
              </Box>

              {systemStatus.diskSpace.available < 10 * 1024 * 1024 * 1024 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Less than 10GB available disk space. Model download and processing may be affected.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Memory Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <MemoryIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Memory Usage
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Available: {formatBytes(systemStatus.memory.available)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(systemStatus.memory.used / systemStatus.memory.total) * 100}
                  color={getStatusColor(
                    (systemStatus.memory.used / systemStatus.memory.total) * 100,
                    { medium: 80, high: 90 }
                  )}
                />
                <Typography variant="caption" color="textSecondary">
                  {formatBytes(systemStatus.memory.used)} of {formatBytes(systemStatus.memory.total)} used
                </Typography>
              </Box>

              {systemStatus.memory.available < 2 * 1024 * 1024 * 1024 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Less than 2GB available memory. Model performance may be affected.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Model Status Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  DeepSeek LLM 7B Status
                </Typography>
                {systemStatus.model.status === 'ready' && (
                  <CheckCircleIcon color="success" sx={{ ml: 1 }} />
                )}
                {systemStatus.model.status === 'error' && (
                  <ErrorIcon color="error" sx={{ ml: 1 }} />
                )}
              </Box>

              {systemStatus.model.status === 'downloading' && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Downloading model files...
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemStatus.model.downloadProgress}
                  />
                  <Typography variant="caption" color="textSecondary">
                    {systemStatus.model.downloadProgress.toFixed(1)}%
                  </Typography>
                </Box>
              )}

              {systemStatus.model.status === 'loading' && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Loading model into memory...
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemStatus.model.loadProgress}
                  />
                  <Typography variant="caption" color="textSecondary">
                    {systemStatus.model.loadProgress.toFixed(1)}%
                  </Typography>
                </Box>
              )}

              {systemStatus.model.integrityCheck && (
                <Alert 
                  severity={systemStatus.model.integrityCheck.passed ? "success" : "error"}
                  sx={{ mt: 1 }}
                >
                  {systemStatus.model.integrityCheck.message}
                </Alert>
              )}

              {systemStatus.model.error && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {systemStatus.model.error}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Cache Status Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Cache Status
                </Typography>
                <Button
                  startIcon={<DeleteIcon />}
                  onClick={handleCacheCleanup}
                  disabled={loading}
                >
                  Clean Cache
                </Button>
              </Box>

              <Typography variant="body2" color="textSecondary" gutterBottom>
                Cache Size: {formatBytes(systemStatus.cache.size)}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Cached Files: {systemStatus.cache.files}
              </Typography>
              {systemStatus.cache.lastCleanup && (
                <Typography variant="body2" color="textSecondary">
                  Last Cleanup: {new Date(systemStatus.cache.lastCleanup).toLocaleString()}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Model Configuration
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={modelConfig.lowCpuMemUsage}
                  onChange={() => handleConfigChange('lowCpuMemUsage')}
                  disabled={loading}
                />
              }
              label="Low CPU Memory Usage"
            />
            <Typography variant="caption" color="textSecondary" display="block">
              Optimize memory usage during model loading
            </Typography>
          </Box>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={modelConfig.useSafetensors}
                  onChange={() => handleConfigChange('useSafetensors')}
                  disabled={loading}
                />
              }
              label="Use Safetensors"
            />
            <Typography variant="caption" color="textSecondary" display="block">
              Use optimized tensor storage format
            </Typography>
          </Box>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={modelConfig.offloadEnabled}
                  onChange={() => handleConfigChange('offloadEnabled')}
                  disabled={loading}
                />
              }
              label="Enable Weight Offloading"
            />
            <Typography variant="caption" color="textSecondary" display="block">
              Offload model weights to disk when memory is constrained
            </Typography>
          </Box>

          {modelConfig.offloadEnabled && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Offload Folder"
                value={modelConfig.offloadFolder}
                onChange={(e) => handleOffloadFolderChange(e.target.value)}
                disabled={loading}
                helperText="Directory for storing offloaded model weights"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SystemStatus;
