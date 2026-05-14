import React from 'react';
import { Question } from '../types';
import { Field, FieldProps } from 'formik';

interface QuestionItemProps {
  question: Question;
}

export const QuestionItem: React.FC<QuestionItemProps> = ({ question }) => {
  return (
    <div style={{ marginBottom: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
      <h3 style={{ marginBottom: '12px', color: '#333' }}>
        {question.order}. {question.text}
      </h3>

      {question.question_type === 'single' && (
        <Field name={`question_${question.id}`}>
          {({ field }: FieldProps) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {question.options.map((option) => (
                <label key={`${question.id}_${option}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    {...field}
                    value={option}
                    checked={field.value === option}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          )}
        </Field>
      )}

      {question.question_type === 'multiple' && (
        <Field name={`question_${question.id}`}>
          {({ field }: FieldProps<string[]>) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {question.options.map((option) => (
                <label key={`${question.id}_${option}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    {...field}
                    value={option}
                    checked={field.value?.includes(option) || false}
                    onChange={(e) => {
                      const currentValue = field.value || [];
                      if (e.target.checked) {
                        field.onChange({
                          target: {
                            name: field.name,
                            value: [...currentValue, option],
                          },
                        });
                      } else {
                        field.onChange({
                          target: {
                            name: field.name,
                            value: currentValue.filter((v: string) => v !== option),
                          },
                        });
                      }
                    }}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          )}
        </Field>
      )}

      {question.question_type === 'text' && (
        <Field name={`question_${question.id}`}>
          {({ field }: FieldProps) => (
            <textarea
              {...field}
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                resize: 'vertical',
                fontSize: '14px',
              }}
              placeholder="请输入您的回答..."
            />
          )}
        </Field>
      )}
    </div>
  );
};
