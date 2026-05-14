import React, { useEffect, useState } from 'react';
import { Survey } from '../types';
import { surveyAPI } from '../services/api';

interface SurveyListProps {
  onSelectSurvey: (survey: Survey) => void;
}

export const SurveyList: React.FC<SurveyListProps> = ({ onSelectSurvey }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        const data = await surveyAPI.getSurveys();
        setSurveys(data);
      } catch (error) {
        console.error('获取问卷列表失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSurveys();
  }, []);

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '24px', color: '#333' }}>问卷列表</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {surveys.map((survey) => (
          <div
            key={survey.id}
            onClick={() => onSelectSurvey(survey)}
            style={{
              padding: '20px',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            <h2 style={{ marginBottom: '8px', color: '#333', fontSize: '18px' }}>
              {survey.title}
            </h2>
            <p style={{ color: '#666', margin: 0 }}>{survey.description}</p>
            <small style={{ color: '#999' }}>
              创建于: {new Date(survey.created_at).toLocaleDateString('zh-CN')}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
};
