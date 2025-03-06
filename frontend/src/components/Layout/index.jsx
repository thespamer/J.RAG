import React from 'react';
import { Box, Drawer, AppBar, Toolbar, Typography, List, IconButton } from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  AccountTree,
  Code,
  Storage,
  SmartToy,
  Analytics,
  Settings,
  Memory as MemoryIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavItem from './NavItem';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/' },
  { text: 'Workflows', icon: <AccountTree />, path: '/workflows' },
  { text: 'Prompt Studio', icon: <Code />, path: '/prompt-studio' },
  { text: 'RAG Pipeline', icon: <Storage />, path: '/rag-pipeline' },
  { text: 'Agents', icon: <SmartToy />, path: '/agents' },
  { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
  { text: 'System Status', icon: <MemoryIcon />, path: '/system' },
  { text: 'Settings', icon: <Settings />, path: '/settings' }
];

function Layout({ children }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Q-RAG3
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <NavItem
            key={item.text}
            text={item.text}
            icon={item.icon}
            onClick={() => navigate(item.path)}
          />
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Q-RAG3 Platform
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          ['& .MuiDrawer-paper']: {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawer}
      </Drawer>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` }
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

export default Layout;
