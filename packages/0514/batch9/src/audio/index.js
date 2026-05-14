import AudioEngine from './AudioEngine';
import EqualizerPlugin from './plugins/EqualizerPlugin';
import ReverbPlugin from './plugins/ReverbPlugin';

const createAudioEngine = () => {
  const engine = new AudioEngine();
  
  engine.registerPlugin('equalizer', new EqualizerPlugin());
  engine.registerPlugin('reverb', new ReverbPlugin());
  
  return engine;
};

export {
  AudioEngine,
  EqualizerPlugin,
  ReverbPlugin,
  createAudioEngine,
};

export default createAudioEngine;
