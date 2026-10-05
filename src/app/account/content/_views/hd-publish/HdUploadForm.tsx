'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import HighQualityRoundedIcon from '@mui/icons-material/HighQualityRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import ClosedCaptionRoundedIcon from '@mui/icons-material/ClosedCaptionRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { QUALITY_PRESETS } from './hdPublishModel';
import type { HdUploadState } from './useHdPublishData';

/** VIDEO 上传元数据表单 — 内联(原 Dialog 内容):基础信息 → 质量/特性 → 音轨/字幕 → 提交栏。 */
export const HdUploadForm = React.memo(function HdUploadForm({ upload }: { upload: HdUploadState }) {
  const {
    uploadFileName,
    uploadFileSizeMB,
    uploadStatus,
    resetUpload,
    uploadTitle,
    setUploadTitle,
    uploadResolution,
    setUploadResolution,
    uploadHdr,
    setUploadHdr,
    uploadAutoCover,
    setUploadAutoCover,
    uploadSubtitles,
    setUploadSubtitles,
    uploadAudios,
    setUploadAudios,
    newSubLang,
    setNewSubLang,
    newSubLabel,
    setNewSubLabel,
    handleAddSubtitle,
    handleRemoveSubtitle,
    handleAddAudio,
    handleRemoveAudio,
    handleSetDefaultAudio,
    createPending,
    handleSubmitUpload,
  } = upload;
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
          上传参数
        </Typography>
        <Box sx={{ flex: 1 }} />
        {uploadFileName && (
          <Chip
            size="small"
            label={
              uploadStatus === 'uploading' ? '上传中…'
              : uploadStatus === 'uploaded' ? `已上传 · ${uploadFileSizeMB} MB`
              : uploadStatus === 'failed' ? '上传失败'
              : '已选择'
            }
            color={uploadStatus === 'uploaded' ? 'success' : uploadStatus === 'failed' ? 'error' : 'default'}
            sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
          />
        )}
      </Box>

      {/* 标题 + 质量(2 列) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <TextField
          label="视频标题"
          size="small"
          value={uploadTitle}
          onChange={(e) => setUploadTitle(e.target.value)}
          slotProps={{
            inputLabel: { sx: { fontSize: 12 } },
            input: { sx: { fontSize: 13 } },
            formHelperText: { sx: { fontSize: 10, mt: 0.5 } },
          }}
          helperText="提交后可在作品管理中修改"
        />
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1 }}>
            输出质量
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {QUALITY_PRESETS.map((q) => {
              const selected = uploadResolution === q.id;
              return (
                <Box
                  key={q.id}
                  onClick={() => setUploadResolution(q.id)}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    border: '1.5px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    bgcolor: selected ? 'rgba(254, 44, 85, 0.06)' : 'transparent',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s',
                  }}
                >
                  {q.popular && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: 8,
                        px: 0.5,
                        py: 0.1,
                        borderRadius: 0.5,
                        bgcolor: 'primary.main',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      推荐
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{q.label}</Typography>
                    {selected && <CheckRoundedIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
                  </Box>
                  <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                    {q.bitrate} · {q.size}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* 特性开关 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <FormControlLabel
          control={<Switch size="small" checked={uploadHdr} onChange={(e) => setUploadHdr(e.target.checked)} />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <HighQualityRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: 12, color: 'text.primary' }}>启用 HDR 增强</Typography>
            </Box>
          }
        />
        <FormControlLabel
          control={<Switch size="small" checked={uploadAutoCover} onChange={(e) => setUploadAutoCover(e.target.checked)} />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: 12, color: 'text.primary' }}>AI 智能抽取封面</Typography>
            </Box>
          }
        />
      </Box>

      {/* 音轨 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
          <RecordVoiceOverRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>音轨</Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={handleAddAudio}
            sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, px: 1 }}
          >
            添加
          </Button>
        </Box>
        <Stack spacing={0.75}>
          {uploadAudios.map((a) => (
            <Box
              key={a.id}
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: 12, color: 'text.primary', flex: 1 }}>
                {a.label} <Box component="span" sx={{ color: 'text.disabled', fontSize: 10 }}>· {a.codec}</Box>
              </Typography>
              {!a.isDefault && (
                <Button
                  size="small"
                  onClick={() => handleSetDefaultAudio(a.id)}
                  sx={{ textTransform: 'none', fontSize: 10, minWidth: 0, px: 0.75, color: 'text.secondary' }}
                >
                  设为默认
                </Button>
              )}
              {a.isDefault && (
                <Chip
                  size="small"
                  label="默认"
                  sx={{
                    height: 16,
                    fontSize: 9,
                    bgcolor: 'rgba(93, 219, 150, 0.12)',
                    color: 'var(--fg-green)',
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              )}
              {uploadAudios.length > 1 && (
                <IconButton size="small" onClick={() => handleRemoveAudio(a.id)} sx={{ p: 0.25 }}>
                  <CloseRoundedIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
            </Box>
          ))}
        </Stack>
      </Box>

      {/* 字幕 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
          <ClosedCaptionRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>字幕轨</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            size="small"
            placeholder="语言 (zh-CN)"
            value={newSubLang}
            onChange={(e) => setNewSubLang(e.target.value)}
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: 11 } }}
          />
          <TextField
            size="small"
            placeholder="标签 (简体中文)"
            value={newSubLabel}
            onChange={(e) => setNewSubLabel(e.target.value)}
            sx={{ flex: 1.5, '& .MuiOutlinedInput-root': { fontSize: 11 } }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={handleAddSubtitle}
            disabled={!newSubLang || !newSubLabel}
            sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, px: 1.5, borderColor: 'divider' }}
          >
            添加
          </Button>
        </Box>
        {uploadSubtitles.length === 0 ? (
          <Typography sx={{ fontSize: 10, color: 'text.disabled', py: 0.5 }}>
            暂未添加字幕
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {uploadSubtitles.map((s) => (
              <Box
                key={s.id}
                sx={{
                  p: 0.75,
                  borderRadius: 0.75,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: 11, color: 'text.primary', flex: 1 }}>
                  {s.label} <Box component="span" sx={{ color: 'text.disabled', fontSize: 10 }}>· {s.lang}</Box>
                </Typography>
                <IconButton size="small" onClick={() => handleRemoveSubtitle(s.id)} sx={{ p: 0.25 }}>
                  <CloseRoundedIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Sticky-ish 提交栏 */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={() => {
            resetUpload();
            setUploadTitle('');
            setUploadHdr(true);
            setUploadAutoCover(true);
            setUploadSubtitles([]);
            setUploadAudios([{ id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true }]);
          }}
          sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}
        >
          清空
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmitUpload}
          disabled={
            !uploadTitle.trim() ||
            uploadStatus !== 'uploaded' ||
            createPending
          }
          sx={{
            textTransform: 'none',
            fontSize: 13,
            fontWeight: 600,
            px: 3,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': {
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              filter: 'brightness(1.1)',
            },
          }}
        >
          {createPending
            ? '提交中...'
            : uploadStatus !== 'uploaded'
              ? '请先上传文件'
              : '提交上传'}
        </Button>
      </Box>
    </Box>
  );
});
