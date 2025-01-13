import * as tts from '../src/index';

async function main(event: MessageEvent<tts.InferenceConfg & { type: 'init' }>) {
  if (event.data?.type != 'init') return;

  try {
    // Validate and clean text
    let text = event.data.text.trim();
    
    // Check if text is empty
    if (!text) {
      throw new Error('Text is empty');
    }

    // Remove any problematic characters that might cause memory issues
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Split long text into smaller chunks if needed
    const MAX_CHARS = 1000;
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS);
    }

    const blob = await tts.predict({
      text: text,
      voiceId: event.data.voiceId,
    });

    self.postMessage({ type: 'result', audio: blob });
  } catch (error) {
    console.error('TTS Error:', error);
    self.postMessage({ 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Failed to generate speech'
    });
  }
}

self.addEventListener('message', main);
