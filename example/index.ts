import * as tts from '../src';
import Worker from './worker.ts?worker';

// Add Tailwind CSS
const link = document.createElement('link');
link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
link.rel = 'stylesheet';
document.head.appendChild(link);

// required for e2e
Object.assign(window, { tts });

// Initial HTML structure
document.querySelector('#app')!.innerHTML = `
  <div class="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center p-4">
    <div class="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-md">
      <h1 class="text-3xl font-bold text-center text-gray-800 mb-6">
        <span class="text-blue-600">VITS</span> Text-to-Speech
      </h1>
      
      <div class="mb-4">
        <label for="voiceSelect" class="block text-sm font-medium text-gray-700 mb-2">Select Voice</label>
        <select id="voiceSelect" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Loading voices...</option>
        </select>
      </div>
      
      <div class="mb-4">
        <label for="textInput" class="block text-sm font-medium text-gray-700 mb-2">Enter Text</label>
        <textarea 
          id="textInput" 
          placeholder="Type the text you want to convert to speech..." 
          rows="4" 
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        ></textarea>
      </div>
      
      <div id="loadingContainer" class="hidden mb-4 flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <span class="ml-3 text-gray-700">Generating speech...</span>
      </div>
      
      <button 
        id="btn" 
        class="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        disabled
      >
        Generate Speech
      </button>
      
      <div id="audioContainer" class="mt-4 hidden">
        <audio id="audioPlayer" controls class="w-full"></audio>
      </div>
    </div>
  </div>
`;

// Get DOM elements
const voiceSelect = document.getElementById('voiceSelect') as HTMLSelectElement;
const textInput = document.getElementById('textInput') as HTMLTextAreaElement;
const generateBtn = document.getElementById('btn') as HTMLButtonElement;
const audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement;
const loadingContainer = document.getElementById('loadingContainer') as HTMLDivElement;
const audioContainer = document.getElementById('audioContainer') as HTMLDivElement;

// Populate voices dynamically
async function populateVoices() {
  try {
    const availableVoices = await tts.voices();
    
    // Clear existing options
    voiceSelect.innerHTML = '';
    
    // Group voices by language
    const voicesByLanguage: {[key: string]: tts.Voice[]} = {};
    availableVoices.forEach(voice => {
      const langKey = `${voice.language.code} - ${voice.language.name_english}`;
      if (!voicesByLanguage[langKey]) {
        voicesByLanguage[langKey] = [];
      }
      voicesByLanguage[langKey].push(voice);
    });

    // Keep track of voice count
    let voiceCount = 1;

    // Create optgroups
    Object.entries(voicesByLanguage).forEach(([langKey, voices]) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = langKey;
      
      voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.key;
        option.textContent = `${voiceCount} - ${voice.name_english} (${voice.quality})`;
        optgroup.appendChild(option);
        
        voiceCount++;
      });
      
      voiceSelect.appendChild(optgroup);
    });

    // Enable generate button
    generateBtn.disabled = false;
    
    // Set a default voice if available
    const defaultVoice = availableVoices.find(v => v.key === 'en_US-hfc_female-medium');
    if (defaultVoice) {
      voiceSelect.value = defaultVoice.key;
    }
  } catch (error) {
    console.error('Failed to load voices:', error);
    voiceSelect.innerHTML = '<option value="">Failed to load voices</option>';
  }
}

// Populate voices on load
populateVoices();

generateBtn.addEventListener('click', async () => {
  const text = textInput.value.trim();
  const voiceId = voiceSelect.value;

  // Reset previous state
  audioContainer.classList.add('hidden');
  audioPlayer.src = '';

  if (!text) {
    alert('Please enter some text');
    return;
  }

  // Show loading
  loadingContainer.classList.remove('hidden');
  generateBtn.disabled = true;

  try {
    // Ensure the model is downloaded
    await tts.download(voiceId, (progress) => {
      console.log(`Downloading model: ${Math.round(progress.loaded * 100 / progress.total)}%`);
    });

    const worker = new Worker();

    worker.postMessage({
      type: 'init',
      text: text,
      voiceId: voiceId,
    });

    worker.addEventListener('message', (event: MessageEvent<{ type: 'result', audio: Blob }>) => {
      if (event.data.type != 'result') return;

      // Hide loading
      loadingContainer.classList.add('hidden');
      generateBtn.disabled = false;

      // Show audio
      audioPlayer.src = URL.createObjectURL(event.data.audio);
      audioContainer.classList.remove('hidden');
      audioPlayer.play();
      worker.terminate();
    });

    worker.addEventListener('error', (error) => {
      console.error('Worker error:', error);
      loadingContainer.classList.add('hidden');
      generateBtn.disabled = false;
      alert('Failed to generate speech. Check console for details.');
    });

  } catch (error) {
    console.error('Speech generation error:', error);
    loadingContainer.classList.add('hidden');
    generateBtn.disabled = false;
    alert('Failed to generate speech. Check console for details.');
  }
});
