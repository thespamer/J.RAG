import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import {
  Save as SaveIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Memory as MemoryIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import axios from '../../services/axios';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';

const models = [
  {
    id: 'deepseek-7b',
    name: 'DeepSeek LLM 7B',
    description: 'Optimized for code and technical content'
  }
];

const templates = [
  {
    name: 'RAG Template',
    content: 'Given the context:\n{context}\n\nAnswer the question: {question}'
  },
  {
    name: 'Code Generation',
    content: 'Write a function that:\n\nRequirements:\n{requirements}\n\nUse {language} programming language.'
  },
  {
    name: 'Technical Analysis',
    content: 'Analyze the following code and explain:\n\n{code}\n\nFocus on:\n1. Architecture\n2. Best practices\n3. Potential improvements'
  }
];

const defaultModelConfig = {
  temperature: 0.7,
  maxTokens: 1024,
  topP: 0.9,
  presencePenalty: 0,
  frequencyPenalty: 0,
  lowCpuMemUsage: true,
  useSafetensors: true,
  offloadEnabled: false
};

function PromptStudio() {
  const [selectedModel, setSelectedModel] = React.useState('deepseek-7b');
  const [prompt, setPrompt] = React.useState('');
  const [response, setResponse] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [savedPrompts, setSavedPrompts] = React.useState([]);
  const [modelConfig, setModelConfig] = React.useState(defaultModelConfig);
  const [openConfigDialog, setOpenConfigDialog] = React.useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [promptName, setPromptName] = React.useState('');
  const [responseFormat, setResponseFormat] = React.useState('text');
  const [modelStatus, setModelStatus] = React.useState({
    status: 'unknown',
    downloadProgress: 0,
    loadProgress: 0,
    error: null,
    integrityCheck: null
  });
  const [systemStatus, setSystemStatus] = React.useState({
    memory: { available: 0, total: 0 }
  });

  React.useEffect(() => {
    loadSavedPrompts();
    
    // Fetch model and system status periodically
    const fetchStatus = async () => {
      try {
        const [modelRes, systemRes] = await Promise.all([
          axios.get('/models/status'),
          axios.get('/system/status')
        ]);
        setModelStatus(modelRes.data);
        setSystemStatus(systemRes.data);
      } catch (error) {
        console.error('Error fetching status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSavedPrompts = async () => {
    try {
      const response = await axios.get('/prompts');
      setSavedPrompts(response.data);
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  };

  const handleModelChange = (event) => {
    setSelectedModel(event.target.value);
  };

  const handleTemplateSelect = (template) => {
    setPrompt(template.content);
  };

  const handleConfigChange = (field) => (event, value) => {
    const newValue = value !== undefined ? value : 
      field === 'lowCpuMemUsage' || field === 'useSafetensors' || field === 'offloadEnabled' ? 
      event.target.checked : event.target.value;

    setModelConfig({
      ...modelConfig,
      [field]: newValue
    });

    // If this is a memory optimization setting, update it on the backend
    if (['lowCpuMemUsage', 'useSafetensors', 'offloadEnabled'].includes(field)) {
      updateSystemConfig({ [field]: newValue });
    }
  };

  const updateSystemConfig = async (config) => {
    try {
      await axios.post('/system/config', config);
    } catch (error) {
      setError('Error updating system configuration');
      console.error('Error updating config:', error);
    }
  };

  const handleSubmit = async () => {
    if (modelStatus.status !== 'ready') {
      setError('Model is not ready. Please wait for it to finish loading.');
      return;
    }

    setLoading(true);
    setError('');
    setResponse('');

    try {
      const response = await axios.post('/prompt/generate', {
        prompt,
        model: selectedModel,
        config: modelConfig
      });

      setResponse(response.data.response);
    } catch (error) {
      setError(error.response?.data?.error || 'Error generating response');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrompt = async () => {
    try {
      await axios.post('/prompts', {
        name: promptName,
        prompt,
        model: selectedModel,
        config: modelConfig
      });
      setSaveDialogOpen(false);
      setPromptName('');
      loadSavedPrompts();
    } catch (error) {
      setError(error.response?.data?.error || 'Error saving prompt');
    }
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(response);
  };

  const handleFormatCode = () => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
    let formattedResponse = response;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const [fullMatch, lang, code] = match;
      const language = lang || 'text';
      
      try {
        const highlighted = Prism.highlight(
          code,
          Prism.languages[language] || Prism.languages.text,
          language
        );
        
        formattedResponse = formattedResponse.replace(
          fullMatch,
          `<pre class="language-${language}"><code>${highlighted}</code></pre>`
        );
      } catch (error) {
        console.error('Error formatting code:', error);
      }
    }

    setResponse(formattedResponse);
    setResponseFormat('code');
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Prompt Studio
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setOpenConfigDialog(true)}
            sx={{ mr: 1 }}
          >
            Model Settings
          </Button>
          <Button
            variant="outlined"
            startIcon={<MemoryIcon />}
            onClick={() => setOpenConfigDialog(true)}
          >
            Memory Settings
          </Button>
        </Box>
      </Box>

      {/* Model Status Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              DeepSeek LLM 7B Status
            </Typography>
            {modelStatus.status === 'ready' && (
              <CheckCircleIcon color="success" />
            )}
            {modelStatus.status === 'error' && (
              <ErrorIcon color="error" />
            )}
          </Box>

          {modelStatus.status === 'downloading' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Downloading model files...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={modelStatus.downloadProgress}
              />
              <Typography variant="caption" color="textSecondary">
                {modelStatus.downloadProgress.toFixed(1)}%
              </Typography>
            </Box>
          )}

          {modelStatus.status === 'loading' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Loading model into memory...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={modelStatus.loadProgress}
              />
              <Typography variant="caption" color="textSecondary">
                {modelStatus.loadProgress.toFixed(1)}%
              </Typography>
            </Box>
          )}

          {modelStatus.integrityCheck && (
            <Alert 
              severity={modelStatus.integrityCheck.passed ? "success" : "error"}
              sx={{ mt: 1 }}
            >
              {modelStatus.integrityCheck.message}
            </Alert>
          )}

          {modelStatus.error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {modelStatus.error}
            </Alert>
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary">
              Available Memory: {formatBytes(systemStatus.memory.available)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Model</InputLabel>
                <Select
                  value={selectedModel}
                  label="Model"
                  onChange={handleModelChange}
                >
                  {models.map((model) => (
                    <MenuItem key={model.id} value={model.id}>
                      <Box>
                        <Typography variant="subtitle1">
                          {model.name}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {model.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Typography variant="h6" gutterBottom>
              Prompt
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Editor
                height="300px"
                language="markdown"
                value={prompt}
                onChange={setPrompt}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  fontSize: 14,
                  wordWrap: 'on'
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!prompt || loading}
              >
                Generate
                {loading && (
                  <CircularProgress size={24} sx={{ ml: 1 }} />
                )}
              </Button>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={() => setSaveDialogOpen(true)}
                disabled={!prompt}
              >
                Save Prompt
              </Button>
            </Box>

            {response && (
              <Paper sx={{ p: 2, mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6">
                    Response
                  </Typography>
                  <Box>
                    <Tooltip title="Copy Response">
                      <IconButton onClick={handleCopyResponse}>
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Format as Code">
                      <IconButton onClick={handleFormatCode}>
                        <CodeIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Regenerate">
                      <IconButton onClick={handleSubmit} disabled={loading}>
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                {responseFormat === 'code' ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: response }}
                    style={{
                      backgroundColor: '#2d2d2d',
                      padding: '16px',
                      borderRadius: '4px',
                      overflowX: 'auto'
                    }}
                  />
                ) : (
                  <Editor
                    height="300px"
                    language="markdown"
                    value={response}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      lineNumbers: 'on',
                      fontSize: 14,
                      wordWrap: 'on'
                    }}
                  />
                )}
              </Paper>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Templates
            </Typography>
            <Grid container spacing={2}>
              {templates.map((template) => (
                <Grid item xs={12} key={template.name}>
                  <Paper
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover'
                      }
                    }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <Typography variant="subtitle1">
                      {template.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      sx={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {template.content}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {savedPrompts.length > 0 && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Saved Prompts
              </Typography>
              <Grid container spacing={2}>
                {savedPrompts.map((saved, index) => (
                  <Grid item xs={12} key={index}>
                    <Paper
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                      onClick={() => {
                        setPrompt(saved.prompt);
                        setSelectedModel(saved.model);
                        setModelConfig(saved.config || defaultModelConfig);
                      }}
                    >
                      <Typography variant="subtitle2">
                        {saved.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {saved.prompt}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Model: {saved.model}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}
        </Grid>
      </Grid>

      <Dialog
        open={openConfigDialog}
        onClose={() => setOpenConfigDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Model Configuration
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            Generation Settings
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom>Temperature: {modelConfig.temperature}</Typography>
            <Slider
              value={modelConfig.temperature}
              onChange={handleConfigChange('temperature')}
              min={0}
              max={1}
              step={0.1}
              marks
              valueLabelDisplay="auto"
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom>Max Tokens: {modelConfig.maxTokens}</Typography>
            <Slider
              value={modelConfig.maxTokens}
              onChange={handleConfigChange('maxTokens')}
              min={256}
              max={2048}
              step={256}
              marks
              valueLabelDisplay="auto"
            />
          </Box>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            Memory Optimization
          </Typography>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={modelConfig.lowCpuMemUsage}
                  onChange={handleConfigChange('lowCpuMemUsage')}
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
                  onChange={handleConfigChange('useSafetensors')}
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
                  onChange={handleConfigChange('offloadEnabled')}
                />
              }
              label="Enable Weight Offloading"
            />
            <Typography variant="caption" color="textSecondary" display="block">
              Offload model weights to disk when memory is constrained
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfigDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
      >
        <DialogTitle>Save Prompt</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Prompt Name"
            fullWidth
            value={promptName}
            onChange={(e) => setPromptName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePrompt} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PromptStudio;
