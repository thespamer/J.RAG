import React from 'react';
import { List, ListItem, ListItemButton, ListItemText } from '@mui/material';

const templates = [
  {
    name: 'Basic Question',
    prompt: 'Please explain the following concept: '
  },
  {
    name: 'Code Review',
    prompt: 'Review this code and suggest improvements: '
  }
];

function PromptTemplates({ onSelect }) {
  return (
    <List>
      {templates.map((template, index) => (
        <ListItem key={index} disablePadding>
          <ListItemButton onClick={() => onSelect(template.prompt)}>
            <ListItemText primary={template.name} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}

export default PromptTemplates;
