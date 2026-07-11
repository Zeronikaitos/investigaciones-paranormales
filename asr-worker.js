/* Investigación Fantasma — local ASR worker
   Runs Whisper (via Transformers.js) entirely off the main thread, so loading the
   model (WASM compile + weight download/decode) and running inference can never
   block page rendering — this is what was freezing the camera preview for up to
   a minute when the model loading used to happen inline on the main thread.
*/
let pipelinePromise = null;

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      // 'tiny' multilingual model: smallest usable Whisper size, cached by the
      // browser after the first download so later uses work fully offline.
      return await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        quantized: true
      });
    })();
  }
  return pipelinePromise;
}

self.onmessage = async (e) => {
  const { type, id } = e.data || {};
  if (type === 'load') {
    try {
      await getPipeline();
      self.postMessage({ type: 'loaded', id });
    } catch (err) {
      self.postMessage({ type: 'error', id, message: String(err && err.message || err) });
    }
    return;
  }
  if (type === 'transcribe') {
    try {
      const asr = await getPipeline();
      const out = await asr(e.data.audio, { language: e.data.language, task: 'transcribe' });
      self.postMessage({ type: 'result', id, text: (out && out.text) ? out.text : '' });
    } catch (err) {
      self.postMessage({ type: 'error', id, message: String(err && err.message || err) });
    }
  }
};
