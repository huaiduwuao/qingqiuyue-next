import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppealDialog, ReviewHistoryDialog } from './HdPublishDialogs';

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
});
