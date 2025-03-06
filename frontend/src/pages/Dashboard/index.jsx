import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Storage as StorageIcon,
  Code as CodeIcon,
  AccountTree as WorkflowIcon,
  SmartToy as AgentIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const features = [
  {
    title: 'RAG Pipeline',
    description: 'Build and manage your document processing pipeline',
    icon: <StorageIcon />,
    path: '/rag-pipeline'
  },
  {
    title: 'Prompt Studio',
    description: 'Design and test prompts for your LLM applications',
    icon: <CodeIcon />,
    path: '/prompt-studio'
  },
  {
    title: 'Workflows',
    description: 'Create automated workflows for document processing',
    icon: <WorkflowIcon />,
    path: '/workflows'
  },
  {
    title: 'Agents',
    description: 'Configure and deploy AI agents',
    icon: <AgentIcon />,
    path: '/agents'
  }
];

function Dashboard() {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome to Q-RAG3
      </Typography>
      
      <Typography variant="body1" color="textSecondary" paragraph>
        Your advanced platform for building LLM-powered applications with RAG capabilities
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {features.map((feature) => (
          <Grid item xs={12} sm={6} md={3} key={feature.title}>
            <Card>
              <CardContent>
                {React.cloneElement(feature.icon, { 
                  sx: { fontSize: 40, mb: 2, color: 'primary.main' }
                })}
                <Typography variant="h6" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {feature.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button 
                  size="small" 
                  onClick={() => navigate(feature.path)}
                >
                  Open
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mt: 4, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Start Guide
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <StorageIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Upload Documents" 
              secondary="Start by uploading your documents in the RAG Pipeline"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CodeIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Configure Prompts" 
              secondary="Design your prompts in the Prompt Studio"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <WorkflowIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Create Workflow" 
              secondary="Set up your document processing workflow"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <AgentIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Deploy Agents" 
              secondary="Configure and deploy your AI agents"
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
}

export default Dashboard;
