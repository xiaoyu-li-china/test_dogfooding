import jsmediatags from 'jsmediatags';

export const parseFileMetadata = (file) => {
  return new Promise((resolve, reject) => {
    jsmediatags.read(file, {
      onSuccess: (tag) => {
        const { title, artist, album, year, genre, picture } = tag.tags;
        
        let coverUrl = null;
        if (picture) {
          const { data, format } = picture;
          const base64String = btoa(String.fromCharCode(...new Uint8Array(data)));
          coverUrl = `data:${format};base64,${base64String}`;
        }

        resolve({
          title: title || file.name || 'Unknown Title',
          artist: artist || 'Unknown Artist',
          album: album || 'Unknown Album',
          year: year || null,
          genre: genre || null,
          cover: coverUrl,
          path: file.path || null,
          duration: file.duration || 0,
        });
      },
      onError: (error) => {
        resolve({
          title: file.name || 'Unknown Title',
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          year: null,
          genre: null,
          cover: null,
          path: file.path || null,
          duration: file.duration || 0,
        });
      },
    });
  });
};

export const scanMusicFiles = (files) => {
  return Promise.all(
    files.map((file) => parseFileMetadata(file))
  );
};

export const parseLRC = (lrcContent) => {
  const lines = lrcContent.split('\n');
  const parsedLyrics = [];
  
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  
  lines.forEach(line => {
    const matches = [...line.matchAll(timeRegex)];
    if (matches.length > 0) {
      const text = line.replace(timeRegex, '').trim();
      matches.forEach(match => {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3].padEnd(3, '0'));
        const time = minutes * 60 + seconds + milliseconds / 1000;
        
        if (text) {
          parsedLyrics.push({ time, text });
        }
      });
    }
  });
  
  return parsedLyrics.sort((a, b) => a.time - b.time);
};

export const findCurrentLyricIndex = (lyrics, currentTime) => {
  if (!lyrics || lyrics.length === 0) return -1;
  
  let index = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= currentTime) {
      index = i;
    } else {
      break;
    }
  }
  
  return index;
};
