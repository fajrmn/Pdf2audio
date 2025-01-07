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
      
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label for="languageSelect" class="block text-sm font-medium text-gray-700 mb-2">Select Language</label>
          <select id="languageSelect" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Loading languages...</option>
          </select>
        </div>
        
        <div>
          <label for="voiceSelect" class="block text-sm font-medium text-gray-700 mb-2">Select Voice</label>
          <select id="voiceSelect" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" disabled>
            <option value="">Select a language first</option>
          </select>
        </div>
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
        class="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
const voiceSelect = document.getElementById('voiceSelect') as HTMLSelectElement;
const textInput = document.getElementById('textInput') as HTMLTextAreaElement;
const generateBtn = document.getElementById('btn') as HTMLButtonElement;
const audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement;
const loadingContainer = document.getElementById('loadingContainer') as HTMLDivElement;
const audioContainer = document.getElementById('audioContainer') as HTMLDivElement;

// Store voices data
let availableVoices: tts.Voice[] = [];
let voicesByLanguage: {[key: string]: tts.Voice[]} = {};

// Populate voices dynamically
async function populateVoices() {
  try {
    availableVoices = await tts.voices();
    
    // Group voices by language
    voicesByLanguage = {};
    availableVoices.forEach(voice => {
      const langKey = `${voice.language.code} - ${voice.language.name_english}`;
      if (!voicesByLanguage[langKey]) {
        voicesByLanguage[langKey] = [];
      }
      voicesByLanguage[langKey].push(voice);
    });

    // Populate language dropdown
    languageSelect.innerHTML = '<option value="">Select a language</option>';
    Object.keys(voicesByLanguage).sort().forEach(langKey => {
      const option = document.createElement('option');
      option.value = langKey;
      option.textContent = langKey;
      languageSelect.appendChild(option);
    });

    // Enable language select
    languageSelect.disabled = false;
  } catch (error) {
    console.error('Failed to load voices:', error);
    languageSelect.innerHTML = '<option value="">Failed to load languages</option>';
  }
}

// Handle language selection
languageSelect.addEventListener('change', () => {
  const selectedLanguage = languageSelect.value;
  voiceSelect.innerHTML = '';
  
  if (selectedLanguage) {
    const voices = voicesByLanguage[selectedLanguage];
    voices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = voice.key;
      option.textContent = `${index + 1} - ${voice.name_english} (${voice.quality})`;
      voiceSelect.appendChild(option);
    });
    voiceSelect.disabled = false;
    generateBtn.disabled = false;
  } else {
    voiceSelect.innerHTML = '<option value="">Select a language first</option>';
    voiceSelect.disabled = true;
    generateBtn.disabled = true;
  }
});

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
  languageSelect.disabled = true;
  voiceSelect.disabled = true;

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

      // Hide loading and re-enable controls
      loadingContainer.classList.add('hidden');
      generateBtn.disabled = false;
      languageSelect.disabled = false;
      voiceSelect.disabled = false;

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
      languageSelect.disabled = false;
      voiceSelect.disabled = false;
      alert('Failed to generate speech. Check console for details.');
    });

  } catch (error) {
    console.error('Speech generation error:', error);
    loadingContainer.classList.add('hidden');
    generateBtn.disabled = false;
    languageSelect.disabled = false;
    voiceSelect.disabled = false;
    alert('Failed to generate speech. Check console for details.');
  }
});
