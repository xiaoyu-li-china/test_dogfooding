import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { v4 as uuidv4 } from 'uuid';
import { Survey, Question, Answer } from '../types';
import { QuestionItem } from './QuestionItem';
import { surveyAPI } from '../services/api';

interface SurveyFormProps {
  survey: Survey;
}

export const SurveyForm: React.FC<SurveyFormProps> = ({ survey }) => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [token] = useState(() => {
    const storageKey = `survey_${survey.id}_token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    const newToken = uuidv4();
    localStorage.setItem(storageKey, newToken);
    return newToken;
  });
  const [visibleQuestions, setVisibleQuestions] = useState<Question[]>(
    survey.questions.sort((a, b) => a.order - b.order)
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 200; // 每个问题项的估计高度
  const bufferSize = 3; // 缓冲区大小，额外渲染的项目数

  useEffect(() => {
    const checkToken = async () => {
      const result = await surveyAPI.checkToken(token);
      if (result.exists) {
        setAlreadySubmitted(true);
        setIsSubmitted(true);
      }
    };
    checkToken();
  }, [token]);

  const getNextQuestionOrder = (question: Question, answer: string | string[]): number | null => {
    if (!question.skip_logic?.conditions) return null;

    const answerValue = Array.isArray(answer) ? answer[0] : answer;
    if (!answerValue) return null;

    const condition = question.skip_logic.conditions.find(
      (c) => c.answer === answerValue
    );

    if (condition) {
      if (condition.action === 'jump' && condition.target_question_order) {
        return condition.target_question_order;
      }
    }
    return null;
  };

  const handleFieldChange = (values: Record<string, string | string[]>) => {
    const sortedQuestions = [...survey.questions].sort((a, b) => a.order - b.order);
    const visible: Question[] = [];
    let currentQuestionOrder = 1;

    while (currentQuestionOrder <= sortedQuestions.length) {
      const question = sortedQuestions.find((q) => q.order === currentQuestionOrder);
      if (!question) break;

      visible.push(question);

      const answer = values[`question_${question.id}`];
      const nextOrder = getNextQuestionOrder(question, answer);

      if (nextOrder !== null) {
        currentQuestionOrder = nextOrder;
      } else {
        currentQuestionOrder++;
      }
    }

    setVisibleQuestions(visible);
  };

  const handleSubmit = async (values: Record<string, string | string[]>) => {
    const answers: Answer[] = visibleQuestions.map((q) => ({
      question: q.id,
      value: values[`question_${q.id}`],
    }));

    try {
      await surveyAPI.submitResponse({
        survey: survey.id,
        token,
        answers,
      });
      setIsSubmitted(true);
    } catch (error) {
      console.error('提交失败:', error);
    }
  };

  const initialValues: Record<string, string | string[]> = {};
  survey.questions.forEach((q) => {
    initialValues[`question_${q.id}`] = q.question_type === 'multiple' ? [] : '';
  });

  if (alreadySubmitted) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', background: '#d4edda', borderRadius: '8px' }}>
        <h2 style={{ color: '#155724' }}>您已提交过此问卷</h2>
        <p style={{ color: '#155724' }}>感谢您的参与，每个用户只能提交一次。</p>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', background: '#d4edda', borderRadius: '8px' }}>
        <h2 style={{ color: '#155724' }}>提交成功！</h2>
        <p style={{ color: '#155724' }}>感谢您完成问卷。</p>
      </div>
    );
  }

  return (
    <Formik initialValues={initialValues} onSubmit={handleSubmit}>
      {({ values, isSubmitting }) => {
        handleFieldChange(values);
        return (
          <Form>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ color: '#333', marginBottom: '8px' }}>{survey.title}</h1>
              <p style={{ color: '#666' }}>{survey.description}</p>
            </div>

            <div 
              ref={containerRef}
              style={{
                maxHeight: '600px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                padding: '16px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
              }}
            >
              {visibleQuestions.map((question) => (
                <QuestionItem key={question.id} question={question} />
              ))}
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '12px 32px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? '提交中...' : '提交问卷'}
              </button>
            </div>
          </Form>
        );
      }}
    </Formik>
  );
};
