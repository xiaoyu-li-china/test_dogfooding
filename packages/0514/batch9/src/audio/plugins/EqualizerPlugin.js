class EqualizerPlugin {
  constructor() {
    this.name = 'equalizer';
    this.filters = [];
    this.enabled = false;
    this.audioContext = null;
    this.outputNode = null;
    this.params = {
      gain60: { value: 0, min: -12, max: 12, type: 'range', label: '60Hz' },
      gain170: { value: 0, min: -12, max: 12, type: 'range', label: '170Hz' },
      gain310: { value: 0, min: -12, max: 12, type: 'range', label: '310Hz' },
      gain600: { value: 0, min: -12, max: 12, type: 'range', label: '600Hz' },
      gain1k: { value: 0, min: -12, max: 12, type: 'range', label: '1kHz' },
      gain3k: { value: 0, min: -12, max: 12, type: 'range', label: '3kHz' },
      gain6k: { value: 0, min: -12, max: 12, type: 'range', label: '6kHz' },
      gain12k: { value: 0, min: -12, max: 12, type: 'range', label: '12kHz' },
      gain14k: { value: 0, min: -12, max: 12, type: 'range', label: '14kHz' },
      gain16k: { value: 0, min: -12, max: 12, type: 'range', label: '16kHz' },
    };
  }

  init(audioContext) {
    this.audioContext = audioContext;
    this.createFilters();
  }

  createFilters() {
    const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    
    this.filters = frequencies.map((freq) => {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      return filter;
    });

    this.filters.reduce((prev, curr) => {
      prev.connect(curr);
      return curr;
    });
  }

  connect(sourceNode) {
    if (!this.enabled || this.filters.length === 0) {
      return sourceNode;
    }

    sourceNode.connect(this.filters[0]);
    return this.filters[this.filters.length - 1];
  }

  onParamChange(param, value) {
    const paramToIndex = {
      gain60: 0,
      gain170: 1,
      gain310: 2,
      gain600: 3,
      gain1k: 4,
      gain3k: 5,
      gain6k: 6,
      gain12k: 7,
      gain14k: 8,
      gain16k: 9,
    };

    const index = paramToIndex[param];
    if (index !== undefined && this.filters[index]) {
      this.filters[index].gain.value = value;
    }
  }

  setPreset(preset) {
    const presets = {
      flat: {
        gain60: 0, gain170: 0, gain310: 0, gain600: 0,
        gain1k: 0, gain3k: 0, gain6k: 0, gain12k: 0,
        gain14k: 0, gain16k: 0,
      },
      rock: {
        gain60: 4, gain170: 3, gain310: 2, gain600: 0,
        gain1k: -1, gain3k: 1, gain6k: 3, gain12k: 4,
        gain14k: 4, gain16k: 5,
      },
      pop: {
        gain60: -1, gain170: 1, gain310: 3, gain600: 4,
        gain1k: 3, gain3k: 1, gain6k: -1, gain12k: -2,
        gain14k: -2, gain16k: -2,
      },
      jazz: {
        gain60: 3, gain170: 2, gain310: 0, gain600: 1,
        gain1k: 2, gain3k: 3, gain6k: 2, gain12k: 1,
        gain14k: 2, gain16k: 3,
      },
      bass: {
        gain60: 8, gain170: 7, gain310: 5, gain600: 3,
        gain1k: 1, gain3k: 0, gain6k: 0, gain12k: 0,
        gain14k: 0, gain16k: 0,
      },
      vocal: {
        gain60: -2, gain170: -1, gain310: 0, gain600: 2,
        gain1k: 4, gain3k: 4, gain6k: 3, gain12k: 2,
        gain14k: 1, gain16k: 0,
      },
    };

    const presetValues = presets[preset] || presets.flat;
    
    Object.keys(presetValues).forEach((key => {
      this.params[key].value = presetValues[key];
      this.onParamChange(key, presetValues[key]);
    });
  }

  onEnable() {
    this.enabled = true;
  }

  onDisable() {
    this.enabled = false;
  }

  destroy() {
    this.filters.forEach(filter => filter.disconnect());
    this.filters = [];
  }
}

export default EqualizerPlugin;
