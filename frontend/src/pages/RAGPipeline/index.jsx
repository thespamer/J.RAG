import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Tooltip,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Upload as UploadIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Storage as StorageIcon,

  Folder as FolderIcon,
  Warning as WarningIcon,
  CleaningServices as CleaningServicesIcon
} from '@mui/icons-material';
import axios from '../../services/axios';

const SUPPORTED_TYPES = ['.pdf', '.txt', '.doc', '.docx'];
const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

// Requisitos do DeepSeek LLM 7B (10GB para arquivos do modelo, cache e offload)
const MIN_DISK_SPACE = 10 * 1024 * 1024 * 1024;

// Requisitos de memória mínimos (2GB RAM)
const MIN_MEMORY = 2 * 1024 * 1024 * 1024;

const steps = [
  'Upload Documents',
  'Configure Pipeline',
  'Process Documents',
  'Test Query'
];

const pipelineConfigs = {
  chunkSize: [500, 1000, 2000],
  overlap: [100, 200, 300],
  model: ['all-MiniLM-L6-v2', 'all-mpnet-base-v2'],
  maxTokens: [256, 512, 1024, 2048],
  temperature: [0.1, 0.3, 0.5, 0.7, 0.9]
};

function RAGPipeline() {
  const [activeStep, setActiveStep] = React.useState(0);
  const [files, setFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [response, setResponse] = React.useState('');
  const [error, setError] = React.useState('');
  const [config, setConfig] = React.useState({
    chunkSize: 1000,
    overlap: 200,
    model: 'all-MiniLM-L6-v2',
    maxTokens: 512,
    temperature: 0.7
  });
  const [results, setResults] = React.useState([]);
  const [uploadProgress, setUploadProgress] = React.useState({});
  const [processingStatus, setProcessingStatus] = React.useState({});
  const [systemStatus, setSystemStatus] = React.useState({
    disk_space: { available: 0, total: 0, used: 0, warnings: [] },
    cpu: { usage: 0, count: 0 },
    model: {
      status: 'unknown',
      downloadProgress: 0,
      loadProgress: 0,
      error: null
    },
    warnings: [],
    errors: [],
    directories: {},
    lastCleanup: null
  });
  const [cleaningSystem, setCleaningSystem] = React.useState(false);
  const [cleanupError, setCleanupError] = React.useState('');

  React.useEffect(() => {
    // Fetch system status periodically
    const fetchSystemStatus = async () => {
      try {
        const response = await axios.get('/health');
        if (response.data.system) {
          const systemData = response.data.system;
          
          // Verificar se os dados são válidos
          if (!systemData.disk_space) {
            throw new Error('Invalid system status data received');
          }
          
          // Garantir que todos os campos necessários existem
          const disk_space = {
            total: systemData.disk_space.total || 0,
            used: systemData.disk_space.used || 0,
            available: systemData.disk_space.available || 0,
            percent_used: systemData.disk_space.percent_used || 0,
            warnings: systemData.disk_space.warnings || [],
            error: systemData.disk_space.error || null
          };
          
          // Verificar se os valores são válidos
          if (disk_space.total === 0) {
            throw new Error('Invalid disk space values');
          }
          
          // Consolidar todos os erros e avisos
          const allErrors = [];
          const allWarnings = [];
          
          // Adicionar erros e avisos do disco
          if (disk_space.error) {
            allErrors.push(disk_space.error);
          }
          allWarnings.push(...disk_space.warnings);
          
          // Adicionar erros e avisos gerais do sistema
          if (systemData.errors?.length > 0) {
            allErrors.push(...systemData.errors);
          }
          if (systemData.warnings?.length > 0) {
            allWarnings.push(...systemData.warnings);
          }
          
          // Verificar se houve erro durante a limpeza
          if (cleaningSystem && systemData.cleanup_error) {
            allErrors.push(systemData.cleanup_error);
            setCleanupError(systemData.cleanup_error);
          }
          
          // Verificar se a limpeza foi bem-sucedida
          if (cleaningSystem && systemData.cleanup_success) {
            allWarnings.push(systemData.cleanup_success);
            setCleanupError('');
            setCleaningSystem(false);
          }
          
          // Remover duplicatas e atualizar o estado
          setSystemStatus({
            disk_space,
            cpu: systemData.cpu || { usage: 0, count: 0 },
            model: systemData.model || {
              status: 'unknown',
              downloadProgress: 0,
              loadProgress: 0,
              error: null
            },
            warnings: Array.from(new Set(allWarnings)),
            errors: Array.from(new Set(allErrors)),
            directories: systemData.directories || {},
            lastCleanup: systemData.lastCleanup
          });
        }
      } catch (error) {
        console.error('Error fetching system status:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch system status';
        setSystemStatus(prev => ({
          ...prev,
          errors: Array.from(new Set([...prev.errors, errorMessage]))
        }));
        
        // Se houver erro durante a limpeza, atualizar estado
        if (cleaningSystem) {
          setCleanupError(errorMessage);
          setCleaningSystem(false);
        }
      }
    };

    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const validateSystemResources = () => {
    const errors = [];
    
    // Verificar se temos dados válidos do sistema
    if (!systemStatus.disk_space) {
      errors.push('Unable to verify system resources. System status data is not available.');
      return errors;
    }
    
    // Verificar espaço em disco para o modelo DeepSeek LLM 7B
    if (systemStatus.disk_space.available < MIN_DISK_SPACE) {
      errors.push(
        `Insufficient disk space for DeepSeek LLM 7B.\n` +
        `Available: ${formatBytes(systemStatus.disk_space.available)}\n` +
        `Required: ${formatBytes(MIN_DISK_SPACE)} (10GB for model files, cache and offload)\n` +
        `Total: ${formatBytes(systemStatus.disk_space.total)}\n` +
        `Used: ${formatBytes(systemStatus.disk_space.used)}\n\n` +
        `Please clean up unused files to free up disk space.`
      );
    }
    
    // Verificar avisos do sistema
    if (systemStatus.warnings?.length > 0) {
      errors.push(
        `System Warnings:\n${systemStatus.warnings.map(w => `• ${w}`).join('\n')}`
      );
    }
    
    // Verificar erros do sistema
    if (systemStatus.errors?.length > 0) {
      errors.push(
        `System Errors:\n${systemStatus.errors.map(e => `• ${e.message || e}`).join('\n')}`
      );
    }
    
    return errors;
  };

  const validateFile = (file) => {
    const errors = [];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!SUPPORTED_TYPES.includes(ext)) {
      errors.push(`File type ${ext} not supported. Supported types: ${SUPPORTED_TYPES.join(', ')}`);
    }
    
    if (file.size > FILE_SIZE_LIMIT) {
      errors.push(`File size exceeds limit of ${FILE_SIZE_LIMIT / 1024 / 1024}MB`);
    }
    
    return errors;
  };

  const handleFileUpload = (event) => {
    const newFiles = Array.from(event.target.files);
    const errors = [];
    
    newFiles.forEach(file => {
      const fileErrors = validateFile(file);
      if (fileErrors.length > 0) {
        errors.push(`${file.name}: ${fileErrors.join(', ')}`);
      }
    });
    
    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }
    
    setFiles(newFiles);
    setError('');
    setUploadProgress({});
  };

  const handleDeleteFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[index];
      return newProgress;
    });
  };

  const handleConfigChange = (field) => (event) => {
    setConfig({
      ...config,
      [field]: event.target.value
    });
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleCleanup = async () => {
    try {
      setCleaningSystem(true);
      setCleanupError('');
      
      // Tentar limpar o sistema
      const cleanupResponse = await axios.post('/system/cleanup');
      if (cleanupResponse.data.error) {
        throw new Error(cleanupResponse.data.error);
      }
      
      // Forçar atualização imediata do status
      const response = await axios.get('/health');
      if (response.data.system) {
        const { disk_space } = response.data.system;
        if (!disk_space) {
          throw new Error('Invalid system status data received');
        }
        
        setSystemStatus(prev => ({
          ...prev,
          disk_space: {
            total: disk_space.total || 0,
            used: disk_space.used || 0,
            available: disk_space.available || 0,
            percent_used: disk_space.percent_used || 0,
            warnings: disk_space.warnings || []
          }
        }));
      }
    } catch (error) {
      console.error('Error cleaning system:', error);
      setCleanupError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'An unexpected error occurred while cleaning the system'
      );
    } finally {
      setCleaningSystem(false);
    }
  };

  const getStatusColor = (available, minimum) => {
    // Verificar se temos espaço suficiente para o DeepSeek LLM
    if (available < minimum) return 'error';
    
    // Ser mais conservador devido aos arquivos temporários
    if (available < minimum * 1.5) return 'warning'; // Menos de 15GB livre
    return available < minimum * 2 ? 'primary' : 'success'; // Menos de 20GB livre
  };

  const renderModelStatus = () => {
    const { status, download_progress, error } = systemStatus.model;
    
    let statusColor = 'primary';
    let statusIcon = <CircularProgress size={24} />;
    let statusText = 'Initializing...';
    
    switch (status) {
      case 'downloading':
        statusText = 'Downloading DeepSeek LLM model...';
        break;
      case 'loading_tokenizer':
        statusText = 'Loading tokenizer...';
        break;
      case 'ready':
        statusColor = 'success';
        statusIcon = <CheckCircleIcon color="success" />;
        statusText = 'Model ready';
        break;
      case 'error':
        statusColor = 'error';
        statusIcon = <ErrorIcon color="error" />;
        statusText = error || 'Error loading model';
        break;
      default:
        statusText = 'Checking model status...';
    }
    
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center">
              <SettingsIcon sx={{ mr: 1 }} color={statusColor} />
              <Typography variant="subtitle1">DeepSeek LLM Status</Typography>
            </Box>
            {statusIcon}
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {statusText}
          </Typography>
          
          {(status === 'downloading' || status === 'loading_tokenizer') && (
            <Box sx={{ mt: 2 }}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  {status === 'downloading' ? 'Download progress' : 'Loading progress'}
                </Typography>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 'medium' }}>
                  {download_progress.toFixed(1)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={download_progress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {status === 'downloading' ? 
                  'Downloading model files. This may take a while. Please ensure you have a stable internet connection.' :
                  'Loading model into memory. This process uses disk offloading to optimize memory usage.'}
              </Typography>
            </Box>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <AlertTitle>Error Loading Model</AlertTitle>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSystemStatus = () => {
    // Calcular porcentagem de uso do disco
    const diskUsagePercent = systemStatus.disk_space.percent_used || (systemStatus.disk_space.used / systemStatus.disk_space.total * 100) || 0;
    
    // Verificar se o espaço em disco é suficiente para o DeepSeek LLM
    const diskColor = getStatusColor(systemStatus.disk_space.available, MIN_DISK_SPACE);
    
    return (
      <Box sx={{ mt: 2 }}>
        {/* Alertas do sistema */}
        {systemStatus.errors?.length > 0 && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
          >
            <AlertTitle>System Errors</AlertTitle>
            <List dense disablePadding>
              {Array.from(new Set(systemStatus.errors)).map((error, index) => {
                const errorMessage = typeof error === 'string' ? error : 
                  error.message || error.error || error.detail || 
                  (error.response?.data?.error || error.response?.data?.message) || 
                  'Unknown error';
                return (
                  <ListItem key={index} disablePadding>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <ErrorIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={errorMessage}
                      sx={{ '& .MuiTypography-root': { wordBreak: 'break-word' } }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Alert>
        )}
        
        {systemStatus.warnings?.length > 0 && (
          <Alert 
            severity="warning" 
            sx={{ mb: 2 }}
          >
            <AlertTitle>System Warnings</AlertTitle>
            <List dense disablePadding>
              {Array.from(new Set(systemStatus.warnings)).map((warning, index) => {
                const warningMessage = typeof warning === 'string' ? warning :
                  warning.message || warning.warning || warning.detail || 'Unknown warning';
                return (
                  <ListItem key={index} disablePadding>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <WarningIcon color="warning" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={warningMessage}
                      sx={{ '& .MuiTypography-root': { wordBreak: 'break-word' } }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Alert>
        )}
        
        {/* Alerta de erro na limpeza do sistema */}
        {cleanupError && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            onClose={() => setCleanupError('')}
          >
            <AlertTitle>Error Cleaning System</AlertTitle>
            {cleanupError}
          </Alert>
        )}

        {/* Alerta de recursos insuficientes */}
        {systemStatus.disk_space.available < MIN_DISK_SPACE && (
          <Alert 
            severity="error"
            action={
              systemStatus.disk_space.available < MIN_DISK_SPACE && (
                <Button
                  variant="contained"
                  size="small"
                  color="error"
                  onClick={handleCleanup}
                  startIcon={<CleaningServicesIcon />}
                >
                  Clean System
                </Button>
              )
            }
            sx={{ mb: 2 }}
          >
            <AlertTitle>DeepSeek LLM System Requirements Not Met</AlertTitle>
            <Box sx={{ mb: 1 }}>
              <Typography variant="subtitle2" color="error.dark" sx={{ mb: 1 }}>
                The DeepSeek LLM 7B model requires disk space for model files, cache, and offload storage:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <StorageIcon fontSize="small" color={systemStatus.disk_space.available < MIN_DISK_SPACE ? 'error' : 'success'} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`10GB of free disk space for model files and cache`}
                    secondary={
                      systemStatus.disk_space.available < MIN_DISK_SPACE ? 
                      `Available: ${formatBytes(systemStatus.disk_space.available)} (Need ${formatBytes(MIN_DISK_SPACE - systemStatus.disk_space.available)} more)` : 
                      'Requirement met'
                    }
                  />
                </ListItem>
              </List>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={cleaningSystem}
                onClick={handleCleanup}
                startIcon={cleaningSystem ? <CircularProgress size={16} /> : <CleaningServicesIcon />}
              >
                {cleaningSystem ? 'Cleaning...' : 'Clean System'}
              </Button>
              <Button 
                color="inherit" 
                size="small"
                onClick={() => window.open('https://docs.codeium.com/q-rag/requirements', '_blank')}
              >
                Learn More
              </Button>
            </Box>
          </Alert>
        )}
        
        <Typography variant="h6" gutterBottom>
          System Status
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center">
                    <StorageIcon 
                      sx={{ mr: 1 }} 
                      color={systemStatus.disk_space.available < MIN_DISK_SPACE ? 'error' : 'primary'} 
                    />
                    <Typography variant="subtitle1">DeepSeek LLM Storage</Typography>
                  </Box>
                  <Typography 
                    variant="subtitle2" 
                    color={diskUsagePercent > 90 ? 'error.main' : 
                           diskUsagePercent > 80 ? 'warning.main' : 
                           'primary.main'}
                    sx={{ fontWeight: 'bold' }}
                  >
                    {diskUsagePercent.toFixed(1)}% Used
                  </Typography>
                </Box>
                <Box mt={2}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Available Space:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={systemStatus.disk_space.available < MIN_DISK_SPACE ? 'error.main' : 'success.main'}
                      sx={{ fontWeight: 'medium' }}
                    >
                      {formatBytes(systemStatus.disk_space.available)}
                      {systemStatus.disk_space.available < MIN_DISK_SPACE && (
                        <Typography 
                          component="span" 
                          color="error" 
                          sx={{ ml: 1, fontSize: 'inherit', fontWeight: 'medium' }}
                        >
                          (Need {formatBytes(MIN_DISK_SPACE - systemStatus.disk_space.available)} more)
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Required: 10 GB for model files, cache, and disk offload storage
                  </Typography>
                  
                  <LinearProgress 
                    variant="determinate" 
                    value={diskUsagePercent}
                    color={diskUsagePercent > 90 ? 'error' : 
                           diskUsagePercent > 80 ? 'warning' : 
                           'primary'}
                    sx={{ height: 8, borderRadius: 4, mb: 1 }}
                  />
                  
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(systemStatus.disk_space.used)} used of {formatBytes(systemStatus.disk_space.total)} total
                  </Typography>
                  
                  {systemStatus.disk_space.available < MIN_DISK_SPACE && (
                    <Alert 
                      severity="error" 
                      sx={{ mt: 2 }}
                      action={
                        <Button
                          variant="contained"
                          size="small"
                          color="error"
                          disabled={cleaningSystem}
                          onClick={handleCleanup}
                          startIcon={cleaningSystem ? <CircularProgress size={16} /> : <CleaningServicesIcon />}
                        >
                          {cleaningSystem ? 'Cleaning...' : 'Clean System'}
                        </Button>
                      }
                    >
                      <AlertTitle>Insufficient Space for DeepSeek LLM</AlertTitle>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        The model requires at least 10GB of free space for:
                      </Typography>
                      <Typography variant="body2" component="div" sx={{ pl: 2 }}>
                        • Model files and cache storage<br />
                        • Weight offloading during inference<br />
                        • Temporary files during download
                      </Typography>
                    </Alert>
                  )}
                  
                  {cleanupError && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      <AlertTitle>Error During Cleanup</AlertTitle>
                      {cleanupError}
                    </Alert>
                  )}
                  
                  {systemStatus.lastCleanup && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Last cleanup: {new Date(systemStatus.lastCleanup).toLocaleString()}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center">
                    <MemoryIcon 
                      sx={{ mr: 1 }} 
                      color={systemStatus.memory.available < MIN_MEMORY ? 'error' : 'primary'} 
                    />
                    <Typography variant="subtitle1">DeepSeek LLM Memory</Typography>
                  </Box>
                  <Typography 
                    variant="subtitle2" 
                    color={memoryUsagePercent > 90 ? 'error.main' : 
                           memoryUsagePercent > 80 ? 'warning.main' : 
                           'primary.main'}
                    sx={{ fontWeight: 'bold' }}
                  >
                    {memoryUsagePercent.toFixed(1)}% Used
                  </Typography>
                </Box>
                <Box mt={2}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Available Memory:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={systemStatus.memory.available < MIN_MEMORY ? 'error.main' : 'success.main'}
                      sx={{ fontWeight: 'medium' }}
                    >
                      {formatBytes(systemStatus.memory.available)}
                      {systemStatus.memory.available < MIN_MEMORY && (
                        <Typography 
                          component="span" 
                          color="error" 
                          sx={{ ml: 1, fontSize: 'inherit', fontWeight: 'medium' }}
                        >
                          (Need {formatBytes(MIN_MEMORY - systemStatus.memory.available)} more)
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Required: 2 GB with disk offloading enabled
                  </Typography>
                  
                  <LinearProgress 
                    variant="determinate" 
                    value={memoryUsagePercent}
                    color={memoryUsagePercent > 90 ? 'error' : 
                           memoryUsagePercent > 80 ? 'warning' : 
                           'primary'}
                    sx={{ height: 8, borderRadius: 4, mb: 1 }}
                  />
                  
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(systemStatus.memory.used)} used of {formatBytes(systemStatus.memory.total)} total
                  </Typography>
                  
                  {systemStatus.memory.available < MODEL_MEMORY && (
                    <Alert 
                      severity="error" 
                      sx={{ mt: 2 }}
                    >
                      <AlertTitle>Insufficient Memory for DeepSeek LLM</AlertTitle>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        The model is configured to use disk offloading to minimize memory usage:
                      </Typography>
                      <Typography variant="body2" component="div" sx={{ pl: 2 }}>
                        • Model weights are offloaded to disk when not in use<br />
                        • Only 2GB of RAM required (instead of 14GB)<br />
                        • Please close unused applications to free up memory
                      </Typography>
                    </Alert>
                  )}
                  {systemStatus.cpu && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      CPU Usage: {systemStatus.cpu.usage.toFixed(1)}% ({systemStatus.cpu.count} cores)
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Directories Status */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <FolderIcon sx={{ mr: 1 }} />
                  <Typography variant="subtitle1">System Directories</Typography>
                </Box>
                <Grid container spacing={2}>
                  {systemStatus.directories && Object.entries(systemStatus.directories).map(([name, info]) => (
                    <Grid item xs={12} sm={6} md={4} key={name}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2">
                          {name.charAt(0).toUpperCase() + name.slice(1)}
                        </Typography>
                        <Typography variant="body2" color={info.exists ? 'text.secondary' : 'error'}>
                          Status: {info.exists ? (info.writable ? 'Ready' : 'Read-only') : 'Not Found'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                          {info.path}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Model Status */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center">
                    <SettingsIcon 
                      sx={{ mr: 1 }} 
                      color={systemStatus.model.status === 'ready' ? 'success' : 
                        systemStatus.model.status === 'error' ? 'error' : 
                        systemStatus.model.status === 'downloading' || systemStatus.model.status === 'loading' ? 'primary' : 
                        'action'} 
                    />
                    <Typography variant="subtitle1">DeepSeek LLM Status</Typography>
                  </Box>
                  {systemStatus.model.status === 'ready' && (
                    <Tooltip title="Model is ready to use">
                      <CheckCircleIcon color="success" />
                    </Tooltip>
                  )}
                  {systemStatus.model.status === 'error' && (
                    <Tooltip title={systemStatus.model.error || 'Model error'}>
                      <ErrorIcon color="error" />
                    </Tooltip>
                  )}
                  {(systemStatus.model.status === 'downloading' || systemStatus.model.status === 'loading') && (
                    <CircularProgress size={24} color="primary" />
                  )}
                </Box>
                <Box mt={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" color="text.secondary">
                      Status:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={systemStatus.model.status === 'ready' ? 'success.main' : 
                        systemStatus.model.status === 'error' ? 'error.main' : 
                        systemStatus.model.status === 'downloading' || systemStatus.model.status === 'loading' ? 'primary.main' : 
                        'text.primary'}
                      sx={{ fontWeight: 'medium' }}
                    >
                      {systemStatus.model.status.charAt(0).toUpperCase() + systemStatus.model.status.slice(1)}
                    </Typography>
                  </Box>
                  
                  {(systemStatus.model.status === 'downloading' || systemStatus.model.status === 'loading') && (
                    <Box sx={{ mt: 2 }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="text.secondary">
                          {systemStatus.model.status === 'downloading' ? 'Downloading model...' : 'Loading model...'}
                        </Typography>
                        <Typography variant="body2" color="primary" sx={{ fontWeight: 'medium' }}>
                          {(systemStatus.model.status === 'downloading' ? 
                            systemStatus.model.downloadProgress : 
                            systemStatus.model.loadProgress).toFixed(1)}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={systemStatus.model.status === 'downloading' ? 
                          systemStatus.model.downloadProgress : 
                          systemStatus.model.loadProgress}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      {systemStatus.model.status === 'downloading' && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          This may take a while. Please ensure you have a stable internet connection.
                        </Typography>
                      )}
                      {systemStatus.model.status === 'loading' && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Loading model into memory. This process uses disk offloading to optimize memory usage.
                        </Typography>
                      )}
                    </Box>
                  )}
                  
                  {systemStatus.model.error && (
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'flex-start', gap: 1, bgcolor: 'error.lighter', p: 1.5, borderRadius: 1 }}>
                      <ErrorIcon color="error" fontSize="small" sx={{ mt: 0.25 }} />
                      <Box>
                        <Typography variant="body2" color="error" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                          Error Loading Model
                        </Typography>
                        <Typography variant="body2" color="error.dark">
                          {systemStatus.model.error}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const handleProcessDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Validar recursos do sistema
      const systemErrors = validateSystemResources();
      if (systemErrors.length > 0) {
        throw new Error(systemErrors.join('\n'));
      }

      // Validar os documentos
      const validateFormData = new FormData();
      files.forEach((file) => {
        validateFormData.append('files', file);
      });
      
      const validateResponse = await axios.post('/rag/validate', validateFormData);
      const validationResults = validateResponse.data.results;
      
      // Verificar se há arquivos inválidos
      const invalidFiles = validationResults.filter(result => !result.valid);
      if (invalidFiles.length > 0) {
        const errors = invalidFiles.map(file => `${file.filename}: ${file.error}`);
        throw new Error(`Invalid files:\n${errors.join('\n')}`);
      }
      
      // Se todos os arquivos são válidos, prosseguir com o upload
      const formData = new FormData();
      
      // Adicionar cada arquivo ao FormData
      files.forEach((file, index) => {
        formData.append('files', file);
      });
      
      // Adicionar configuração
      formData.append('config', JSON.stringify(config));
      
      // Fazer o upload
      const response = await axios.post('/rag/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          setUploadProgress(prev => ({
            ...prev,
            total: progress
          }));
        }
      });
      
      if (response.data.results) {
        // Verificar erros por arquivo
        const errors = response.data.results
          .filter(r => r.status === 'error')
          .map(r => `${r.name}: ${r.error}`)
          .join('\n');
          
        if (errors) {
          setError(errors);
        } else {
          setActiveStep(prevStep => prevStep + 1);
          setResults(response.data.results);
        }
      }
      
    } catch (error) {
      console.error('Error processing documents:', error);
      setError(error.response?.data?.error || error.message || 'Error processing documents');
    } finally {
      setLoading(false);
      setUploadProgress({});
    }
  };

  const handleQuery = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/rag/query', {
        query,
        config
      });
      
      setResults(response.data.results);
      
      const llmResponse = await axios.post('/prompt/generate', {
        prompt: query,
        config: {
          temperature: config.temperature,
          maxTokens: config.maxTokens
        },
        context: {
          documents: response.data.results.map(r => r.text).join('\n\n')
        }
      });
      
      setResponse(llmResponse.data.response);
    } catch (error) {
      setError(error.response?.data?.error || error.message || 'Error processing query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        RAG Pipeline
      </Typography>

      {renderModelStatus()}
      {renderSystemStatus()}


      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{error}</pre>
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Upload Documents
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Supported file types: {SUPPORTED_TYPES.join(', ')}
              <br />
              Maximum file size: {FILE_SIZE_LIMIT / 1024 / 1024}MB
            </Typography>
            
            <input
              accept={SUPPORTED_TYPES.join(',')}
              style={{ display: 'none' }}
              id="raised-button-file"
              multiple
              type="file"
              onChange={handleFileUpload}
            />
            <label htmlFor="raised-button-file">
              <Button
                variant="contained"
                component="span"
                startIcon={<UploadIcon />}
              >
                Select Files
              </Button>
            </label>

            {files.length > 0 && (
              <List sx={{ mt: 2 }}>
                {files.map((file, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteFile(index)}
                        disabled={loading}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemIcon>
                      {processingStatus[index] === 'completed' ? (
                        <CheckCircleIcon color="success" />
                      ) : processingStatus[index] === 'error' ? (
                        <ErrorIcon color="error" />
                      ) : (
                        <DescriptionIcon />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      secondary={
                        <>
                          {`${(file.size / 1024).toFixed(2)} KB`}
                          {uploadProgress[index] !== undefined && (
                            <Box sx={{ width: '100%', mt: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={uploadProgress[index]} 
                              />
                            </Box>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}

            <Button
              variant="contained"
              color="primary"
              onClick={() => setActiveStep(1)}
              disabled={files.length === 0}
              sx={{ mt: 2 }}
            >
              Next
            </Button>
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configure Pipeline
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Chunk Size</InputLabel>
                  <Select
                    value={config.chunkSize}
                    label="Chunk Size"
                    onChange={handleConfigChange('chunkSize')}
                  >
                    {pipelineConfigs.chunkSize.map((size) => (
                      <MenuItem key={size} value={size}>
                        {size} characters
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Overlap</InputLabel>
                  <Select
                    value={config.overlap}
                    label="Overlap"
                    onChange={handleConfigChange('overlap')}
                  >
                    {pipelineConfigs.overlap.map((size) => (
                      <MenuItem key={size} value={size}>
                        {size} characters
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Embedding Model</InputLabel>
                  <Select
                    value={config.model}
                    label="Embedding Model"
                    onChange={handleConfigChange('model')}
                  >
                    {pipelineConfigs.model.map((model) => (
                      <MenuItem key={model} value={model}>
                        {model}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Max Tokens</InputLabel>
                  <Select
                    value={config.maxTokens}
                    label="Max Tokens"
                    onChange={handleConfigChange('maxTokens')}
                  >
                    {pipelineConfigs.maxTokens.map((tokens) => (
                      <MenuItem key={tokens} value={tokens}>
                        {tokens} tokens
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Temperature</InputLabel>
                  <Select
                    value={config.temperature}
                    label="Temperature"
                    onChange={handleConfigChange('temperature')}
                  >
                    {pipelineConfigs.temperature.map((temp) => (
                      <MenuItem key={temp} value={temp}>
                        {temp} (
                        {temp <= 0.3 ? 'More focused' :
                         temp <= 0.7 ? 'Balanced' : 'More creative'})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(0)}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(2)}
              >
                Next
              </Button>
            </Box>
          </Box>
        )}

        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Process Documents
            </Typography>
            <Typography color="textSecondary" paragraph>
              Ready to process {files.length} document(s) with the following configuration:
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Chunk Size"
                  secondary={`${config.chunkSize} characters`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Overlap"
                  secondary={`${config.overlap} characters`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Embedding Model"
                  secondary={config.model}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Max Tokens"
                  secondary={`${config.maxTokens} tokens`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Temperature"
                  secondary={`${config.temperature} (${
                    config.temperature <= 0.3 ? 'More focused' :
                    config.temperature <= 0.7 ? 'Balanced' : 'More creative'
                  })`}
                />
              </ListItem>
            </List>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(1)}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleProcessDocuments}
                disabled={loading}
              >
                Process
                {loading && (
                  <CircularProgress size={24} sx={{ ml: 1 }} />
                )}
              </Button>
            </Box>
          </Box>
        )}

        {activeStep === 3 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Test Your RAG Pipeline
              </Typography>
              <TextField
                fullWidth
                label="Enter your query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                onClick={handleQuery}
                disabled={!query || loading}
              >
                Submit Query
                {loading && (
                  <CircularProgress size={24} sx={{ ml: 1 }} />
                )}
              </Button>
            </Grid>
            
            {results.length > 0 && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, mt: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Retrieved Documents
                  </Typography>
                  <List>
                    {results.map((result, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1">
                                Document {index + 1}
                              </Typography>
                              <Tooltip title={`Similarity Score: ${result.score.toFixed(3)}`}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: result.score > 0.8 ? 'success.main' :
                                           result.score > 0.5 ? 'warning.main' :
                                           'error.main'
                                  }}
                                >
                                  ({(result.score * 100).toFixed(1)}% match)
                                </Typography>
                              </Tooltip>
                            </Box>
                          }
                          secondary={result.text}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
            )}
            
            {response && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Generated Response
                  </Typography>
                  <Typography
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      backgroundColor: 'grey.100',
                      p: 2,
                      borderRadius: 1
                    }}
                  >
                    {response}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}
      </Paper>
    </Box>
  );
}

export default RAGPipeline;
