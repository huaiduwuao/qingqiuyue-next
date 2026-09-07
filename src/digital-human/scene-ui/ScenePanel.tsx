'use client';

/**
 * ScenePanel — 渲染进 3D 场景里那块板子的内容
 *
 * 由 ImmersiveDigitalHuman 用 createPortal 挂到 useVrmScenePanel 提供的 host 上。
 * 内容是真 DOM,所以列表能点、表单能打字 —— 不是贴在平面上的一张图。
 *
 * 数据来自数字人的 ui_show_list / ui_show_grid / ui_show_form 工具调用。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Chip from '@mui/material/Chip';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type {
  ScenePanel as ScenePanelModel,
  ScenePanelField,
  ScenePanelGridItem,
  ScenePanelListItem,
} from './types';

export interface ScenePanelProps {
  panel: ScenePanelModel;
  /** 点列表项 / 提交表单 → 把这段话作为新一轮用户输入回灌给数字人 */
  onSend: (text: string) => void;
  onClose: () => void;
}

// 面板配色跟舞台走(深色玻璃 + 青色高光),避免 MUI 亮色主题在暗场景里刺眼
const ACCENT = '#25F4EE';
const surface = {
  bg: 'rgba(10, 12, 22, 0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  text: 'rgba(255,255,255,0.92)',
  subtext: 'rgba(255,255,255,0.55)',
};

export function ScenePanel({ panel, onSend, onClose }: ScenePanelProps) {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: surface.bg,
        border: surface.border,
        borderRadius: '18px',
        backdropFilter: 'blur(14px)',
        boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
        overflow: 'hidden',
        // CSS3D 会把整块 DOM 做透视变换,字体渲染交给 GPU 更清楚
        transformStyle: 'preserve-3d',
      }}
    >
      <Box
        sx={{
          px: 2.5, py: 2,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'flex-start', gap: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 600, color: surface.text, lineHeight: 1.3 }}>
            {panel.title}
          </Typography>
          {panel.subtitle && (
            <Typography sx={{ fontSize: 13, color: surface.subtext, mt: 0.5 }}>
              {panel.subtitle}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="关闭面板" sx={{ color: surface.subtext }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        {panel.kind === 'list' && <PanelList items={panel.items} onSend={onSend} />}
        {panel.kind === 'grid' && (
          <PanelGrid items={panel.items} columns={panel.columns} onSend={onSend} />
        )}
        {panel.kind === 'form' && (
          <PanelForm
            fields={panel.fields}
            submitText={panel.submitText}
            submitHint={panel.submitHint}
            title={panel.title}
            onSend={onSend}
          />
        )}
      </Box>
    </Box>
  );
}

/** 点击项时回灌给数字人的话:优先用 LLM 给的 action,否则用标题兜底 */
function itemPrompt(item: ScenePanelListItem): string {
  return item.action?.trim() || `我选「${item.title}」`;
}

function PanelList({ items, onSend }: { items: ScenePanelListItem[]; onSend: (t: string) => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {items.map((item) => (
        <Box
          key={item.id}
          role="button"
          tabIndex={0}
          onClick={() => onSend(itemPrompt(item))}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSend(itemPrompt(item)); } }}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.75,
            p: 1.5, borderRadius: 2, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            transition: 'border-color .15s, background .15s',
            '&:hover': { borderColor: ACCENT, background: 'rgba(37,244,238,0.10)' },
            '&:focus-visible': { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
          }}
        >
          {item.image ? (
            <Box
              component="img" src={item.image} alt=""
              sx={{ width: 52, height: 52, borderRadius: 1.5, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : item.icon ? (
            <Box sx={{ width: 52, height: 52, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, background: 'rgba(37,244,238,0.12)', flexShrink: 0 }}>
              {item.icon}
            </Box>
          ) : null}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 15, color: surface.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.title}
            </Typography>
            {item.subtitle && (
              <Typography sx={{ fontSize: 12.5, color: surface.subtext, mt: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function PanelGrid({ items, columns, onSend }: { items: ScenePanelGridItem[]; columns: number; onSend: (t: string) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1.5 }}>
      {items.map((item) => (
        <Box
          key={item.id}
          role="button"
          tabIndex={0}
          onClick={() => onSend(itemPrompt(item))}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSend(itemPrompt(item)); } }}
          sx={{
            borderRadius: 2, overflow: 'hidden', cursor: 'pointer', position: 'relative',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            transition: 'border-color .15s, transform .15s',
            '&:hover': { borderColor: ACCENT, transform: 'translateY(-2px)' },
            '&:focus-visible': { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
          }}
        >
          <Box
            sx={{
              width: '100%', aspectRatio: '3 / 4',
              background: item.image ? `center/cover no-repeat url(${JSON.stringify(item.image)})` : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30,
            }}
          >
            {!item.image && (item.icon || '🎬')}
          </Box>
          {item.badge && (
            <Chip
              label={item.badge}
              size="small"
              sx={{ position: 'absolute', top: 6, right: 6, height: 20, fontSize: 11, bgcolor: 'rgba(0,0,0,0.65)', color: ACCENT }}
            />
          )}
          <Box sx={{ p: 1 }}>
            <Typography sx={{ fontSize: 13, color: surface.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.title}
            </Typography>
            {item.subtitle && (
              <Typography sx={{ fontSize: 11, color: surface.subtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function initialValues(fields: ScenePanelField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.default !== undefined) out[f.name] = f.default;
    else if (f.type === 'checkbox') out[f.name] = false;
    else out[f.name] = '';
  }
  return out;
}

function PanelForm({
  fields, submitText, submitHint, title, onSend,
}: {
  fields: ScenePanelField[];
  submitText?: string;
  submitHint?: string;
  title: string;
  onSend: (t: string) => void;
}) {
  const [values, setValues] = React.useState<Record<string, unknown>>(() => initialValues(fields));
  const [touched, setTouched] = React.useState(false);

  const set = (name: string, v: unknown) => setValues((p) => ({ ...p, [name]: v }));

  const missing = fields.filter(
    (f) => f.required && (values[f.name] === '' || values[f.name] == null || values[f.name] === false),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (missing.length > 0) return;
    // 表单结果回灌成一轮自然语言输入 —— 数字人拿到的是「用户说了什么」,
    // 而不是一个它看不懂的事件对象,后续该调哪个业务工具由它自己决定。
    const lines = fields
      .map((f) => {
        const v = values[f.name];
        if (v === '' || v == null || v === false) return null;
        return `${f.label}: ${v === true ? '是' : v}`;
      })
      .filter(Boolean);
    const hint = submitHint?.trim();
    onSend(`我在「${title}」里填好了:\n${lines.join('\n')}${hint ? `\n(${hint})` : ''}`);
  };

  return (
    // noValidate:关掉浏览器原生校验气泡。它是英文的(跟界面语言不一致)、样式不受控,
    // 而且会抢在下面的「必填」提示之前弹出来。校验以本组件的 missing 为准。
    <Box component="form" noValidate onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {fields.map((f) => {
        const showError = touched && f.required && (values[f.name] === '' || values[f.name] == null);
        const common = {
          fullWidth: true,
          size: 'small' as const,
          label: f.label,
          placeholder: f.placeholder,
          required: f.required,
          error: showError,
          helperText: showError ? '必填' : undefined,
          value: (values[f.name] ?? '') as string,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(f.name, e.target.value),
          sx: fieldSx,
        };

        switch (f.type) {
          case 'textarea':
            return <TextField key={f.name} {...common} multiline minRows={3} />;
          case 'number':
            return <TextField key={f.name} {...common} type="number" />;
          case 'password':
            return <TextField key={f.name} {...common} type="password" />;
          case 'date':
            return <TextField key={f.name} {...common} type="date" slotProps={{ inputLabel: { shrink: true } }} />;
          case 'select':
            return (
              <FormControl key={f.name} fullWidth size="small" error={showError} sx={fieldSx}>
                <FormLabel sx={{ fontSize: 12, mb: 0.5, color: surface.subtext }}>{f.label}</FormLabel>
                <Select
                  value={(values[f.name] ?? '') as string}
                  onChange={(e) => set(f.name, e.target.value)}
                  displayEmpty
                >
                  {(f.options ?? []).map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            );
          case 'checkbox':
            return (
              <FormControlLabel
                key={f.name}
                control={
                  <Checkbox
                    checked={!!values[f.name]}
                    onChange={(e) => set(f.name, e.target.checked)}
                    sx={{ color: surface.subtext, '&.Mui-checked': { color: ACCENT } }}
                  />
                }
                label={f.label}
                sx={{ color: surface.text, '& .MuiFormControlLabel-label': { fontSize: 14 } }}
              />
            );
          case 'radio':
            return (
              <FormControl key={f.name} error={showError}>
                <FormLabel sx={{ fontSize: 12, mb: 0.5, color: surface.subtext }}>{f.label}</FormLabel>
                <RadioGroup value={(values[f.name] ?? '') as string} onChange={(e) => set(f.name, e.target.value)}>
                  {(f.options ?? []).map((o) => (
                    <FormControlLabel
                      key={o.value}
                      value={o.value}
                      control={<Radio size="small" sx={{ color: surface.subtext, '&.Mui-checked': { color: ACCENT } }} />}
                      label={o.label}
                      sx={{ color: surface.text, '& .MuiFormControlLabel-label': { fontSize: 14 } }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            );
          default:
            return <TextField key={f.name} {...common} />;
        }
      })}

      <Button
        type="submit"
        variant="contained"
        fullWidth
        sx={{
          mt: 0.5, bgcolor: ACCENT, color: '#04121a', fontWeight: 600,
          '&:hover': { bgcolor: '#5ff8f3' },
        }}
      >
        {submitText?.trim() || '提交'}
      </Button>
    </Box>
  );
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: surface.text,
    bgcolor: 'rgba(255,255,255,0.06)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiInputLabel-root': { color: surface.subtext },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
} as const;

export default ScenePanel;
