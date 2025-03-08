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
  CardContent
} from '@mui/material';
import {
  Upload as UploadIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import axios from '../../services/axios';

const SUPPORTED_TYPES = ['.pdf', '.txt', '.doc', '.docx'];
const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

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
    model: {
      status: 'unknown',
      downloadProgress: 0,
      loadProgress: 0,
      error: null
    }
  });

  React.useEffect(() => {
    // Fetch system status periodically
    const fetchSystemStatus = async () => {
      try {
        const response = await axios.get('/health');
        if (response.data.system?.model) {
          setSystemStatus({
            model: response.data.system.model
          });
        }
      } catch (error) {
        console.error('Error fetching system status:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch system status';
        setSystemStatus({
          model: {
            status: 'error',
            error: errorMessage,
            downloadProgress: 0,
            loadProgress: 0
          }
        });
      }
    };

    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 5000);
    return () => clearInterval(interval);
  }, []);


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
                  'Loading model. Please wait while the model is being initialized.'}
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
    return (
      <Box sx={{ mt: 2 }}>
        <Grid container spacing={2}>
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
                    <Typography variant="subtitle1">Model Status</Typography>
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
