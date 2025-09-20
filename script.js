class FlashcardApp {
    constructor() {
        this.words = [];
        this.currentIndex = 0;
        this.isFlipped = false;
        this.studyData = {};
        this.excelUrl = 'https://docs.google.com/spreadsheets/d/1TbBofmWTwgHGNTvDUXXjPCTawmbq7DoC/export?format=xlsx';
        this.initializeApp();
    }

    async initializeApp() {
        this.setupEventListeners();
        await this.loadExcelData();
        this.loadStudyData();
        this.showCurrentCard();
    }

    setupEventListeners() {
        const flipBtn = document.getElementById('flip-btn');
        const ngBtn = document.getElementById('ng-btn');
        const understoodBtn = document.getElementById('understood-btn');
        const flashcard = document.getElementById('flashcard');

        flipBtn.addEventListener('click', () => this.flipCard());
        ngBtn.addEventListener('click', () => this.recordAnswer(false));
        understoodBtn.addEventListener('click', () => this.recordAnswer(true));
        flashcard.addEventListener('click', () => this.flipCard());
    }

    async loadExcelData() {
        // Automatically load from the specified Google Sheets URL
        await this.loadFromGoogleSheets();
    }

    async loadFromGoogleSheets() {
        try {
            console.log('Fetching from:', this.excelUrl);
            
            // Try direct fetch first
            let response;
            try {
                response = await fetch(this.excelUrl);
            } catch (corsError) {
                console.log('Direct fetch failed, trying CORS proxy...');
                // Use CORS proxy as fallback
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(this.excelUrl)}`;
                response = await fetch(proxyUrl);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            this.processWorkbook(workbook);
            
        } catch (error) {
            console.error('Error loading Google Sheets:', error);
            alert(`Error loading data: ${error.message}\n\nPlease check your internet connection and try again.`);
        }
    }

    processWorkbook(workbook) {
        // Get the first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Process the data - Column B: Meaning, Column C: Japanese, Column D: Furigana
        // Column G: Understood Count, Column H: NG Count, Column I: Total Points
        this.words = jsonData
            .filter(row => row.length >= 4 && row[1] && row[2]) // Skip empty rows, check columns B and C
            .map((row, index) => ({
                id: index,
                japanese: row[2] || '', // Column C (index 2)
                meaning: row[1] || '',  // Column B (index 1)
                furigana: row[3] || '', // Column D (index 3)
                wrongCount: parseInt(row[4]) || 0, // Column E (index 4)
                lastStudied: row[5] ? new Date(row[5]).getTime() : null, // Column F (index 5)
                nextReview: Date.now(),
                understoodCount: parseInt(row[6]) || 0, // Column G (index 6)
                ngCount: parseInt(row[7]) || 0, // Column H (index 7)
                totalPoints: parseInt(row[8]) || 0 // Column I (index 8)
            }));

        if (this.words.length === 0) {
            alert('No valid data found in the Excel file. Please ensure the file has data in columns B (Meaning), C (Japanese), and D (Furigana)');
            return;
        }

        console.log(`Loaded ${this.words.length} words from Excel file`);
        this.updateProgress();
    }

    loadStudyData() {
        const saved = localStorage.getItem('flashcardStudyData');
        if (saved) {
            this.studyData = JSON.parse(saved);
            // Merge study data with words
            this.words.forEach(word => {
                if (this.studyData[word.id]) {
                    Object.assign(word, this.studyData[word.id]);
                }
                // Initialize point tracking if not exists
                word.understoodCount = word.understoodCount || 0;
                word.ngCount = word.ngCount || 0;
                word.totalPoints = word.totalPoints || 0;
            });
        } else {
            // Initialize point tracking for new words
            this.words.forEach(word => {
                word.understoodCount = 0;
                word.ngCount = 0;
                word.totalPoints = 0;
            });
        }
    }

    saveStudyData() {
        this.words.forEach(word => {
            this.studyData[word.id] = {
                wrongCount: word.wrongCount,
                lastStudied: word.lastStudied,
                nextReview: word.nextReview,
                understoodCount: word.understoodCount || 0,
                ngCount: word.ngCount || 0,
                totalPoints: word.totalPoints || 0
            };
        });
        localStorage.setItem('flashcardStudyData', JSON.stringify(this.studyData));
        
        // Automatically update Google Sheets
        this.updateGoogleSheets();
    }

    async updateGoogleSheets() {
        try {
            // Create a new workbook with the updated data
            const wb = XLSX.utils.book_new();
            
            // Prepare data for Excel - include study tracking columns
            // Column A: Empty, Column B: Meaning, Column C: Japanese, Column D: Furigana
            // Column E: Wrong Count, Column F: Last Studied, Column G: Understood Count, Column H: NG Count, Column I: Total Points
            const excelData = this.words.map(word => [
                '', // Column A (empty)
                word.meaning,  // Column B
                word.japanese, // Column C
                word.furigana, // Column D
                word.wrongCount, // Column E
                word.lastStudied ? new Date(word.lastStudied).toISOString() : '', // Column F
                word.understoodCount || 0, // Column G
                word.ngCount || 0, // Column H
                word.totalPoints || 0 // Column I
            ]);
            
            // Add headers
            excelData.unshift(['', 'Meaning', 'Japanese', 'Furigana', 'Wrong Count', 'Last Studied', 'Understood Count', 'NG Count', 'Total Points']);
            
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, ws, 'Flashcards');
            
            // Convert to buffer
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            
            // Create blob and download
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'flashcard_data_updated.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('Study data automatically exported to Excel file');
        } catch (error) {
            console.error('Error saving to Excel:', error);
        }
    }


    flipCard() {
        const flashcard = document.getElementById('flashcard');
        const flipBtn = document.getElementById('flip-btn');
        
        this.isFlipped = !this.isFlipped;
        flashcard.classList.toggle('flipped', this.isFlipped);
        
        if (this.isFlipped) {
            flipBtn.textContent = 'Show Question';
        } else {
            flipBtn.textContent = 'Show Answer';
        }
    }

    showCurrentCard() {
        if (this.words.length === 0) return;

        const currentWord = this.words[this.currentIndex];
        document.getElementById('japanese-word').textContent = currentWord.japanese;
        document.getElementById('meaning').textContent = currentWord.meaning;
        document.getElementById('furigana').textContent = currentWord.furigana;
        
        // Reset flip state
        this.isFlipped = false;
        document.getElementById('flashcard').classList.remove('flipped');
        document.getElementById('flip-btn').textContent = 'Show Answer';
        
        this.updateProgress();
    }

    recordAnswer(isCorrect) {
        if (this.words.length === 0) return;

        const currentWord = this.words[this.currentIndex];
        const now = Date.now();
        
        // Update study data
        currentWord.lastStudied = now;
        
        // Update point system
        if (isCorrect) {
            currentWord.understoodCount++;
            currentWord.totalPoints++;
        } else {
            currentWord.ngCount++;
            currentWord.totalPoints--;
            currentWord.wrongCount++;
        }
        
        // Spaced repetition based on total points
        if (currentWord.totalPoints < 0) {
            // Negative points = show more frequently
            currentWord.nextReview = now + (1000 * 60 * 5); // 5 minutes
        } else if (currentWord.totalPoints === 0) {
            // Neutral points = show in 1 hour
            currentWord.nextReview = now + (1000 * 60 * 60); // 1 hour
        } else {
            // Positive points = show less frequently (up to 7 days)
            const delay = Math.min(1000 * 60 * 60 * 24 * currentWord.totalPoints, 1000 * 60 * 60 * 24 * 7); // Max 7 days
            currentWord.nextReview = now + delay;
        }

        this.saveStudyData();
        this.nextCard();
    }

    nextCard() {
        // Implement spaced repetition algorithm based on total points
        const now = Date.now();
        const availableWords = this.words.filter(word => word.nextReview <= now);
        
        if (availableWords.length > 0) {
            // Prioritize words with lower total points (more difficult)
            availableWords.sort((a, b) => {
                if (a.totalPoints !== b.totalPoints) {
                    return a.totalPoints - b.totalPoints; // Lower points first
                }
                return a.nextReview - b.nextReview; // Earlier review time first
            });
            
            this.currentIndex = availableWords[0].id;
        } else {
            // If no words are due for review, pick a random one
            this.currentIndex = Math.floor(Math.random() * this.words.length);
        }
        
        this.showCurrentCard();
    }

    updateProgress() {
        const totalWords = this.words.length;
        const studiedWords = this.words.filter(word => word.lastStudied).length;
        
        document.getElementById('progress-text').textContent = `${studiedWords} / ${totalWords}`;
        document.getElementById('progress-fill').style.width = `${(studiedWords / totalWords) * 100}%`;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FlashcardApp();
});
