import React, { useEffect, useState, useCallback } from 'react';
import { Survey } from '../types';
import { useVirtualScroll } from '../hooks/useVirtualScroll';

interface SurveyListProps {
  onSelectSurvey: (survey: Survey) => void;
}

export const SurveyList: React.FC<SurveyListProps> = ({ onSelectSurvey }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const itemHeight = 150;
  const bufferSize = 20;
  const containerHeight = 600;

  const fetchSurveys = async (pageNum: number) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockData: Survey[] = Array.from({ length: 10 }, (_, i) => ({
        id: (pageNum - 1) * 10 + i + 1,
        title: `问卷 ${(pageNum - 1) * 10 + i + 1}`,
        description: `这是问卷 ${(pageNum - 1) * 10 + i + 1} 的描述`,
        created_at: new Date().toISOString(),
        questions: []
      }));
      return mockData;
    } catch (error) {
      console.error('获取问卷列表失败:', error);
      return [];
    }
  };

  const loadSurveys = async (pageNum: number, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchSurveys(pageNum);
      if (append) {
        setSurveys(prev => [...prev, ...data]);
      } else {
        setSurveys(data);
      }
      setHasMore(data.length > 0);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const {
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    containerRef,
    handleScroll: onVirtualScroll
  } = useVirtualScroll({
    items: surveys,
    itemHeight,
    bufferSize,
    containerHeight
  });

  useEffect(() => {
    loadSurveys(1);
  }, []);

  const handleScroll = useCallback(() => {
    onVirtualScroll();

    if (loadingMore || !hasMore) return;

    const container = containerRef.current;
    if (!container) return;

    const { clientHeight, scrollHeight, scrollTop } = container;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      setPage(prev => {
        const nextPage = prev + 1;
        loadSurveys(nextPage, true);
        return nextPage;
      });
    }
  }, [loadingMore, hasMore, onVirtualScroll, containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, containerRef]);

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '24px', color: '#333' }}>问卷列表</h1>
      <div 
        ref={containerRef}
        style={{
          height: `${containerHeight}px`,
          overflowY: 'auto',
          position: 'relative',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
        }}
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleItems.map((survey, index) => (
              <div
                key={`item-${startIndex + index}-${survey.id}`}
                onClick={() => onSelectSurvey(survey)}
                style={{
                  padding: '20px',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  height: `${itemHeight - 32}px`,
                  margin: '16px',
                  boxSizing: 'border-box',
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
        {loadingMore && (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            position: 'sticky',
            bottom: 0,
            background: 'white',
            zIndex: 1,
          }}>
            加载更多中...
          </div>
        )}
        {!hasMore && surveys.length > 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            已加载全部数据
          </div>
        )}
      </div>
    </div>
  );
};
