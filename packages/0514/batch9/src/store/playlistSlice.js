import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  playlist: [],
  currentIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  isLoop: false,
  lyrics: [],
  currentLyricIndex: -1,
  isLoading: false,
  error: null,
};

const playlistSlice = createSlice({
  name: 'playlist',
  initialState,
  reducers: {
    setPlaylist: (state, action) => {
      state.playlist = action.payload;
      state.currentIndex = -1;
      state.lyrics = [];
      state.currentLyricIndex = -1;
    },
    setCurrentIndex: (state, action) => {
      state.currentIndex = action.payload;
    },
    setPlaying: (state, action) => {
      state.isPlaying = action.payload;
    },
    setCurrentTime: (state, action) => {
      state.currentTime = action.payload;
    },
    setDuration: (state, action) => {
      state.duration = action.payload;
    },
    toggleLoop: (state) => {
      state.isLoop = !state.isLoop;
    },
    setLyrics: (state, action) => {
      state.lyrics = action.payload;
      state.currentLyricIndex = -1;
    },
    setCurrentLyricIndex: (state, action) => {
      state.currentLyricIndex = action.payload;
    },
    playNext: (state) => {
      if (state.playlist.length === 0) return;
      
      if (state.currentIndex < state.playlist.length - 1) {
        state.currentIndex += 1;
      } else if (state.isLoop) {
        state.currentIndex = 0;
      } else {
        state.isPlaying = false;
      }
    },
    playPrev: (state) => {
      if (state.playlist.length === 0) return;
      
      if (state.currentIndex > 0) {
        state.currentIndex -= 1;
      } else {
        state.currentIndex = state.playlist.length - 1;
      }
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    resetPlaylist: () => initialState,
  },
});

export const {
  setPlaylist,
  setCurrentIndex,
  setPlaying,
  setCurrentTime,
  setDuration,
  toggleLoop,
  setLyrics,
  setCurrentLyricIndex,
  playNext,
  playPrev,
  setLoading,
  setError,
  resetPlaylist,
} = playlistSlice.actions;

export const selectCurrentTrack = (state) => {
  if (state.playlist.currentIndex >= 0 && state.playlist.currentIndex < state.playlist.playlist.length) {
    return state.playlist.playlist[state.playlist.currentIndex];
  }
  return null;
};

export const selectHasNext = (state) => {
  return state.playlist.currentIndex < state.playlist.playlist.length - 1 || state.playlist.isLoop;
};

export const selectHasPrev = (state) => {
  return state.playlist.playlist.length > 0;
};

export default playlistSlice.reducer;
