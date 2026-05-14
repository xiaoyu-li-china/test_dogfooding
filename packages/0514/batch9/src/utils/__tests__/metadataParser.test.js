import {
  parseFileMetadata,
  scanMusicFiles,
  parseLRC,
  findCurrentLyricIndex,
} from '../metadataParser';

jest.mock('jsmediatags', () => ({
  __esModule: true,
  default: {
    read: jest.fn(),
  },
}));

import jsmediatags from 'jsmediatags';

describe('metadataParser', () => {
  describe('parseFileMetadata', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should parse metadata successfully with all tags', async () => {
      const mockFile = {
        name: 'test_song.mp3',
        path: '/music/test_song.mp3',
        duration: 240,
      };

      const mockTags = {
        tags: {
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          year: '2023',
          genre: 'Rock',
          picture: {
            data: [137, 80, 78, 71],
            format: 'image/jpeg',
          },
        },
      };

      jsmediatags.read.mockImplementation((file, callbacks) => {
        callbacks.onSuccess(mockTags);
      });

      const result = await parseFileMetadata(mockFile);

      expect(jsmediatags.read).toHaveBeenCalledWith(
        mockFile,
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );

      expect(result).toEqual({
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        year: '2023',
        genre: 'Rock',
        cover: expect.stringContaining('data:image/jpeg;base64,'),
        path: '/music/test_song.mp3',
        duration: 240,
      });
    });

    it('should use fallback values when tags are missing', async () => {
      const mockFile = {
        name: 'untitled.mp3',
        path: '/music/untitled.mp3',
        duration: 180,
      };

      const mockTags = {
        tags: {
          title: null,
          artist: null,
          album: null,
          year: null,
          genre: null,
          picture: null,
        },
      };

      jsmediatags.read.mockImplementation((file, callbacks) => {
        callbacks.onSuccess(mockTags);
      });

      const result = await parseFileMetadata(mockFile);

      expect(result).toEqual({
        title: 'untitled.mp3',
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        year: null,
        genre: null,
        cover: null,
        path: '/music/untitled.mp3',
        duration: 180,
      });
    });

    it('should handle parsing errors gracefully', async () => {
      const mockFile = {
        name: 'corrupted.mp3',
        path: '/music/corrupted.mp3',
        duration: 0,
      };

      jsmediatags.read.mockImplementation((file, callbacks) => {
        callbacks.onError(new Error('Failed to read tags'));
      });

      const result = await parseFileMetadata(mockFile);

      expect(result).toEqual({
        title: 'corrupted.mp3',
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        year: null,
        genre: null,
        cover: null,
        path: '/music/corrupted.mp3',
        duration: 0,
      });
    });

    it('should handle file without name property', async () => {
      const mockFile = {
        path: '/music/no_name.mp3',
        duration: 200,
      };

      const mockTags = {
        tags: {
          title: null,
          artist: null,
          album: null,
        },
      };

      jsmediatags.read.mockImplementation((file, callbacks) => {
        callbacks.onSuccess(mockTags);
      });

      const result = await parseFileMetadata(mockFile);

      expect(result.title).toBe('Unknown Title');
    });
  });

  describe('scanMusicFiles', () => {
    it('should scan multiple music files', async () => {
      const mockFiles = [
        { name: 'song1.mp3', path: '/music/song1.mp3' },
        { name: 'song2.mp3', path: '/music/song2.mp3' },
      ];

      jsmediatags.read.mockImplementation((file, callbacks) => {
        callbacks.onSuccess({
          tags: {
            title: file.name,
            artist: 'Artist',
            album: 'Album',
          },
        });
      });

      const results = await scanMusicFiles(mockFiles);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('song1.mp3');
      expect(results[1].title).toBe('song2.mp3');
    });

    it('should handle empty files array', async () => {
      const results = await scanMusicFiles([]);
      expect(results).toEqual([]);
    });
  });

  describe('parseLRC', () => {
    it('should parse LRC lyrics correctly', () => {
      const lrcContent = `
[00:00.00]First line
[00:01.50]Second line
[00:03.00]Third line
      `;

      const result = parseLRC(lrcContent);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ time: 0, text: 'First line' });
      expect(result[1]).toEqual({ time: 1.5, text: 'Second line' });
      expect(result[2]).toEqual({ time: 3, text: 'Third line' });
    });

    it('should handle milliseconds with 3 digits', () => {
      const lrcContent = `
[00:00.500]Half second
[00:01.123]One second
      `;

      const result = parseLRC(lrcContent);

      expect(result[0].time).toBe(0.5);
      expect(result[1].time).toBe(1.123);
    });

    it('should sort lyrics by time', () => {
      const lrcContent = `
[00:03.00]Third
[00:01.00]First
[00:02.00]Second
      `;

      const result = parseLRC(lrcContent);

      expect(result[0].text).toBe('First');
      expect(result[1].text).toBe('Second');
      expect(result[2].text).toBe('Third');
    });

    it('should skip empty lines', () => {
      const lrcContent = `
[00:00.00]
[00:01.00]Valid line
      `;

      const result = parseLRC(lrcContent);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Valid line');
    });

    it('should return empty array for invalid LRC', () => {
      const lrcContent = 'No time tags here';
      const result = parseLRC(lrcContent);
      expect(result).toEqual([]);
    });

    it('should handle multiple time tags for same line', () => {
      const lrcContent = `
[00:00.00][00:05.00]Repeated line
      `;

      const result = parseLRC(lrcContent);

      expect(result).toHaveLength(2);
      expect(result[0].time).toBe(0);
      expect(result[1].time).toBe(5);
      expect(result[0].text).toBe('Repeated line');
      expect(result[1].text).toBe('Repeated line');
    });
  });

  describe('findCurrentLyricIndex', () => {
    const lyrics = [
      { time: 0, text: 'Line 1' },
      { time: 2.5, text: 'Line 2' },
      { time: 5, text: 'Line 3' },
      { time: 10, text: 'Line 4' },
    ];

    it('should return -1 when lyrics is empty', () => {
      const result = findCurrentLyricIndex([], 5);
      expect(result).toBe(-1);
    });

    it('should return -1 when lyrics is null', () => {
      const result = findCurrentLyricIndex(null, 5);
      expect(result).toBe(-1);
    });

    it('should find correct lyric index', () => {
      expect(findCurrentLyricIndex(lyrics, 0)).toBe(0);
      expect(findCurrentLyricIndex(lyrics, 1)).toBe(0);
      expect(findCurrentLyricIndex(lyrics, 2.5)).toBe(1);
      expect(findCurrentLyricIndex(lyrics, 3)).toBe(1);
      expect(findCurrentLyricIndex(lyrics, 5)).toBe(2);
      expect(findCurrentLyricIndex(lyrics, 9.99)).toBe(2);
      expect(findCurrentLyricIndex(lyrics, 10)).toBe(3);
    });

    it('should return last index when time exceeds all lyrics', () => {
      const result = findCurrentLyricIndex(lyrics, 100);
      expect(result).toBe(3);
    });

    it('should return -1 when time is negative', () => {
      const result = findCurrentLyricIndex(lyrics, -1);
      expect(result).toBe(-1);
    });
  });
});
