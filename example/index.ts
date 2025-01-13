import * as tts from '../src';
import Worker from './worker.ts?worker';
import * as storage from '../src/storage';
import { extractPDFText } from './pdfProcessor';

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
        <span class="text-blue-600">PDF</span> to Audio Books
      </h1>
      
      <!-- PDF Upload Section -->
      <div class="mb-4">
        <div class="flex justify-between items-center mb-2">
          <label class="text-sm font-medium text-gray-700">Upload PDF</label>
        </div>
        <div 
          id="dropZone"
          class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors duration-200 bg-gray-50"
        >
          <input
            type="file"
            id="pdfFileInput"
            accept=".pdf"
            class="hidden"
          />
          <div class="flex flex-col items-center justify-center space-y-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-sm text-gray-600">Drop your PDF here or <span class="text-blue-500">click to upload</span></p>
          </div>
        </div>
      </div>

      <!-- Text Input Section -->
      <div class="mb-4">
        <div class="flex justify-between items-center mb-2">
          <label for="textInput" class="text-sm font-medium text-gray-700">Enter Text</label>
          <button 
            id="expandTextBtn"
            class="text-gray-500 hover:text-gray-700 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100"
            title="Expand/Collapse"
          >
            <svg 
              id="expandIcon" 
              xmlns="http://www.w3.org/2000/svg" 
              class="h-5 w-5 icon-collapsed" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H5.414l4.293 4.293a1 1 0 01-1.414 1.414L4 6.414V9a1 1 0 01-2 0V4zm14 12a1 1 0 01-1 1h-4a1 1 0 010-2h2.586l-4.293-4.293a1 1 0 011.414-1.414L16 13.586V11a1 1 0 012 0v5z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="relative">
          <textarea 
            id="textInput" 
            placeholder="Type or paste the text you want to convert to speech..." 
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ease-in-out textarea-collapsed resize-none"
          ></textarea>
        </div>
      </div>

      <!-- Voice Selection -->
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
      
      <div class="mt-8">
        <div class="flex items-center space-x-2 mb-2">
          <h2 class="text-sm font-medium text-gray-700">Cached Voices</h2>
          <button 
            id="refreshCachedVoicesBtn"
            class="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
          >
            Refresh
          </button>
          <span class="text-gray-300">|</span>
          <button 
            id="clearCachedVoicesBtn"
            class="text-xs text-red-600 hover:text-red-800 hover:underline transition-colors duration-200"
          >
            Clear All
          </button>
        </div>
        <div id="cachedVoicesList" class="text-sm text-gray-600 space-y-1 min-h-[50px]"></div>
      </div>
    </div>
  </div>
`;

// Add custom styles for text area expansion
const style = document.createElement('style');
style.textContent = `
  .textarea-expanded {
    height: 400px !important;
    transition: height 0.3s ease-in-out;
  }
  .textarea-collapsed {
    height: 100px !important;
    transition: height 0.3s ease-in-out;
  }
  .icon-expanded {
    transform: rotate(180deg);
    transition: transform 0.3s ease-in-out;
  }
  .icon-collapsed {
    transform: rotate(0deg);
    transition: transform 0.3s ease-in-out;
  }
`;
document.head.appendChild(style);

// Get DOM elements
const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
const voiceSelect = document.getElementById('voiceSelect') as HTMLSelectElement;
const textInput = document.getElementById('textInput') as HTMLTextAreaElement;
const generateBtn = document.getElementById('btn') as HTMLButtonElement;
const audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement;
const loadingContainer = document.getElementById('loadingContainer') as HTMLDivElement;
const audioContainer = document.getElementById('audioContainer') as HTMLDivElement;
const dropZone = document.getElementById('dropZone') as HTMLDivElement;
const pdfFileInput = document.getElementById('pdfFileInput') as HTMLInputElement;
const expandTextBtn = document.getElementById('expandTextBtn') as HTMLButtonElement;
const expandIcon = document.getElementById('expandIcon') as SVGElement;

// Initialize textarea with collapsed state
textInput.classList.add('textarea-collapsed');
expandIcon.classList.add('icon-collapsed');

// Add expand/collapse functionality
expandTextBtn.addEventListener('click', () => {
  const textArea = textInput;
  const icon = expandIcon;
  
  if (textArea.classList.contains('textarea-collapsed')) {
    textArea.classList.remove('textarea-collapsed');
    textArea.classList.add('textarea-expanded');
    icon.classList.remove('icon-collapsed');
    icon.classList.add('icon-expanded');
  } else {
    textArea.classList.remove('textarea-expanded');
    textArea.classList.add('textarea-collapsed');
    icon.classList.remove('icon-expanded');
    icon.classList.add('icon-collapsed');
  }
});

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
  } catch (error) {
    console.error('Failed to fetch voices:', error);
    languageSelect.innerHTML = '<option value="">Failed to load voices</option>';
  }
}

// Handle language selection
languageSelect.addEventListener('change', () => {
  const selectedLanguage = languageSelect.value;
  voiceSelect.innerHTML = '';
  voiceSelect.disabled = !selectedLanguage;

  if (selectedLanguage) {
    const voices = voicesByLanguage[selectedLanguage];
    
    // Sort voices to group similar voices together
    voices.sort((a, b) => a.key.localeCompare(b.key));
    
    voices.forEach((voice, index) => {
      const option = document.createElement('option');
      
      // Create a more readable voice name
      // Extract the name part from the key (after the language code)
      const nameParts = voice.key.split('-');
      const voiceName = nameParts.slice(1, -1).join(' ');
      const voiceQuality = nameParts[nameParts.length - 1];
      
      // Format: "Index - Voice Name (Quality)"
      option.value = voice.key;
      option.textContent = `${index + 1} - ${voiceName} (${voiceQuality.charAt(0).toUpperCase() + voiceQuality.slice(1)})`;
      
      voiceSelect.appendChild(option);
    });
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

    worker.addEventListener('message', (event: MessageEvent<{ type: string, audio?: Blob, message?: string }>) => {
      // Hide loading and re-enable controls
      loadingContainer.classList.add('hidden');
      generateBtn.disabled = false;
      languageSelect.disabled = false;
      voiceSelect.disabled = false;

      if (event.data.type === 'error') {
        alert(event.data.message || 'Failed to generate speech');
        return;
      }

      if (event.data.type === 'result' && event.data.audio) {
        // Show audio
        const currentAudioUrl = URL.createObjectURL(event.data.audio);
        audioPlayer.src = currentAudioUrl;
        audioContainer.classList.remove('hidden');
        audioPlayer.play();
      }

      worker?.terminate();
      worker = null;
    });

    worker.addEventListener('error', (error) => {
      console.error('Worker error:', error);
      loadingContainer.classList.add('hidden');
      generateBtn.disabled = false;
      languageSelect.disabled = false;
      voiceSelect.disabled = false;
      alert('Failed to generate speech. The text might be too long or contain unsupported characters.');
      
      worker?.terminate();
      worker = null;
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

// Add drag and drop functionality
dropZone.addEventListener('click', () => {
  pdfFileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('border-blue-500', 'bg-blue-50');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('border-blue-500', 'bg-blue-50');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-blue-500', 'bg-blue-50');
  
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.type === 'application/pdf') {
      await handlePDFFile(file);
    } else {
      alert('Please upload a PDF file');
    }
  }
});

pdfFileInput.addEventListener('change', async () => {
  const file = pdfFileInput.files?.[0];
  if (file) {
    await handlePDFFile(file);
  }
});

// Handle PDF file selection
async function handlePDFFile(file: File) {
  try {
    loadingContainer.classList.remove('hidden');
    const text = await extractPDFText(file);
    textInput.value = text;
    loadingContainer.classList.add('hidden');
  } catch (error) {
    console.error('Error processing PDF:', error);
    loadingContainer.classList.add('hidden');
    alert('Error processing PDF file');
  }
}

// Function to display cached voices
async function displayCachedVoices() {
  const cachedVoicesList = document.getElementById('cachedVoicesList')!;
  
  try {
    const voices = await storage.stored();
    
    if (voices.length === 0) {
      cachedVoicesList.innerHTML = '<p class="text-gray-500 italic">No voices cached</p>';
      return;
    }

    cachedVoicesList.innerHTML = voices
      .map(voiceId => {
        const name = availableVoices.find(v => v.id === voiceId)?.name || voiceId;
        return `
          <div class="flex items-center justify-between py-1">
            <span>${name}</span>
            <button 
              class="text-red-500 hover:text-red-700 text-xs hover:underline"
              onclick="(async () => { 
                await storage.remove('${voiceId}'); 
                displayCachedVoices();
              })()">
              Remove
            </button>
          </div>
        `;
      })
      .join('');
  } catch (error) {
    console.error('Error displaying cached voices:', error);
    cachedVoicesList.innerHTML = '<p class="text-red-500">Error loading cached voices</p>';
  }
}

// Add event listeners for cached voices
document.getElementById('refreshCachedVoicesBtn')?.addEventListener('click', displayCachedVoices);

document.getElementById('clearCachedVoicesBtn')?.addEventListener('click', async () => {
  try {
    await storage.flush();
    displayCachedVoices();
  } catch (error) {
    console.error('Error clearing cached voices:', error);
    alert('Error clearing cached voices');
  }
});

// Initial display of cached voices
displayCachedVoices();
