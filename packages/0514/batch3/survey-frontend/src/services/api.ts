import axios from 'axios';
import { Survey, SurveyResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
});

export const surveyAPI = {
  getSurveys: async (): Promise<Survey[]> => {
    const response = await api.get('/surveys/');
    return response.data;
  },

  getSurvey: async (id: number): Promise<Survey> => {
    const response = await api.get(`/surveys/${id}/`);
    return response.data;
  },

  submitResponse: async (data: SurveyResponse) => {
    const response = await api.post('/responses/submit/', data);
    return response.data;
  },

  checkToken: async (token: string): Promise<{ exists: boolean }> => {
    const response = await api.get(`/responses/check-token/${token}/`);
    return response.data;
  },
};
