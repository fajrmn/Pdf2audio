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
      <div class="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
        <h2 class="text-lg font-semibold text-gray-700 mb-2">Upload PDF</h2>
        <div class="flex items-center space-x-2 mb-2">
          <input 
            type="file" 
            id="pdfInput" 
            accept=".pdf"
            class="hidden" 
          />
          <button 
            id="pdfUploadBtn"
            class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-300 ease-in-out"
          >
            Choose PDF File
          </button>
        </div>
        <div class="flex items-center space-x-2">
          <select 
            id="pdfMode" 
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="whole">Extract Whole Document</option>
            <option value="chapters">Split by Chapters (if available)</option>
          </select>
        </div>
        <div id="pdfInfo" class="mt-2 text-sm text-gray-600 hidden">
          <p id="pdfName"></p>
          <p id="pdfSize"></p>
          <div id="pdfStatus" class="mt-1"></div>
        </div>
        <div id="pdfError" class="mt-2 text-sm text-red-600 hidden"></div>
        
        <!-- New PDF Text Preview Section -->
        <div id="pdfTextPreviewContainer" class="mt-4 hidden">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-md font-semibold text-gray-700">PDF Text Preview</h3>
            <button 
              id="copyPdfTextBtn"
              class="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition duration-300 ease-in-out flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 011 1h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h2z" />
                <path d="M11 3a1 1 0 00-1-1H8a1 1 0 00-1 1H5a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2z" />
              </svg>
              Copy Text
            </button>
          </div>
          <textarea 
            id="pdfTextPreview"
            readonly
            rows="6" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>
      </div>
      
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
        <span id="characterCount" class="text-sm text-gray-600"></span>
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
      
      <div class="mt-4">
        <h2 class="text-xl font-semibold text-gray-700 mb-2">Cached Voices</h2>
        <div id="cachedVoicesContainer" class="border border-gray-200 rounded-md p-3 min-h-[100px]">
          <p id="cachedVoicesPlaceholder" class="text-gray-500 text-center">No voices cached yet</p>
          <ul id="cachedVoicesList" class="space-y-1"></ul>
        </div>
        <button 
          id="refreshCachedVoicesBtn" 
          class="mt-2 w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition duration-300 ease-in-out"
        >
          Refresh Cached Voices
        </button>
        <button 
          id="clearCachedVoicesBtn" 
          class="mt-2 w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition duration-300 ease-in-out"
        >
          Clear All Cached Voices
        </button>
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
const pdfInput = document.getElementById('pdfInput') as HTMLInputElement;
const pdfUploadBtn = document.getElementById('pdfUploadBtn') as HTMLButtonElement;
const pdfMode = document.getElementById('pdfMode') as HTMLSelectElement;
const pdfInfo = document.getElementById('pdfInfo') as HTMLDivElement;
const pdfName = document.getElementById('pdfName') as HTMLParagraphElement;
const pdfSize = document.getElementById('pdfSize') as HTMLParagraphElement;
const pdfStatus = document.getElementById('pdfStatus') as HTMLDivElement;
const pdfError = document.getElementById('pdfError') as HTMLDivElement;
const pdfTextPreviewContainer = document.getElementById('pdfTextPreviewContainer') as HTMLDivElement;
const pdfTextPreview = document.getElementById('pdfTextPreview') as HTMLTextAreaElement;
const copyPdfTextBtn = document.getElementById('copyPdfTextBtn') as HTMLButtonElement;

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

// Handle PDF upload button click
pdfUploadBtn.addEventListener('click', () => {
  pdfInput.click();
});

// Handle PDF file selection
pdfInput.addEventListener('change', async () => {
  const file = pdfInput.files?.[0];
  if (!file) return;

  try {
    // Reset UI
    pdfError.classList.add('hidden');
    pdfError.textContent = '';
    pdfStatus.textContent = '';
    pdfTextPreviewContainer.classList.add('hidden');
    
    // Show file info
    pdfInfo.classList.remove('hidden');
    pdfName.textContent = `File: ${file.name}`;
    pdfSize.textContent = `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    pdfStatus.textContent = 'Processing PDF...';

    // Extract text from PDF
    const mode = pdfMode.value as 'whole' | 'chapters';
    const text = await extractPDFText(file, mode);

    console.log('Extracted text details:', {
      length: text.length,
      firstChars: text.slice(0, 500) + '...'
    });

    // Ensure text is not just whitespace
    const trimmedText = text.trim();
    if (!trimmedText) {
      throw new Error('No readable text could be extracted from the PDF');
    }

    // Update text preview
    pdfTextPreview.value = trimmedText;
    pdfTextPreviewContainer.classList.remove('hidden');

    // Update text input with a character limit warning
    const MAX_TEXT_LENGTH = 10000; // Adjust as needed
    if (trimmedText.length > MAX_TEXT_LENGTH) {
      pdfStatus.textContent = `Warning: Text truncated to ${MAX_TEXT_LENGTH} characters`;
      pdfStatus.className = 'mt-1 text-yellow-600';
      textInput.value = trimmedText.slice(0, MAX_TEXT_LENGTH);
    } else {
      textInput.value = trimmedText;
      pdfStatus.textContent = 'PDF processed successfully!';
      pdfStatus.className = 'mt-1 text-green-600';
    }

    // Update character count
    updateCharacterCount();

    // Enable generate button if voice is selected
    if (voiceSelect.value) {
      generateBtn.disabled = false;
    }
  } catch (error) {
    console.error('Comprehensive PDF processing error:', error);
    
    // Detailed error handling
    let errorMessage = 'Failed to process PDF';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // More specific error messages
      if (error.message.includes('No readable text')) {
        errorMessage = 'Unable to extract text from PDF. The document might be scanned, image-based, or encrypted.';
      } else if (error.message.includes('password')) {
        errorMessage = 'PDF is password-protected. Please provide an unlocked version.';
      }
    }

    // Update UI with error
    pdfError.classList.remove('hidden');
    pdfError.textContent = errorMessage;
    pdfStatus.textContent = '';
    textInput.value = ''; // Clear text input on error
    pdfTextPreviewContainer.classList.add('hidden');
    
    // Reset character count
    updateCharacterCount();
  }
});

// Add a function to update character count
function updateCharacterCount() {
  const characterCount = document.getElementById('characterCount') as HTMLSpanElement;
  if (characterCount) {
    characterCount.textContent = `${textInput.value.length} characters`;
  }
}

// Add event listeners for cached voices functionality
document.getElementById('refreshCachedVoicesBtn')?.addEventListener('click', displayCachedVoices);

document.getElementById('clearCachedVoicesBtn')?.addEventListener('click', async () => {
  await storage.flush();
  await displayCachedVoices();
});

// Function to display cached voices
async function displayCachedVoices() {
  const cachedVoicesList = document.getElementById('cachedVoicesList') as HTMLUListElement;
  const cachedVoicesPlaceholder = document.getElementById('cachedVoicesPlaceholder') as HTMLParagraphElement;
  
  try {
    const cachedVoices = await storage.stored();
    
    // Clear previous list
    cachedVoicesList.innerHTML = '';
    
    if (cachedVoices.length === 0) {
      cachedVoicesPlaceholder.style.display = 'block';
    } else {
      cachedVoicesPlaceholder.style.display = 'none';
      
      cachedVoices.forEach(voiceId => {
        const listItem = document.createElement('li');
        listItem.classList.add('flex', 'justify-between', 'items-center', 'bg-gray-100', 'px-3', 'py-1', 'rounded');
        
        const voiceText = document.createElement('span');
        voiceText.textContent = voiceId;
        
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.classList.add('text-red-600', 'hover:text-red-800', 'text-sm');
        removeButton.addEventListener('click', async () => {
          await storage.remove(voiceId);
          await displayCachedVoices();
        });
        
        listItem.appendChild(voiceText);
        listItem.appendChild(removeButton);
        cachedVoicesList.appendChild(listItem);
      });
    }
  } catch (error) {
    console.error('Error fetching cached voices:', error);
    cachedVoicesList.innerHTML = `<li class="text-red-600">Error fetching cached voices</li>`;
  }
}

// Initial display of cached voices
displayCachedVoices();

// Add copy functionality
copyPdfTextBtn.addEventListener('click', () => {
  // Copy text to clipboard
  navigator.clipboard.writeText(pdfTextPreview.value).then(() => {
    // Temporary visual feedback
    copyPdfTextBtn.textContent = 'Copied!';
    copyPdfTextBtn.classList.replace('bg-blue-500', 'bg-green-500');
    
    // Reset after 2 seconds
    setTimeout(() => {
      copyPdfTextBtn.textContent = 'Copy Text';
      copyPdfTextBtn.classList.replace('bg-green-500', 'bg-blue-500');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
  });
});
