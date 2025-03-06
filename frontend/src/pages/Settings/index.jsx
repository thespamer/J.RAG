import React from 'react';
import {
  Box,
  Paper,
  Grid,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

function Settings() {
  const [settings, setSettings] = React.useState({
    model: {
      offloadEnabled: true,
      offloadFolder: '/app/models_cache/offload',
      cacheDir: '/app/models_cache',
      maxRamUsage: '4G'
    },
    system: {
      cleanupOnStart: true,
      enableAuditLog: true,
      apiKeyHeader: 'X-API-KEY'
    }
  });

  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleModelChange = (field) => (event) => {
    setSettings(prev => ({
      ...prev,
      model: {
        ...prev.model,
        [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value
      }
    }));
  };

  const handleSystemChange = (field) => (event) => {
    setSettings(prev => ({
      ...prev,
      system: {
        ...prev.system,
        [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value
      }
    }));
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          Settings
        </Typography>
        <Typography color="textSecondary">
          Configure system and model settings
        </Typography>
      </Paper>

      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Settings saved successfully!
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Model Settings
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.model.offloadEnabled}
                  onChange={handleModelChange('offloadEnabled')}
                />
              }
              label="Enable Weight Offloading"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Offload Folder"
              value={settings.model.offloadFolder}
              onChange={handleModelChange('offloadFolder')}
              margin="normal"
            />

            <TextField
              fullWidth
              label="Cache Directory"
              value={settings.model.cacheDir}
              onChange={handleModelChange('cacheDir')}
              margin="normal"
            />

            <TextField
              fullWidth
              label="Maximum RAM Usage"
              value={settings.model.maxRamUsage}
              onChange={handleModelChange('maxRamUsage')}
              margin="normal"
              helperText="Format: 4G, 8G, etc."
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Settings
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.system.cleanupOnStart}
                  onChange={handleSystemChange('cleanupOnStart')}
                />
              }
              label="Clean Cache on Startup"
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.system.enableAuditLog}
                  onChange={handleSystemChange('enableAuditLog')}
                />
              }
              label="Enable Audit Logging"
              sx={{ mb: 2 }}
            />

            <Divider sx={{ my: 2 }} />

            <TextField
              fullWidth
              label="API Key Header"
              value={settings.system.apiKeyHeader}
              onChange={handleSystemChange('apiKeyHeader')}
              margin="normal"
            />
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
        >
          Save Settings
        </Button>
      </Box>
    </Box>
  );
}

export default Settings;
