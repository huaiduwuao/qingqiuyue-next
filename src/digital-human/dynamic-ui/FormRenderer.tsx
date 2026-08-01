'use client'

/**
 * FormRenderer - 表单渲染器
 */

import React, { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Button from '@mui/material/Button'
import type { FormField, SelectOption } from './types'

interface FormRendererProps {
  fields: FormField[]
  values?: Record<string, unknown>
  onChange?: (values: Record<string, unknown>) => void
  onSubmit?: (values: Record<string, unknown>) => void
}

export function FormRenderer({ fields, values = {}, onChange, onSubmit }: FormRendererProps) {
  const [localValues, setLocalValues] = useState<Record<string, unknown>>(values)

  const handleChange = (name: string, value: unknown) => {
    const newValues = { ...localValues, [name]: value }
    setLocalValues(newValues)
    onChange?.(newValues)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(localValues)
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {fields.map((field) => (
        <Box key={field.name}>
          {field.type === 'text' && (
            <TextField
              fullWidth
              label={field.label}
              placeholder={field.placeholder}
              value={localValues[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              required={field.required}
              size="small"
            />
          )}

          {field.type === 'password' && (
            <TextField
              fullWidth
              type="password"
              label={field.label}
              placeholder={field.placeholder}
              value={localValues[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              required={field.required}
              size="small"
            />
          )}

          {field.type === 'select' && (
            <FormControl fullWidth size="small">
              <FormLabel sx={{ fontSize: 12, mb: 0.5 }}>{field.label}</FormLabel>
              <Select
                value={localValues[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                displayEmpty
              >
                {field.options?.map((opt: SelectOption) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {field.type === 'checkbox' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!localValues[field.name]}
                  onChange={(e) => handleChange(field.name, e.target.checked)}
                />
              }
              label={field.label}
            />
          )}

          {field.type === 'radio' && (
            <FormControl fullWidth>
              <FormLabel sx={{ fontSize: 12, mb: 1 }}>{field.label}</FormLabel>
              <RadioGroup
                value={localValues[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
              >
                {field.options?.map((opt: SelectOption) => (
                  <FormControlLabel
                    key={opt.value}
                    value={opt.value}
                    control={<Radio size="small" />}
                    label={opt.label}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          )}

          {field.type === 'date' && (
            <TextField
              fullWidth
              type="date"
              label={field.label}
              value={localValues[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              required={field.required}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}
        </Box>
      ))}

      <Button type="submit" variant="contained" fullWidth>
        提交
      </Button>
    </Box>
  )
}
