import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  AccessTime as AccessTimeIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon
} from '@mui/icons-material';

const sampleMetrics = {
  totalQueries: 1250,
  avgResponseTime: '1.2s',
  memoryUsage: '3.5GB',
  diskUsage: '8.2GB'
};

const sampleHistory = [
  {
    timestamp: '2025-03-05T22:50:00Z',
    event: 'Query processed',
    details: 'Response generated in 1.1s'
  },
  {
    timestamp: '2025-03-05T22:45:00Z',
    event: 'Document indexed',
    details: 'Added 3 new documents to vector store'
  }
];

function Analytics() {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Analytics
      </Typography>

      <Grid container spacing={3}>
        {/* System Metrics */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Total Queries</Typography>
                  </Box>
                  <Typography variant="h4">{sampleMetrics.totalQueries}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AccessTimeIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Avg Response Time</Typography>
                  </Box>
                  <Typography variant="h4">{sampleMetrics.avgResponseTime}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <MemoryIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Memory Usage</Typography>
                  </Box>
                  <Typography variant="h4">{sampleMetrics.memoryUsage}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <StorageIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Disk Usage</Typography>
                  </Box>
                  <Typography variant="h4">{sampleMetrics.diskUsage}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* System History */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System History
            </Typography>
            <List>
              {sampleHistory.map((item, index) => (
                <ListItem key={index} divider={index !== sampleHistory.length - 1}>
                  <ListItemIcon>
                    <AccessTimeIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.event}
                    secondary={
                      <>
                        {item.details}
                        <br />
                        <Typography variant="caption" color="textSecondary">
                          {new Date(item.timestamp).toLocaleString()}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Model Performance */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Model Performance
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <MemoryIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="DeepSeek LLM 7B"
                  secondary="Average response time: 1.2s • Memory usage: 3.5GB"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Storage Usage */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Storage Usage
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <StorageIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Vector Store"
                  secondary="Documents: 150 • Size: 2.3GB"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <StorageIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Model Cache"
                  secondary="Size: 5.9GB • Offload enabled"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Analytics;
