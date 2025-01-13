import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker 
// Use a dynamic import to load the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js', 
  import.meta.url
).toString();

// Function to clean up PDF text for book-like documents
export function cleanPDFText(text: string): string {
  try {
    console.log('Raw text before cleaning:', text.slice(0, 500) + '...'); // Log first 500 chars

    // Split text into lines
    let lines = text.split('\n');

    // Patterns to identify and remove non-content lines
    const nonContentPatterns = [
      // Headers and Footers
      /^(table of contents|contents|copyright|published by|isbn|library of congress)/i,
      
      // Page-related markers
      /^(page|pg\.?)\s*\d+/i,           // Page numbers at start of line
      /\d+\s*(page|pg\.?)\s*$/i,        // Page numbers at end of line
      
      // Common book-related metadata
      /^(chapter|section|part)\s*\d+/i, // Chapter/section markers
      /^(www\.|copyright|©|\d{4})/i,    // Web URLs, copyright notices, years
      
      // Decorative or structural lines
      /^\s*[•\-–—]+\s*$/,               // Lines with only markers
      /^\s*[•\-–—]\s*\d+\s*[•\-–—]/,    // Lines with markers and numbers
      
      // Very short lines that are likely not content
      /^\s*[a-z]{1,3}\s*$/i,            // Single letter or very short lines
    ];

    // Filter out non-content lines
    lines = lines.filter(line => {
      const trimmedLine = line.trim();
      return !nonContentPatterns.some(pattern => pattern.test(trimmedLine));
    });

    // Process remaining lines
    lines = lines.map(line => {
      // Remove page numbers within the line
      line = line.replace(/\b\d+\b/g, '');

      // Fix hyphenated words across lines
      line = line.replace(/(\w+)-\s*$\n^\s*(\w+)/gm, '$1$2');

      return line;
    });

    // Additional cleaning for book-like formatting
    const bookCleaningPatterns = [
      // Remove common heading-like lines
      /^(introduction|prologue|epilogue|conclusion|appendix|bibliography|references)/i,
      
      // Remove lines that look like section headers
      /^(chapter|section)\s*[ivxlcdm\d]+\s*[:.-]?\s*[a-z\s]+$/i
    ];

    lines = lines.filter(line => {
      const trimmedLine = line.trim();
      return !bookCleaningPatterns.some(pattern => pattern.test(trimmedLine));
    });

    // Rejoin lines, preserving original line breaks
    const cleanedText = lines.join('\n')
      // Remove multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n');

    console.log('Cleaned text length:', cleanedText.length);
    console.log('First 500 chars of cleaned text:', cleanedText.slice(0, 500) + '...');
    
    return cleanedText;
  } catch (error) {
    console.error('Error in cleanPDFText:', error);
    return text; // Return original text if cleaning fails
  }
}

// Function to extract text from PDF
export async function extractPDFText(file: File, mode: 'whole' | 'chapters'): Promise<string> {
  try {
    console.log('Starting PDF extraction:', { fileName: file.name, fileSize: file.size, mode });

    // Ensure PDF.js worker is loaded
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      console.error('PDF.js worker not properly initialized');
      throw new Error('PDF.js worker not initialized');
    }

    // Load the PDF file
    console.log('Loading PDF document...');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log('PDF loaded successfully. Number of pages:', pdf.numPages);

    let text = '';
    const numPages = pdf.numPages;
    
    // Extract text from all pages
    for (let i = 1; i <= numPages; i++) {
      console.log(`Processing page ${i} of ${numPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      // Log details about text content
      console.log(`Page ${i} text items:`, content.items.length);
      
      const pageText = content.items
        .map((item: any) => {
          // Log each text item for debugging
          console.log('Text item:', item.str);
          return item.str;
        })
        .filter(str => str.trim() !== '') // Remove empty strings
        .join('\n'); // Use newline to preserve line breaks
      
      text += pageText + '\n\n';
    }

    console.log('Raw text extracted. Length:', text.length);

    // Clean up the text
    text = cleanPDFText(text);

    if (mode === 'chapters') {
      const hasChapters = detectChapters(text);
      console.log('Chapter detection result:', hasChapters);

      if (hasChapters) {
        const chapters = splitIntoChapters(text);
        console.log('Number of chapters found:', chapters.length);
        
        // Join chapters with clear separators
        return chapters
          .map((chapter, index) => `Chapter ${index + 1}:\n${chapter}`)
          .join('\n\n' + '='.repeat(50) + '\n\n');
      } else {
        console.log('No chapters detected, returning whole text');
      }
    }

    return text;
  } catch (error) {
    console.error('Detailed error in PDF processing:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      fileName: file.name,
      fileSize: file.size,
      mode
    });
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Function to detect chapters in text
export function detectChapters(text: string): boolean {
  try {
    const chapterPatterns = [
      /chapter\s+\d+/gi,
      /section\s+\d+/gi,
      /part\s+\d+/gi,
      /^\d+\.\s+[A-Z]/gm,  // Numbered sections like "1. Introduction"
      /^[IVX]+\.\s+[A-Z]/gm,  // Roman numeral sections
      /^(introduction|conclusion|appendix|bibliography|references)/gim,  // Common section names
      /table\s+of\s+contents/gi
    ];

    return chapterPatterns.some(pattern => pattern.test(text));
  } catch (error) {
    console.error('Error in detectChapters:', error);
    return false;
  }
}

// Function to split text into chapters
function splitIntoChapters(text: string): string[] {
  try {
    const chapterPatterns = [
      /(?:^|\n)(?:chapter|section|part)\s+\d+/gi,
      /(?:^|\n)\d+\.\s+[A-Z]/gm,
      /(?:^|\n)[IVX]+\.\s+[A-Z]/gm,
      /(?:^|\n)(?:introduction|conclusion|appendix|bibliography|references)/gim
    ];

    // Combine all patterns into a single regex
    const combinedPattern = new RegExp(chapterPatterns.map(p => p.source).join('|'), 'gim');
    
    // Split text at chapter markers
    const chapters = text.split(combinedPattern);
    
    // Remove empty chapters and trim whitespace
    return chapters
      .map(chapter => chapter.trim())
      .filter(chapter => chapter.length > 0);
  } catch (error) {
    console.error('Error in splitIntoChapters:', error);
    return [text]; // Return original text as single chapter if splitting fails
  }
}
