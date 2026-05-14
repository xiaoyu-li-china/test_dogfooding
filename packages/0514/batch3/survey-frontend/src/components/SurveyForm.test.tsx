import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SurveyForm } from './SurveyForm';
import { Survey } from '../types';
import * as api from '../services/api';

vi.mock('../services/api');

const mockSurvey: Survey = {
  id: 1,
  title: '健康调查',
  description: '测试问卷',
  created_at: '2024-01-01',
  questions: [
    {
      id: 1,
      text: '您是否吸烟？',
      question_type: 'single',
      options: ['是', '否'],
      order: 1,
      skip_logic: {
        conditions: [
          { answer: '是', action: 'next' },
          { answer: '否', action: 'jump', target_question_order: 3 },
        ],
      },
    },
    {
      id: 2,
      text: '您吸烟频率？',
      question_type: 'single',
      options: ['每天', '偶尔'],
      order: 2,
    },
    {
      id: 3,
      text: '您每周运动次数？',
      question_type: 'single',
      options: ['0次', '1-3次'],
      order: 3,
    },
  ],
};

describe('SurveyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.surveyAPI.checkToken as vi.Mock).mockResolvedValue({ exists: false });
    (api.surveyAPI.submitResponse as vi.Mock).mockResolvedValue({});
    Storage.prototype.getItem = vi.fn(() => null);
    Storage.prototype.setItem = vi.fn();
  });

  it('应该渲染问卷标题和描述', () => {
    render(<SurveyForm survey={mockSurvey} />);
    expect(screen.getByText('健康调查')).toBeInTheDocument();
    expect(screen.getByText('测试问卷')).toBeInTheDocument();
  });

  it('初始应该显示所有问题', () => {
    render(<SurveyForm survey={mockSurvey} />);
    expect(screen.getByText('您是否吸烟？')).toBeInTheDocument();
    expect(screen.getByText('您吸烟频率？')).toBeInTheDocument();
    expect(screen.getByText('您每周运动次数？')).toBeInTheDocument();
  });

  it('当选择"否"时应该跳过吸烟频率问题', async () => {
    const user = userEvent.setup();
    render(<SurveyForm survey={mockSurvey} />);

    const noOption = screen.getByLabelText('否');
    await user.click(noOption);

    await waitFor(() => {
      expect(screen.queryByText('您吸烟频率？')).not.toBeInTheDocument();
      expect(screen.getByText('您每周运动次数？')).toBeInTheDocument();
    });
  });

  it('当选择"是"时应该显示吸烟频率问题', async () => {
    const user = userEvent.setup();
    render(<SurveyForm survey={mockSurvey} />);

    const yesOption = screen.getByLabelText('是');
    await user.click(yesOption);

    await waitFor(() => {
      expect(screen.getByText('您吸烟频率？')).toBeInTheDocument();
      expect(screen.getByText('您每周运动次数？')).toBeInTheDocument();
    });
  });

  it('提交后应该显示成功信息', async () => {
    const user = userEvent.setup();
    render(<SurveyForm survey={mockSurvey} />);

    await user.click(screen.getByLabelText('是'));
    await user.click(screen.getByLabelText('每天'));
    await user.click(screen.getByLabelText('0次'));
    await user.click(screen.getByRole('button', { name: /提交问卷/ }));

    await waitFor(() => {
      expect(screen.getByText('提交成功！')).toBeInTheDocument();
    });
  });

  it('如果 token 已存在应该显示已提交信息', async () => {
    (api.surveyAPI.checkToken as vi.Mock).mockResolvedValue({ exists: true });
    render(<SurveyForm survey={mockSurvey} />);

    await waitFor(() => {
      expect(screen.getByText('您已提交过此问卷')).toBeInTheDocument();
    });
  });
});
