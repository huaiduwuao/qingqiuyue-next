import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HdUploadForm } from './HdUploadForm';
import type { HdUploadState } from './useHdPublishData';

function makeUpload(over: Partial<HdUploadState> = {}): HdUploadState {
  return {
    uploadFileName: null,
    uploadFileSizeMB: 0,
    uploadStatus: 'idle',
    resetUpload: vi.fn(),
    uploadTitle: '',
    setUploadTitle: vi.fn(),
    uploadResolution: '4K',
    setUploadResolution: vi.fn(),
    uploadHdr: true,
    setUploadHdr: vi.fn(),
    uploadAutoCover: true,
    setUploadAutoCover: vi.fn(),
    uploadSubtitles: [],
    setUploadSubtitles: vi.fn(),
    uploadAudios: [{ id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true }],
    setUploadAudios: vi.fn(),
    newSubLang: '',
    setNewSubLang: vi.fn(),
    newSubLabel: '',
    setNewSubLabel: vi.fn(),
    handleFileChange: vi.fn(),
    handleAddSubtitle: vi.fn(),
    handleRemoveSubtitle: vi.fn(),
    handleAddAudio: vi.fn(),
    handleRemoveAudio: vi.fn(),
    handleSetDefaultAudio: vi.fn(),
    createPending: false,
    handleSubmitUpload: vi.fn(),
    ...over,
  } as HdUploadState;
}

describe('HdUploadForm', () => {
  it('没上传完文件时提交按钮不可点,提示先上传', () => {
    render(<HdUploadForm upload={makeUpload({ uploadTitle: '标题' })} />);
    expect(screen.getByRole('button', { name: '请先上传文件' })).toBeDisabled();
    expect(screen.getByText('暂未添加字幕')).toBeInTheDocument();
  });

  it('文件已上传且有标题时可以提交,清空会重置上传状态', () => {
    const upload = makeUpload({ uploadTitle: '标题', uploadStatus: 'uploaded', uploadFileName: 'a.mp4', uploadFileSizeMB: 12 });
    render(<HdUploadForm upload={upload} />);
    expect(screen.getByText('已上传 · 12 MB')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '提交上传' }));
    expect(upload.handleSubmitUpload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '清空' }));
    expect(upload.resetUpload).toHaveBeenCalledTimes(1);
    expect(upload.setUploadTitle).toHaveBeenCalledWith('');
  });
});
