import React, { useState } from 'react';
import { Survey } from './types';
import { SurveyList } from './components/SurveyList';
import { SurveyForm } from './components/SurveyForm';

function App() {
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);

  const handleSelectSurvey = (survey: Survey) => {
    setSelectedSurvey(survey);
  };

  const handleBack = () => {
    setSelectedSurvey(null);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      {selectedSurvey ? (
        <div>
          <button
            onClick={handleBack}
            style={{
              marginBottom: '20px',
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ← 返回列表
          </button>
          <SurveyForm survey={selectedSurvey} />
        </div>
      ) : (
        <SurveyList onSelectSurvey={handleSelectSurvey} />
      )}
    </div>
  );
}

export default App;
