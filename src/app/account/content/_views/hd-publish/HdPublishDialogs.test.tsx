import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppealDialog, CoverPickerDialog, ReviewHistoryDialog } from './HdPublishDialogs';

const target = { id: '42', title: '我的视频', cover: 'https://cdn.example.com/old.jpg' };
const pngFile = (name = 'c.png', size = 10) => new File([new Uint8Array(size)], name, { type: 'image/png' });

describe('HdPublishDialogs', () => {
  it('申诉理由为空时不能提交,填写后回调', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <AppealDialog open onClose={() => {}} reason="" onReasonChange={() => {}} submitting={false} onSubmit={onSubmit} />,
    );
    expect(screen.getByRole('button', { name: '提交申诉' })).toBeDisabled();
    rerender(<AppealDialog open onClose={() => {}} reason="授权过" onReasonChange={() => {}} submitting={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '提交申诉' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('审核历史为空时显示占位和极速通道用量', () => {
    render(<ReviewHistoryDialog open onClose={() => {}} reviewHistory={[]} reviewers={[]} fastChannelQuota={3} />);
    expect(screen.getByText('暂无审核记录')).toBeInTheDocument();
    expect(screen.getByText(/共 0 条记录 · 极速通道已用 7\/10 次/)).toBeInTheDocument();
  });

  describe('CoverPickerDialog', () => {
    it('没选封面时不能保存;上传图片后选中并把文件交给 onSave', () => {
      const onSave = vi.fn();
      render(<CoverPickerDialog open video={target} saving={false} onClose={() => {}} onSave={onSave} />);
      expect(screen.getByText('这条视频没有可截取的文件地址,请上传图片。')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '保存封面' })).toBeDisabled();
      const file = pngFile();
      fireEvent.change(screen.getByTestId('cover-file-input'), { target: { files: [file] } });
      expect(screen.getByRole('button', { name: '上传的图片' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: '保存封面' }));
      expect(onSave).toHaveBeenCalledWith(file, 'c.png');
    });

    it('拒绝非图片和超过 10 MB 的文件', () => {
      render(<CoverPickerDialog open video={target} saving={false} onClose={() => {}} onSave={() => {}} />);
      const input = screen.getByTestId('cover-file-input');
      fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })] } });
      expect(screen.getByText('只支持 JPG / PNG / WebP / GIF 图片')).toBeInTheDocument();
      fireEvent.change(input, { target: { files: [pngFile('big.png', 10 * 1024 * 1024 + 1)] } });
      expect(screen.getByText('图片不能超过 10 MB')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '保存封面' })).toBeDisabled();
    });

    it('有视频地址时截帧作候选,选一帧保存', async () => {
      const frame = new Blob(['f'], { type: 'image/jpeg' });
      const capture = vi.fn(async () => [frame, frame]);
      const onSave = vi.fn();
      render(
        <CoverPickerDialog
          open
          video={{ ...target, videoUrl: '/qq-media/v.mp4' }}
          saving={false}
          onClose={() => {}}
          onSave={onSave}
          captureFrames={capture}
        />,
      );
      expect(screen.getByText('正在截取画面…')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: '视频画面 2' })).toBeInTheDocument());
      expect(capture).toHaveBeenCalledWith('/qq-media/v.mp4', expect.anything());
      fireEvent.click(screen.getByRole('button', { name: '视频画面 2' }));
      fireEvent.click(screen.getByRole('button', { name: '保存封面' }));
      expect(onSave).toHaveBeenCalledWith(frame, 'cover-frame-2.jpg');
    });

    it('截帧失败时提示改为上传图片;保存中按钮禁用', async () => {
      const { rerender } = render(
        <CoverPickerDialog
          open
          video={{ ...target, videoUrl: 'https://other.example.com/v.mp4' }}
          saving={false}
          onClose={() => {}}
          onSave={() => {}}
          captureFrames={() => Promise.reject(new DOMException('tainted', 'SecurityError'))}
        />,
      );
      await waitFor(() => expect(screen.getByText('这个视频不能在浏览器里截取画面,请上传图片。')).toBeInTheDocument());
      rerender(
        <CoverPickerDialog open video={target} saving onClose={() => {}} onSave={() => {}} captureFrames={() => Promise.resolve([])} />,
      );
      expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '上传图片' })).toBeDisabled();
    });
  });
});
