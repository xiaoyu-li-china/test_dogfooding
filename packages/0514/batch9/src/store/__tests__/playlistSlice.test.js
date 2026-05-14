import playlistReducer, {
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
  selectCurrentTrack,
  selectHasNext,
  selectHasPrev,
} from '../playlistSlice';

describe('playlistSlice reducer', () => {
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

  it('should return the initial state', () => {
    expect(playlistReducer(undefined, {})).toEqual(initialState);
  });

  describe('setPlaylist', () => {
    it('should set playlist and reset current index and lyrics', () => {
      const mockPlaylist = [
        { id: 1, title: 'Song 1', artist: 'Artist 1' },
        { id: 2, title: 'Song 2', artist: 'Artist 2' },
      ];
      
      const state = playlistReducer(initialState, setPlaylist(mockPlaylist));
      
      expect(state.playlist).toEqual(mockPlaylist);
      expect(state.currentIndex).toBe(-1);
      expect(state.lyrics).toEqual([]);
      expect(state.currentLyricIndex).toBe(-1);
    });
  });

  describe('setCurrentIndex', () => {
    it('should set current index', () => {
      const state = playlistReducer(initialState, setCurrentIndex(2));
      expect(state.currentIndex).toBe(2);
    });
  });

  describe('setPlaying', () => {
    it('should set playing state to true', () => {
      const state = playlistReducer(initialState, setPlaying(true));
      expect(state.isPlaying).toBe(true);
    });

    it('should set playing state to false', () => {
      const state = playlistReducer({ ...initialState, isPlaying: true }, setPlaying(false));
      expect(state.isPlaying).toBe(false);
    });
  });

  describe('setCurrentTime', () => {
    it('should set current time', () => {
      const state = playlistReducer(initialState, setCurrentTime(123.45));
      expect(state.currentTime).toBe(123.45);
    });
  });

  describe('setDuration', () => {
    it('should set duration', () => {
      const state = playlistReducer(initialState, setDuration(240.5));
      expect(state.duration).toBe(240.5);
    });
  });

  describe('toggleLoop', () => {
    it('should toggle loop from false to true', () => {
      const state = playlistReducer(initialState, toggleLoop());
      expect(state.isLoop).toBe(true);
    });

    it('should toggle loop from true to false', () => {
      const state = playlistReducer({ ...initialState, isLoop: true }, toggleLoop());
      expect(state.isLoop).toBe(false);
    });
  });

  describe('setLyrics', () => {
    it('should set lyrics and reset current lyric index', () => {
      const mockLyrics = [
        { time: 0, text: 'Hello' },
        { time: 1, text: 'World' },
      ];
      
      const state = playlistReducer(
        { ...initialState, currentLyricIndex: 5 },
        setLyrics(mockLyrics)
      );
      
      expect(state.lyrics).toEqual(mockLyrics);
      expect(state.currentLyricIndex).toBe(-1);
    });
  });

  describe('setCurrentLyricIndex', () => {
    it('should set current lyric index', () => {
      const state = playlistReducer(initialState, setCurrentLyricIndex(3));
      expect(state.currentLyricIndex).toBe(3);
    });
  });

  describe('playNext', () => {
    it('should not change state when playlist is empty', () => {
      const state = playlistReducer(initialState, playNext());
      expect(state).toEqual(initialState);
    });

    it('should move to next track when not at end', () => {
      const stateWithPlaylist = {
        ...initialState,
        playlist: [{ id: 1 }, { id: 2 }, { id: 3 }],
        currentIndex: 1,
      };
      
      const state = playlistReducer(stateWithPlaylist, playNext());
      expect(state.currentIndex).toBe(2);
    });

    it('should loop to first track when at end and loop is enabled', () => {
      const stateWithPlaylist = {
        ...initialState,
        playlist: [{ id: 1 }, { id: 2 }, { id: 3 }],
        currentIndex: 2,
        isLoop: true,
      };
      
      const state = playlistReducer(stateWithPlaylist, playNext());
      expect(state.currentIndex).toBe(0);
    });

    it('should stop playing when at end and loop is disabled', () => {
      const stateWithPlaylist = {
        ...initialState,
        playlist: [{ id: 1 }, { id: 2 }, { id: 3 }],
        currentIndex: 2,
        isPlaying: true,
        isLoop: false,
      };
      
      const state = playlistReducer(stateWithPlaylist, playNext());
      expect(state.isPlaying).toBe(false);
    });
  });

  describe('playPrev', () => {
    it('should not change state when playlist is empty', () => {
      const state = playlistReducer(initialState, playPrev());
      expect(state).toEqual(initialState);
    });

    it('should move to previous track when not at start', () => {
      const stateWithPlaylist = {
        ...initialState,
        playlist: [{ id: 1 }, { id: 2 }, { id: 3 }],
        currentIndex: 2,
      };
      
      const state = playlistReducer(stateWithPlaylist, playPrev());
      expect(state.currentIndex).toBe(1);
    });

    it('should loop to last track when at start', () => {
      const stateWithPlaylist = {
        ...initialState,
        playlist: [{ id: 1 }, { id: 2 }, { id: 3 }],
        currentIndex: 0,
      };
      
      const state = playlistReducer(stateWithPlaylist, playPrev());
      expect(state.currentIndex).toBe(2);
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      const state = playlistReducer(initialState, setLoading(true));
      expect(state.isLoading).toBe(true);
    });

    it('should set loading to false', () => {
      const state = playlistReducer({ ...initialState, isLoading: true }, setLoading(false));
      expect(state.isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error and reset loading', () => {
      const errorMessage = 'Failed to load playlist';
      const state = playlistReducer(
        { ...initialState, isLoading: true },
        setError(errorMessage)
      );
      
      expect(state.error).toBe(errorMessage);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('resetPlaylist', () => {
    it('should reset to initial state', () => {
      const modifiedState = {
        playlist: [{ id: 1 }],
        currentIndex: 0,
        isPlaying: true,
        currentTime: 100,
        duration: 200,
        isLoop: true,
        lyrics: [{ time: 0, text: 'test' }],
        currentLyricIndex: 0,
        isLoading: true,
        error: 'some error',
      };
      
      const state = playlistReducer(modifiedState, resetPlaylist());
      expect(state).toEqual(initialState);
    });
  });
});

describe('selectors', () => {
  describe('selectCurrentTrack', () => {
    it('should return null when current index is -1', () => {
      const state = {
        playlist: {
          playlist: [{ id: 1 }, { id: 2 }],
          currentIndex: -1,
        },
      };
      
      expect(selectCurrentTrack(state)).toBeNull();
    });

    it('should return null when current index is out of bounds', () => {
      const state = {
        playlist: {
          playlist: [{ id: 1 }, { id: 2 }],
          currentIndex: 5,
        },
      };
      
      expect(selectCurrentTrack(state)).toBeNull();
    });

    it('should return current track', () => {
      const track = { id: 2, title: 'Test Song' };
      const state = {
        playlist: {
          playlist: [{ id: 1 }, track],
          currentIndex: 1,
        },
      };
      
      expect(selectCurrentTrack(state)).toEqual(track);
    });
  });

  describe('selectHasNext', () => {
    it('should return true when not at end', () => {
      const state = {
        playlist: {
          playlist: [{ id: 1 }, { id: 2 }, { id: 3 }],
          currentIndex: 1,
          isLoop: false,
        },
      };
      
      expect(selectHasNext(state)).toBe(true);
    });

    it('should return true when at end but loop is enabled', () => {
      const state = {
        playlist: {
          playlist: [{ id: 1 }, { id: 2 }, { id: 3 }],
          currentIndex: 2,
          isLoop: true,
        },
      };
      
      expect(selectHasNext(state)).toBe(true);
    });

    it('should return false when at end and loop is disabled', () => {
      const state = {
        playlist: {
          playlist: [{ id: 1 }, { id: 2 }, { id: 3 }],
          currentIndex: 2,
          isLoop: false,
        },
      };
      
      expect(selectHasNext(state)).toBe(false);
    });
  });

  describe('selectHasPrev', () => {
    it('should return false when playlist is empty', () => {
      const state = {
        playlist: {
          playlist: [],
        },
      };
      
      expect(selectHasPrev(state)).toBe(false);
    });

    it('should return true when playlist is not empty', () => {
      const state = {
        playlist: {
          playlist: [{ id: 1 }],
        },
      };
      
      expect(selectHasPrev(state)).toBe(true);
    });
  });
});
