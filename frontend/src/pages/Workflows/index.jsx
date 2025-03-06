import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  LinearProgress,
  Chip,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Save as SaveIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import axios from '../../services/axios';
import { MODEL_CONFIG } from '../../config';

const workflowTemplates = [
  {
    name: 'Document Processing',
    description: 'Process and analyze documents using RAG',
    steps: [
      {
        name: 'Upload Documents',
        type: 'upload',
        config: {
          allowedTypes: ['.pdf', '.txt', '.doc', '.docx'],
          maxSize: 10 * 1024 * 1024 // 10MB
        }
      },
      {
        name: 'Process Documents',
        type: 'process',
        config: {
          chunkSize: 1000,
          overlap: 200,
          model: 'all-MiniLM-L6-v2'
        }
      },
      {
        name: 'Generate Summary',
        type: 'generate',
        config: {
          model: 'deepseek-7b',
          maxTokens: 1024,
          temperature: 0.7,
          lowCpuMemUsage: true,
          useSafetensors: true,
          offloadEnabled: false
        }
      }
    ]
  },
  {
    name: 'Code Analysis',
    description: 'Analyze code repositories and generate documentation',
    steps: [
      {
        name: 'Clone Repository',
        type: 'git',
        config: {
          depth: 1
        }
      },
      {
        name: 'Analyze Code',
        type: 'analyze',
        config: {
          languages: ['python', 'javascript', 'java'],
          excludeDirs: ['node_modules', 'venv', '.git']
        }
      },
      {
        name: 'Generate Documentation',
        type: 'generate',
        config: {
          model: 'deepseek-7b',
          maxTokens: 2048,
          temperature: 0.5,
          lowCpuMemUsage: true,
          useSafetensors: true,
          offloadEnabled: false
        }
      }
    ]
  }
];

const MIN_DISK_SPACE = 10 * 1024 * 1024 * 1024; // 10GB
const MIN_MEMORY = 2 * 1024 * 1024 * 1024; // 2GB

function Workflows() {
  const [workflows, setWorkflows] = React.useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [workflowName, setWorkflowName] = React.useState('');
  const [workflowDescription, setWorkflowDescription] = React.useState('');
  const [workflowSteps, setWorkflowSteps] = React.useState([]);
  const [executionStatus, setExecutionStatus] = React.useState({});
  const [executionResults, setExecutionResults] = React.useState({});
  const [activeStep, setActiveStep] = React.useState(0);
  const [systemStatus, setSystemStatus] = React.useState({
    disk_space: { available: 0, total: 0, used: 0 },
    memory: { available: 0, total: 0, used: 0 },
    cpu: { usage: 0, count: 0 },
    model: {
      status: 'unknown',
      downloadProgress: 0,
      loadProgress: 0,
      error: null
    },
    warnings: [],
    errors: [],
    directories: {}
  });

  React.useEffect(() => {
    loadWorkflows();
    
    // Fetch system status periodically
    const fetchSystemStatus = async () => {
      try {
        const [systemRes, modelRes] = await Promise.all([
          axios.get('/system/status'),
          axios.get('/models/status')
        ]);
        
        // Garantir que temos dados válidos de sistema
        const systemData = systemRes.data || {};
        const diskSpace = systemData.disk_space || { available: 0, total: 0, used: 0 };
        const memory = systemData.memory || { available: 0, total: 0, used: 0 };
        
        setSystemStatus({
          disk_space: {
            available: diskSpace.available || 0,
            total: diskSpace.total || 0,
            used: diskSpace.used || 0,
            percent_used: diskSpace.percent_used || 0,
            warnings: diskSpace.warnings || []
          },
          memory: {
            available: memory.available || 0,
            total: memory.total || 0,
            used: memory.used || 0,
            percent_used: memory.percent_used || 0,
            warnings: memory.warnings || []
          },
          cpu: systemData.cpu || { usage: 0, count: 0 },
          model: modelRes.data || {
            status: 'unknown',
            downloadProgress: 0,
            loadProgress: 0,
            error: null
          },
          warnings: systemData.warnings || [],
          errors: systemData.errors || [],
          directories: systemData.directories || {}
        });
      } catch (error) {
        console.error('Error fetching system status:', error);
        setError('Error fetching system status. Please check the console for details.');
        
        // Manter estado anterior em caso de erro
        setSystemStatus(prev => ({
          ...prev,
          errors: [...(prev.errors || []), 'Failed to update system status']
        }));
      }
    };

    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/workflows');
      setWorkflows(response.data);
      setError('');
    } catch (error) {
      console.error('Error loading workflows:', error);
      setError('Error loading workflows. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const validateResources = () => {
    const errors = [];
    
    // Verificar se temos dados válidos de disco
    if (!systemStatus?.disk_space?.available) {
      errors.push('Unable to verify disk space. System status data not available.');
    } else if (systemStatus.disk_space.available < MIN_DISK_SPACE) {
      errors.push(`Insufficient disk space. At least ${MIN_DISK_SPACE / 1024 / 1024 / 1024}GB required. (Available: ${(systemStatus.disk_space.available / 1024 / 1024 / 1024).toFixed(2)}GB)`);
    }
    
    // Verificar se temos dados válidos de memória
    if (!systemStatus?.memory?.available) {
      errors.push('Unable to verify memory. System status data not available.');
    } else if (systemStatus.memory.available < MIN_MEMORY) {
      errors.push(`Insufficient memory. At least ${MIN_MEMORY / 1024 / 1024 / 1024}GB required. (Available: ${(systemStatus.memory.available / 1024 / 1024 / 1024).toFixed(2)}GB)`);
    }

    if (systemStatus.model.status !== 'ready') {
      errors.push('Model is not ready. Please wait for it to finish loading.');
    }

    return errors;
  };

  const handleCreateWorkflow = () => {
    setWorkflowName('');
    setWorkflowDescription('');
    setWorkflowSteps([]);
    setCreateDialogOpen(true);
  };

  const handleEditWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    setWorkflowName(workflow.name);
    setWorkflowDescription(workflow.description);
    setWorkflowSteps(workflow.steps);
    setEditDialogOpen(true);
  };

  const handleDeleteWorkflow = async (workflowId) => {
    try {
      await axios.delete(`/workflows/${workflowId}`);
      loadWorkflows();
    } catch (error) {
      setError(error.response?.data?.error || 'Error deleting workflow');
    }
  };

  const handleSaveWorkflow = async () => {
    try {
      if (selectedWorkflow) {
        await axios.put(`/workflows/${selectedWorkflow.id}`, {
          name: workflowName,
          description: workflowDescription,
          steps: workflowSteps
        });
      } else {
        await axios.post('/workflows', {
          name: workflowName,
          description: workflowDescription,
          steps: workflowSteps
        });
      }
      setCreateDialogOpen(false);
      setEditDialogOpen(false);
      loadWorkflows();
    } catch (error) {
      setError(error.response?.data?.error || 'Error saving workflow');
    }
  };

  const handleExecuteWorkflow = async (workflow) => {
    const resourceErrors = validateResources();
    if (resourceErrors.length > 0) {
      setError(resourceErrors.join('\n'));
      return;
    }

    setLoading(true);
    setError('');
    setActiveStep(0);
    setExecutionStatus({});
    setExecutionResults({});
    
    try {
      for (const [index, step] of workflow.steps.entries()) {
        setActiveStep(index);
        setExecutionStatus(prev => ({
          ...prev,
          [index]: 'running'
        }));
        
        const response = await axios.post(`/workflows/${workflow.id}/execute`, {
          step: index,
          config: {
            ...step.config,
            systemStatus: {
              memory: systemStatus.memory,
              model: systemStatus.model
            }
          }
        });
        
        setExecutionResults(prev => ({
          ...prev,
          [index]: response.data
        }));
        
        setExecutionStatus(prev => ({
          ...prev,
          [index]: 'completed'
        }));
      }
      
      setActiveStep(workflow.steps.length);
    } catch (error) {
      setError(error.response?.data?.error || 'Error executing workflow');
      setExecutionStatus(prev => ({
        ...prev,
        [activeStep]: 'error'
      }));
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(workflowSteps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setWorkflowSteps(items);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Workflows
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateWorkflow}
        >
          Create Workflow
        </Button>
      </Box>

      {/* System Status */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Directory Status */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FolderIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  System Directories
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {systemStatus.directories && Object.entries(systemStatus.directories).map(([name, info]) => (
                  <Grid item xs={12} sm={6} md={4} key={name}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">
                        {name}
                      </Typography>
                      <Typography variant="body2" color={info.exists ? 'textSecondary' : 'error'}>
                        Status: {info.exists ? (info.writable ? 'Ready' : 'Read-only') : 'Not Found'}
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                        {info.path}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StorageIcon 
                  sx={{ mr: 1 }} 
                  color={systemStatus?.disk_space?.available < MIN_DISK_SPACE ? 'error' : 'primary'} 
                />
                <Typography variant="h6">
                  DeepSeek LLM Storage
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Available Space:
                </Typography>
                <Typography 
                  variant="body2" 
                  color={systemStatus?.disk_space?.available < MIN_DISK_SPACE ? 'error' : 'success.main'}
                  sx={{ fontWeight: 'medium' }}
                >
                  {formatBytes(systemStatus?.disk_space?.available || 0)}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Required: 10 GB for model files, cache, and offload storage
              </Typography>
              <LinearProgress
                variant="determinate"
                value={systemStatus?.disk_space?.total ? 
                  ((systemStatus?.disk_space?.used || 0) / systemStatus.disk_space.total * 100) : 0}
                color={systemStatus?.disk_space?.available < MIN_DISK_SPACE ? 'error' : 'primary'}
                sx={{ height: 8, borderRadius: 4, mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {formatBytes(systemStatus?.disk_space?.used || 0)} used of {formatBytes(systemStatus?.disk_space?.total || 0)} total
              </Typography>
              {systemStatus?.disk_space?.available < MIN_DISK_SPACE && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Insufficient space for DeepSeek LLM:
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ pl: 2 }}>
                    • Model files and cache storage<br />
                    • Weight offloading during inference<br />
                    • Temporary files during download
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <MemoryIcon 
                  sx={{ mr: 1 }} 
                  color={systemStatus?.memory?.available < MIN_MEMORY ? 'error' : 'primary'} 
                />
                <Typography variant="h6">
                  DeepSeek LLM Memory
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Available Memory:
                </Typography>
                <Typography 
                  variant="body2" 
                  color={systemStatus?.memory?.available < MIN_MEMORY ? 'error' : 'success.main'}
                  sx={{ fontWeight: 'medium' }}
                >
                  {formatBytes(systemStatus?.memory?.available || 0)}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Required: 2 GB with disk offloading enabled
              </Typography>
              <LinearProgress
                variant="determinate"
                value={systemStatus?.memory?.total ? 
                  ((systemStatus?.memory?.used || 0) / systemStatus.memory.total * 100) : 0}
                color={systemStatus?.memory?.available < MIN_MEMORY ? 'error' : 'primary'}
                sx={{ height: 8, borderRadius: 4, mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {formatBytes(systemStatus?.memory?.used || 0)} used of {formatBytes(systemStatus?.memory?.total || 0)} total
              </Typography>
              {systemStatus?.memory?.available < MIN_MEMORY && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Memory optimization enabled:
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ pl: 2 }}>
                    • Model weights offloaded to disk<br />
                    • Only 2GB RAM required (vs 14GB)<br />
                    • Safe tensors for efficient loading
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SettingsIcon 
                  sx={{ mr: 1 }} 
                  color={systemStatus?.model?.status === 'ready' ? 'success' : 
                         systemStatus?.model?.status === 'error' ? 'error' : 'primary'} 
                />
                <Typography variant="h6">
                  DeepSeek LLM Status
                </Typography>
              </Box>
              
              {/* CPU Status */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  CPU Usage:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {(systemStatus?.cpu?.usage || 0).toFixed(1)}% ({systemStatus?.cpu?.count || 0} cores)
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={systemStatus?.cpu?.usage || 0}
                color={systemStatus?.cpu?.usage > 90 ? 'error' : 
                       systemStatus?.cpu?.usage > 70 ? 'warning' : 'primary'}
                sx={{ height: 4, borderRadius: 2, mb: 2 }}
              />
              
              {/* Model Status */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Model Status:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 'medium',
                      color: systemStatus?.model?.status === 'ready' ? 'success.main' : 
                              systemStatus?.model?.status === 'error' ? 'error.main' : 'text.primary'
                    }}
                  >
                    {systemStatus?.model?.status === 'downloading' ? 'Downloading...' :
                     systemStatus?.model?.status === 'loading' ? 'Loading...' :
                     systemStatus?.model?.status === 'ready' ? 'Ready' :
                     systemStatus?.model?.status === 'error' ? 'Error' : 'Not Initialized'}
                  </Typography>
                  {systemStatus?.model?.status === 'ready' && (
                    <CheckCircleIcon color="success" sx={{ ml: 1, fontSize: 20 }} />
                  )}
                  {systemStatus?.model?.status === 'error' && (
                    <ErrorIcon color="error" sx={{ ml: 1, fontSize: 20 }} />
                  )}
                </Box>
              </Box>
              
              {/* Download Progress */}
              {systemStatus?.model?.status === 'downloading' && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Downloading DeepSeek LLM 7B...
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemStatus?.model?.downloadProgress || 0}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {systemStatus?.model?.downloadProgress?.toFixed(1)}% Complete
                  </Typography>
                </Box>
              )}
              
              {/* Loading Progress */}
              {systemStatus?.model?.status === 'loading' && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Loading model with optimizations...
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemStatus?.model?.loadProgress || 0}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {systemStatus?.model?.loadProgress?.toFixed(1)}% Complete
                  </Typography>
                </Box>
              )}
              
              {/* Error Message */}
              {systemStatus?.model?.status === 'error' && systemStatus?.model?.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    {systemStatus.model.error}
                  </Typography>
                </Alert>
              )}
              
              {/* Model Info */}
              {systemStatus?.model?.status === 'ready' && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    DeepSeek LLM 7B loaded with optimizations:
                    <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2 }}>
                      <li>Low CPU memory usage</li>
                      <li>Disk offloading enabled</li>
                      <li>Safe tensors for efficiency</li>
                    </Box>
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {workflows.map((workflow) => (
            <Paper key={workflow.id} sx={{ p: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="h6">
                    {workflow.name}
                  </Typography>
                  <Typography color="textSecondary" sx={{ mb: 2 }}>
                    {workflow.description}
                  </Typography>
                </Box>
                <Box>
                  <IconButton
                    onClick={() => handleEditWorkflow(workflow)}
                    disabled={loading}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDeleteWorkflow(workflow.id)}
                    disabled={loading}
                  >
                    <DeleteIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleExecuteWorkflow(workflow)}
                    disabled={loading}
                    color="primary"
                  >
                    {loading ? <CircularProgress size={24} /> : <PlayIcon />}
                  </IconButton>
                </Box>
              </Box>

              <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
                {workflow.steps.map((step, index) => (
                  <Step key={index}>
                    <StepLabel
                      error={executionStatus[index] === 'error'}
                      icon={
                        executionStatus[index] === 'completed' ? (
                          <CheckCircleIcon color="success" />
                        ) : executionStatus[index] === 'error' ? (
                          <ErrorIcon color="error" />
                        ) : executionStatus[index] === 'running' ? (
                          <CircularProgress size={24} />
                        ) : null
                      }
                    >
                      {step.name}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>

              {Object.keys(executionResults).map((stepIndex) => (
                <Paper key={stepIndex} sx={{ p: 2, mb: 1, bgcolor: 'grey.100' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Step {parseInt(stepIndex) + 1}: {workflow.steps[stepIndex].name}
                  </Typography>
                  <Typography
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: 12
                    }}
                  >
                    {typeof executionResults[stepIndex] === 'object'
                      ? JSON.stringify(executionResults[stepIndex], null, 2)
                      : executionResults[stepIndex]}
                  </Typography>
                </Paper>
              ))}
            </Paper>
          ))}
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Templates
            </Typography>
            <Grid container spacing={2}>
              {workflowTemplates.map((template) => (
                <Grid item xs={12} key={template.name}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover'
                      }
                    }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <CardContent>
                      <Typography variant="subtitle1">
                        {template.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {template.description}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        {template.steps.map((step, index) => (
                          <Chip
                            key={index}
                            label={step.name}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={createDialogOpen || editDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedWorkflow ? 'Edit Workflow' : 'Create Workflow'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              multiline
              rows={2}
            />
          </Box>
          
          <Typography variant="h6" sx={{ mb: 2 }}>
            Steps
          </Typography>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="workflow-steps">
              {(provided) => (
                <List {...provided.droppableProps} ref={provided.innerRef}>
                  {workflowSteps.map((step, index) => (
                    <Draggable key={index} draggableId={`step-${index}`} index={index}>
                      {(provided) => (
                        <ListItem
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          secondaryAction={
                            <IconButton edge="end" onClick={() => {
                              const newSteps = [...workflowSteps];
                              newSteps.splice(index, 1);
                              setWorkflowSteps(newSteps);
                            }}>
                              <DeleteIcon />
                            </IconButton>
                          }
                        >
                          <ListItemIcon>
                            <DescriptionIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={step.name}
                            secondary={`Type: ${step.type}`}
                          />
                        </ListItem>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </List>
              )}
            </Droppable>
          </DragDropContext>

          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setWorkflowSteps([...workflowSteps, {
                name: 'New Step',
                type: 'process',
                config: {}
              }])}
            >
              Add Step
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setEditDialogOpen(false);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSaveWorkflow} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Workflows;
