import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

function ResponseViewer({ response }) {
  if (!response) {
    return (
      <Typography color="textSecondary">
        No response yet. Run a prompt to see results.
      </Typography>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography>{response.text}</Typography>
    </Paper>
  );
}

export default ResponseViewer;
