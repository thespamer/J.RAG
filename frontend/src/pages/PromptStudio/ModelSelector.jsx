import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

function ModelSelector({ value, onChange }) {
  return (
    <FormControl fullWidth>
      <InputLabel>Model</InputLabel>
      <Select
        value={value}
        label="Model"
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="deepseek-7b">DeepSeek LLM 7B</MenuItem>
      </Select>
    </FormControl>
  );
}

export default ModelSelector;
