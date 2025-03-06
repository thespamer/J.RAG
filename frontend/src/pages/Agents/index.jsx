import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';

const sampleAgents = [
  {
    id: 1,
    name: 'Document Processor',
    description: 'Processes and analyzes documents using DeepSeek LLM',
    status: 'running',
    type: 'RAG',
    model: 'deepseek-7b'
  },
  {
    id: 2,
    name: 'Query Assistant',
    description: 'Handles user queries and retrieves relevant information',
    status: 'stopped',
    type: 'Assistant',
    model: 'deepseek-7b'
  }
];

function Agents() {
  const [agents, setAgents] = React.useState(sampleAgents);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [newAgent, setNewAgent] = React.useState({
    name: '',
    description: '',
    type: 'RAG',
    model: 'deepseek-7b'
  });

  const handleAgentAction = (id, action) => {
    setAgents(prevAgents =>
      prevAgents.map(agent =>
        agent.id === id
          ? {
              ...agent,
              status: action === 'start' ? 'running' : 'stopped'
            }
          : agent
      )
    );
  };

  const handleDeleteAgent = (id) => {
    setAgents(prevAgents =>
      prevAgents.filter(agent => agent.id !== id)
    );
  };

  const handleCreateAgent = () => {
    const id = Math.max(...agents.map(a => a.id)) + 1;
    setAgents(prevAgents => [
      ...prevAgents,
      {
        ...newAgent,
        id,
        status: 'stopped'
      }
    ]);
    setOpenDialog(false);
    setNewAgent({
      name: '',
      description: '',
      type: 'RAG',
      model: 'deepseek-7b'
    });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">
          Agents
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          New Agent
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Active Agents
            </Typography>
            <List>
              {agents.map((agent) => (
                <ListItem
                  key={agent.id}
                  sx={{
                    mb: 2,
                    border: 1,
                    borderColor: 'grey.200',
                    borderRadius: 1
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {agent.name}
                        <Chip
                          label={agent.type}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        {agent.description}
                        <br />
                        <Typography
                          component="span"
                          variant="body2"
                          color={agent.status === 'running' ? 'success.main' : 'error.main'}
                        >
                          {agent.status.toUpperCase()}
                        </Typography>
                        {' • '}
                        <Typography component="span" variant="body2" color="textSecondary">
                          Model: {agent.model}
                        </Typography>
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleAgentAction(
                        agent.id,
                        agent.status === 'running' ? 'stop' : 'start'
                      )}
                      color={agent.status === 'running' ? 'error' : 'success'}
                    >
                      {agent.status === 'running' ? <StopIcon /> : <PlayIcon />}
                    </IconButton>
                    <IconButton edge="end" color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={() => handleDeleteAgent(agent.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Agent Templates
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      RAG Agent
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Retrieval-Augmented Generation agent for document processing
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button size="small">Use Template</Button>
                  </CardActions>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Assistant Agent
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Interactive assistant for handling user queries
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button size="small">Use Template</Button>
                  </CardActions>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Create New Agent</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={newAgent.name}
            onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newAgent.description}
            onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateAgent} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Agents;
