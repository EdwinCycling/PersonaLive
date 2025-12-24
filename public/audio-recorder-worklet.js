class AudioRecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    // inputs is an array of inputs, each input is an array of channels
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData) {
        // Convert Float32 to Int16 (PCM 16-bit)
        // We do this here to offload processing from the main thread
        const int16Data = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
          // Clamp the value between -1 and 1
          const s = Math.max(-1, Math.min(1, channelData[i]));
          // Scale to 16-bit integer range
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send the buffer to the main thread
        // We use the second argument to transfer ownership of the buffer, avoiding a copy
        this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
      }
    }
    return true; // Keep the processor alive
  }
}

registerProcessor('audio-recorder-worklet', AudioRecorderWorklet);
