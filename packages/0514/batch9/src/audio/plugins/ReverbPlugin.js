class ReverbPlugin {
  constructor() {
    this.name = 'reverb';
    this.audioContext = null;
    this.convolver = null;
    this.dryGain = null;
    this.wetGain = null;
    this.enabled = false;
    this.params = {
      decay: { value: 2, min: 0.1, max: 10, type: 'range', label: 'Decay (s)' },
      wet: { value: 0.3, min: 0, max: 1, type: 'range', label: 'Wet' },
      dry: { value: 0.7, min: 0, max: 1, type: 'range', label: 'Dry' },
    };
  }

  init(audioContext) {
    this.audioContext = audioContext;
    this.convolver = this.audioContext.createConvolver();
    this.dryGain = this.audioContext.createGain();
    this.wetGain = this.audioContext.createGain();
    
    this.dryGain.gain.value = this.params.dry.value;
    this.wetGain.gain.value = this.params.wet.value;
    
    this.generateImpulseResponse(this.params.decay.value);
  }

  generateImpulseResponse(decay) {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * decay;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const envelope = Math.pow(1 - i / length, 2);
        channelData[i] = (Math.random() * 2 - 1) * envelope;
      }
    }

    this.convolver.buffer = impulse;
  }

  connect(sourceNode) {
    if (!this.enabled) {
      return sourceNode;
    }

    const outputNode = this.audioContext.createGain();
    
    sourceNode.connect(this.dryGain);
    sourceNode.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.dryGain.connect(outputNode);
    this.wetGain.connect(outputNode);

    return outputNode;
  }

  onParamChange(param, value) {
    if (param === 'decay') {
      this.generateImpulseResponse(value);
    } else if (param === 'wet') {
      if (this.wetGain) {
        this.wetGain.gain.value = value;
      }
    } else if (param === 'dry') {
      if (this.dryGain) {
        this.dryGain.gain.value = value;
      }
    }
  }

  setPreset(preset) {
    const presets = {
      small: { decay: 1, wet: 0.2, dry: 0.8 },
      medium: { decay: 2, wet: 0.3, dry: 0.7 },
      large: { decay: 3.5, wet: 0.4, dry: 0.6 },
      hall: { decay: 5, wet: 0.5, dry: 0.5 },
      church: { decay: 8, wet: 0.6, dry: 0.4 },
    };

    const presetValues = presets[preset] || presets.medium;
    
    Object.keys(presetValues).forEach(key => {
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
    if (this.convolver) {
      this.convolver.disconnect();
      this.convolver.buffer = null;
    }
    if (this.dryGain) {
      this.dryGain.disconnect();
    }
    if (this.wetGain) {
      this.wetGain.disconnect();
    }
  }
}

export default ReverbPlugin;
