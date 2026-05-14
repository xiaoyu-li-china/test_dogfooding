export interface Question {
  id: number;
  text: string;
  question_type: 'single' | 'multiple' | 'text';
  options: string[];
  order: number;
  skip_logic?: {
    conditions?: Array<{
      answer: string;
      action: 'next' | 'jump';
      target_question_order?: number;
    }>;
  };
}

export interface Survey {
  id: number;
  title: string;
  description: string;
  created_at: string;
  questions: Question[];
}

export interface Answer {
  question: number;
  value: string | string[];
}

export interface SurveyResponse {
  survey: number;
  token: string;
  answers: Answer[];
}
