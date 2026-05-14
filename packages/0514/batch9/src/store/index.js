import { configureStore } from '@reduxjs/toolkit';
import playlistReducer from './playlistSlice';

export const store = configureStore({
  reducer: {
    playlist: playlistReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;
