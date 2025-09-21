class FlashcardApp {
    constructor() {
        this.words = [];
        this.currentIndex = 0;
        this.isFlipped = false;
        this.studyData = {};
        // Google Sheets URL - will be converted to direct download format
        this.excelUrl = 'https://docs.google.com/spreadsheets/d/1qWnkiNxCc5OEOTgZRePAy4YztMweMNSSxECvZdHTiZ8/export?format=xlsx';
        this.performanceChart = null;
        this.currentPeriod = 'week';
        this.db = null;
        this.userId = 'single-user'; // Fixed user ID for single user app
        this.frontMode = 'japanese'; // 'japanese' or 'explanation'
        this.wordOrder = 'shuffle'; // 'original' or 'shuffle'
        this.originalWords = []; // Store original order
        this.favoriteWords = new Set(); // Store favorite word IDs
        this.isFavoritesMode = false; // Whether currently showing only favorites
        this.initializeFirebase();
    }

    initializeFirebase() {
        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyBDr8v-ihpAMj_k9GVXQk2G6bWk9Nk-UJQ",
            authDomain: "flashcard-app-d93fb.firebaseapp.com",
            projectId: "flashcard-app-d93fb",
            storageBucket: "flashcard-app-d93fb.firebasestorage.app",
            messagingSenderId: "972812866854",
            appId: "1:972812866854:web:857d9cae7a1d12a04e1de7",
            measurementId: "G-HC8XTXZXSZ"
        };

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        this.db = firebase.firestore();
        
        // Initialize app directly (no authentication needed)
        this.initializeApp();
    }


    async initializeApp() {
        try {
            console.log('Initializing app...');
            this.setupEventListeners();
            await this.loadExcelData();
            await this.loadStudyDataFromFirebase();
            this.restoreSessionState();
            this.initializePerformanceChart();
            this.showCurrentCard();
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
            alert('Error initializing app. Check console for details.');
        }
    }

    setupEventListeners() {
        const ngBtn = document.getElementById('ng-btn');
        const understoodBtn = document.getElementById('understood-btn');
        const flashcard = document.getElementById('flashcard');
        const chartBtns = document.querySelectorAll('.chart-btn');

        // Menu elements
        const menuToggle = document.getElementById('menu-toggle');
        const menuContent = document.getElementById('menu-content');
        const viewDataBtn = document.getElementById('view-data-btn');
        const refreshDataBtn = document.getElementById('refresh-data-btn');
        const reviewFavoritesBtn = document.getElementById('review-favorites-btn');
        const saveExcelBtn = document.getElementById('save-excel-btn');
        const favoriteBtn = document.getElementById('favorite-btn');
        const frontModeRadios = document.querySelectorAll('input[name="front-mode"]');
        const wordOrderRadios = document.querySelectorAll('input[name="word-order"]');

        ngBtn.addEventListener('click', () => {
            this.recordAnswer(false);
            // Reset card styles after button click
            const flashcard = document.getElementById('flashcard');
            flashcard.style.transform = '';
            flashcard.style.opacity = '1';
        });
        understoodBtn.addEventListener('click', () => {
            this.recordAnswer(true);
            // Reset card styles after button click
            const flashcard = document.getElementById('flashcard');
            flashcard.style.transform = '';
            flashcard.style.opacity = '1';
        });
        
        // Add touch/swipe support
        this.setupTouchEvents();
        
        // Menu toggle
        menuToggle.addEventListener('click', () => {
            menuContent.classList.toggle('show');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuToggle.contains(e.target) && !menuContent.contains(e.target)) {
                menuContent.classList.remove('show');
            }
        });

        // Menu buttons
        viewDataBtn.addEventListener('click', () => {
            this.showDataDebug();
            menuContent.classList.remove('show');
        });

        refreshDataBtn.addEventListener('click', async () => {
            menuContent.classList.remove('show');
            await this.refreshData();
        });

        reviewFavoritesBtn.addEventListener('click', () => {
            this.toggleFavoritesMode();
            menuContent.classList.remove('show');
        });

        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card flip when clicking heart
            this.toggleFavorite();
        });

        // Add touch event for mobile devices
        favoriteBtn.addEventListener('touchend', (e) => {
            e.stopPropagation(); // Prevent card flip when touching heart
            e.preventDefault(); // Prevent default touch behavior
            this.toggleFavorite();
        });


        saveExcelBtn.addEventListener('click', () => {
            this.updateGoogleSheets();
            menuContent.classList.remove('show');
        });

        // Front mode radio buttons
        frontModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.frontMode = e.target.value;
                this.showCurrentCard();
                menuContent.classList.remove('show');
            });
        });

        // Word order radio buttons
        wordOrderRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.wordOrder = e.target.value;
                this.applyWordOrder();
                menuContent.classList.remove('show');
            });
        });
        
        chartBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentPeriod = e.target.dataset.period;
                chartBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updatePerformanceChart();
            });
        });
    }

    setupTouchEvents() {
        const flashcard = document.getElementById('flashcard');
        const swipeLeftHint = document.getElementById('swipe-left-hint');
        const swipeRightHint = document.getElementById('swipe-right-hint');
        const swipeZoneLeft = document.getElementById('swipe-zone-left');
        const swipeZoneRight = document.getElementById('swipe-zone-right');
        const swipeThresholdLeft = document.getElementById('swipe-threshold-left');
        const swipeThresholdRight = document.getElementById('swipe-threshold-right');
        
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;
        let isSwipe = false;
        let isDragging = false;
        let swipeThreshold = 100; // Minimum distance for swipe action
        let cardWidth = 0;

        // Get card width for calculations
        const updateCardWidth = () => {
            cardWidth = flashcard.offsetWidth;
        };
        updateCardWidth();
        window.addEventListener('resize', updateCardWidth);

        const resetCard = () => {
            flashcard.style.transform = '';
            flashcard.style.opacity = '1';
            flashcard.classList.remove('swiping');
            swipeLeftHint.classList.add('hidden');
            swipeRightHint.classList.add('hidden');
            swipeZoneLeft.classList.remove('active');
            swipeZoneRight.classList.remove('active');
            swipeThresholdLeft.classList.remove('show');
            swipeThresholdRight.classList.remove('show');
        };

        const updateCardPosition = (deltaX, deltaY) => {
            if (!isDragging) return;
            
            const rotation = (deltaX / cardWidth) * 15; // Max 15 degrees rotation
            const translateX = deltaX * 0.3; // Dampen the movement
            const opacity = Math.max(0.3, 1 - Math.abs(deltaX) / (cardWidth * 0.5));
            
            flashcard.style.transform = `translateX(${translateX}px) rotate(${rotation}deg)`;
            flashcard.style.opacity = opacity;
            
            // Show visual feedback
            if (Math.abs(deltaX) > 20) {
                if (deltaX > 0) {
                    // Swiping right
                    swipeRightHint.classList.remove('hidden');
                    swipeLeftHint.classList.add('hidden');
                    swipeZoneRight.classList.add('active');
                    swipeZoneLeft.classList.remove('active');
                    
                    if (deltaX > swipeThreshold) {
                        swipeThresholdRight.classList.add('show');
                    } else {
                        swipeThresholdRight.classList.remove('show');
                    }
                } else {
                    // Swiping left
                    swipeLeftHint.classList.remove('hidden');
                    swipeRightHint.classList.add('hidden');
                    swipeZoneLeft.classList.add('active');
                    swipeZoneRight.classList.remove('active');
                    
                    if (Math.abs(deltaX) > swipeThreshold) {
                        swipeThresholdLeft.classList.add('show');
                    } else {
                        swipeThresholdLeft.classList.remove('show');
                    }
                }
            } else {
                resetCard();
            }
        };

        const handleSwipeEnd = (deltaX, deltaY) => {
            const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
            const isSignificantSwipe = Math.abs(deltaX) > swipeThreshold;
            
            if (isHorizontalSwipe && isSignificantSwipe) {
                // Record answer immediately
                if (deltaX > 0) {
                    this.recordAnswer(true); // Swipe right - Understood
                } else {
                    this.recordAnswer(false); // Swipe left - NG
                }
                
                // Reset card styles and show next word immediately
                resetCard();
            } else {
                // Snap back to center
                flashcard.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
                resetCard();
                
                // If it was just a tap, flip the card
                if (!isHorizontalSwipe && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                    setTimeout(() => this.flipCard(), 100);
                }
            }
        };

        // Touch events
        flashcard.addEventListener('touchstart', (e) => {
            console.log('Touch start detected');
            const touch = e.touches[0];
            const target = e.target;
            
            // Check if touch is on the favorite button
            if (target.closest('.favorite-btn')) {
                console.log('Touch on favorite button, allowing click');
                return; // Let the button handle its own click
            }
            
            startX = touch.clientX;
            startY = touch.clientY;
            currentX = startX;
            currentY = startY;
            isSwipe = false;
            isDragging = false;
            flashcard.style.transition = 'none';
        }, { passive: true });

        flashcard.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                currentX = touch.clientX;
                currentY = touch.clientY;
                
                const deltaX = currentX - startX;
                const deltaY = currentY - startY;
                
                // Check if this is a horizontal swipe
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                    isSwipe = true;
                    isDragging = true;
                    e.preventDefault(); // Prevent scrolling during swipe
                    updateCardPosition(deltaX, deltaY);
                }
            }
        }, { passive: false });

        flashcard.addEventListener('touchend', (e) => {
            const target = e.target;
            
            // Check if touch is on the favorite button
            if (target.closest('.favorite-btn')) {
                console.log('Touch end on favorite button, allowing click');
                return; // Let the button handle its own click
            }
            
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;
            const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            console.log(`Touch end: distance=${totalDistance.toFixed(2)}, isDragging=${isDragging}, isSwipe=${isSwipe}`);
            
            if (isDragging) {
                handleSwipeEnd(deltaX, deltaY);
            } else if (totalDistance < 20) {
                // Simple tap - flip card
                console.log('Touch tap detected - flipping card');
                e.preventDefault();
                this.flipCard();
            } else {
                console.log('Touch movement too large, not flipping');
            }
            
            isDragging = false;
            isSwipe = false;
        }, { passive: false });

        // Mouse events for desktop
        let mouseDown = false;
        let mouseStartX = 0;
        let mouseStartY = 0;
        let mouseCurrentX = 0;
        let mouseCurrentY = 0;

        flashcard.addEventListener('mousedown', (e) => {
            console.log('Mouse down detected');
            mouseDown = true;
            mouseStartX = e.clientX;
            mouseStartY = e.clientY;
            mouseCurrentX = mouseStartX;
            mouseCurrentY = mouseStartY;
            isSwipe = false;
            isDragging = false;
            flashcard.style.transition = 'none';
        });

        flashcard.addEventListener('mousemove', (e) => {
            if (mouseDown) {
                mouseCurrentX = e.clientX;
                mouseCurrentY = e.clientY;
                
                const deltaX = mouseCurrentX - mouseStartX;
                const deltaY = mouseCurrentY - mouseStartY;
                
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                    isSwipe = true;
                    isDragging = true;
                    updateCardPosition(deltaX, deltaY);
                }
            }
        });

        flashcard.addEventListener('mouseup', (e) => {
            if (mouseDown) {
                const deltaX = mouseCurrentX - mouseStartX;
                const deltaY = mouseCurrentY - mouseStartY;
                const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                console.log(`Mouse up: distance=${totalDistance.toFixed(2)}, isDragging=${isDragging}, isSwipe=${isSwipe}`);
                
                if (isDragging) {
                    handleSwipeEnd(deltaX, deltaY);
                } else if (totalDistance < 10) {
                    // Simple click - flip card (increased threshold slightly)
                    console.log('Mouse click detected - flipping card');
                    this.flipCard();
                }
                
                mouseDown = false;
                isDragging = false;
                isSwipe = false;
            }
        });

        // Prevent context menu on long press
        flashcard.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Handle mouse leave to reset card
        flashcard.addEventListener('mouseleave', () => {
            if (mouseDown && isDragging) {
                const deltaX = mouseCurrentX - mouseStartX;
                const deltaY = mouseCurrentY - mouseStartY;
                handleSwipeEnd(deltaX, deltaY);
                mouseDown = false;
                isDragging = false;
            }
        });
    }

    async loadExcelData() {
        // Automatically load from the specified Google Sheets URL
        await this.loadFromGoogleSheets();
    }

    async refreshData() {
        console.log('Refreshing data from Google Sheets...');
        
        // Show loading indicator
        const progressText = document.getElementById('progress-text');
        const originalText = progressText.textContent;
        progressText.textContent = 'Refreshing data...';
        
        try {
            // Clear current data
            this.words = [];
            this.currentIndex = 0;
            this.isFlipped = false;
            
            // Reload data
            await this.loadFromGoogleSheets();
            
            // Reload study data from Firebase
            await this.loadStudyDataFromFirebase();
            
            // Restore session state
            this.restoreSessionState();
            
            // Update display
            this.showCurrentCard();
            this.updatePerformanceChart();
            
            console.log('Data refresh completed successfully');
            alert('Data refreshed successfully!');
            
        } catch (error) {
            console.error('Error refreshing data:', error);
            alert('Error refreshing data. Check console for details.');
        } finally {
            // Restore progress text
            progressText.textContent = originalText;
        }
    }

    async loadFromGoogleSheets() {
        const maxRetries = 5;
        const timeoutMs = 15000; // Reduced to 15 seconds timeout
        
        // Multiple proxy options for better reliability
        const proxyOptions = [
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://api.codetabs.com/v1/proxy?quest=',
            'https://thingproxy.freeboard.io/fetch/'
        ];
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Fetching from Google Sheets (attempt ${attempt}/${maxRetries})`);
                
                // Try different URL formats
                const urlVariations = [
                    this.excelUrl + `&t=${Date.now()}`,
                    this.excelUrl.replace('/export?format=xlsx', '/export?format=xlsx&gid=0'),
                    this.excelUrl.replace('/export?format=xlsx', '/export?format=csv'),
                    this.excelUrl.replace('/export?format=xlsx', '/export?format=ods')
                ];
                
                let response = null;
                let lastError = null;
                
                // Try each URL variation
                for (let urlIndex = 0; urlIndex < urlVariations.length; urlIndex++) {
                    const testUrl = urlVariations[urlIndex];
                    console.log(`Trying URL variation ${urlIndex + 1}:`, testUrl);
                    
                    try {
                        // Create timeout promise
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Request timeout (15s)')), timeoutMs);
                        });
                        
                        // Try direct fetch first
                        try {
                            const fetchPromise = fetch(testUrl, {
                                method: 'GET',
                                mode: 'cors',
                                cache: 'no-cache',
                                headers: {
                                    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,*/*',
                                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                                    'Pragma': 'no-cache',
                                    'Expires': '0'
                                }
                            });
                            
                            response = await Promise.race([fetchPromise, timeoutPromise]);
                            console.log(`Direct fetch response status for variation ${urlIndex + 1}:`, response.status);
                            
                            if (response.ok) {
                                console.log(`Success with URL variation ${urlIndex + 1}`);
                                break; // Success, exit the URL variation loop
                            } else if (response.status === 408) {
                                console.log(`408 timeout with variation ${urlIndex + 1}, trying next...`);
                                continue;
                            }
                            
                        } catch (corsError) {
                            console.log(`Direct fetch failed for variation ${urlIndex + 1}, trying proxies...`, corsError);
                            
                            // Try each proxy
                            for (let proxyIndex = 0; proxyIndex < proxyOptions.length; proxyIndex++) {
                                const proxyUrl = proxyOptions[proxyIndex] + encodeURIComponent(testUrl);
                                console.log(`Trying proxy ${proxyIndex + 1}:`, proxyUrl);
                                
                                try {
                                    const proxyPromise = fetch(proxyUrl, {
                                        method: 'GET',
                                        mode: 'cors',
                                        cache: 'no-cache'
                                    });
                                    
                                    response = await Promise.race([proxyPromise, timeoutPromise]);
                                    console.log(`Proxy ${proxyIndex + 1} response status:`, response.status);
                                    
                                    if (response.ok) {
                                        console.log(`Success with proxy ${proxyIndex + 1}`);
                                        break; // Success, exit the proxy loop
                                    } else if (response.status === 408) {
                                        console.log(`408 timeout with proxy ${proxyIndex + 1}, trying next...`);
                                        continue;
                                    }
                                    
                                } catch (proxyError) {
                                    console.log(`Proxy ${proxyIndex + 1} failed:`, proxyError.message);
                                    lastError = proxyError;
                                    continue;
                                }
                            }
                        }
                        
                        if (response && response.ok) {
                            break; // Success, exit the URL variation loop
                        }
                        
                    } catch (urlError) {
                        console.log(`URL variation ${urlIndex + 1} failed:`, urlError.message);
                        lastError = urlError;
                        continue;
                    }
                }
                
                if (!response || !response.ok) {
                    throw new Error(`All URL variations and proxies failed. Last error: ${lastError ? lastError.message : 'Unknown error'}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                console.log('ArrayBuffer size:', arrayBuffer.byteLength);
                
                if (arrayBuffer.byteLength === 0) {
                    throw new Error('Downloaded file is empty');
                }
                
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                console.log('Workbook loaded, sheets:', workbook.SheetNames);
                
                if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                    throw new Error('No worksheets found in the file');
                }
                
                this.processWorkbook(workbook);
                console.log(`Successfully loaded data on attempt ${attempt}`);
                return; // Success, exit the retry loop
                
            } catch (error) {
                console.error(`Error loading Excel file (attempt ${attempt}/${maxRetries}):`, error);
                
                if (attempt === maxRetries) {
                    // Final attempt failed
                    console.log('All attempts failed, falling back to sample data...');
                    
                    const errorMsg = `Failed to load data from Google Sheets after ${maxRetries} attempts.\n\nLast error: ${error.message}\n\nThis might be due to:\n- Google Sheets sharing permissions\n- Network connectivity issues\n- CORS restrictions\n\nUsing sample data instead. You can try:\n1. Making sure the Google Sheet is publicly viewable\n2. Checking your internet connection\n3. Refreshing the page`;
                    alert(errorMsg);
                    
                    this.loadSampleData();
                    return;
                } else {
                    // Wait before retrying with exponential backoff
                    const waitTime = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s
                    console.log(`Waiting ${waitTime}ms before retry attempt ${attempt + 1}...`);
                    await this.delay(waitTime);
                }
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    toggleFavorite() {
        if (this.words.length === 0) return;
        
        const currentWord = this.words[this.currentIndex];
        const wordId = currentWord.id;
        
        if (this.favoriteWords.has(wordId)) {
            // Remove from favorites
            this.favoriteWords.delete(wordId);
            console.log(`Removed "${currentWord.japanese}" from favorites`);
        } else {
            // Add to favorites
            this.favoriteWords.add(wordId);
            console.log(`Added "${currentWord.japanese}" to favorites`);
        }
        
        // Update button appearance
        this.updateFavoriteButton();
        
        // Save to database
        this.saveStudyData();
    }

    updateFavoriteButton() {
        if (this.words.length === 0) return;
        
        const currentWord = this.words[this.currentIndex];
        const favoriteBtn = document.getElementById('favorite-btn');
        
        if (this.favoriteWords.has(currentWord.id)) {
            favoriteBtn.textContent = '♥';
            favoriteBtn.classList.add('favorited');
            favoriteBtn.title = 'Remove from favorites';
        } else {
            favoriteBtn.textContent = '♡';
            favoriteBtn.classList.remove('favorited');
            favoriteBtn.title = 'Add to favorites';
        }
    }

    toggleFavoritesMode() {
        this.isFavoritesMode = !this.isFavoritesMode;
        
        if (this.isFavoritesMode) {
            // Switch to favorites only
            const favoriteWordsList = this.originalWords.filter(word => this.favoriteWords.has(word.id));
            if (favoriteWordsList.length === 0) {
                alert('No favorite words found! Add some words to favorites first.');
                this.isFavoritesMode = false;
                return;
            }
            
            this.words = [...favoriteWordsList];
            console.log(`Switched to favorites mode: ${this.words.length} favorite words`);
        } else {
            // Switch back to all words
            this.applyWordOrder();
            console.log('Switched back to all words mode');
        }
        
        // Reset to first card
        this.currentIndex = 0;
        this.isFlipped = false;
        this.showCurrentCard();
        this.updateProgress();
        
        // Update menu button text
        const reviewFavoritesBtn = document.getElementById('review-favorites-btn');
        reviewFavoritesBtn.textContent = this.isFavoritesMode ? 'Show All Words' : 'Review Favorites';
    }

    loadSampleData() {
        this.words = [
            { id: 0, japanese: 'こんにちは', meaning: 'Hello', furigana: this.generateFurigana('こんにちは'), wrongCount: 0, lastStudied: null, nextReview: Date.now() },
            { id: 1, japanese: 'ありがとう', meaning: 'Thank you', furigana: this.generateFurigana('ありがとう'), wrongCount: 0, lastStudied: null, nextReview: Date.now() },
            { id: 2, japanese: 'すみません', meaning: 'Excuse me / Sorry', furigana: this.generateFurigana('すみません'), wrongCount: 0, lastStudied: null, nextReview: Date.now() },
            { id: 3, japanese: 'はい', meaning: 'Yes', furigana: this.generateFurigana('はい'), wrongCount: 0, lastStudied: null, nextReview: Date.now() },
            { id: 4, japanese: 'いいえ', meaning: 'No', furigana: this.generateFurigana('いいえ'), wrongCount: 0, lastStudied: null, nextReview: Date.now() }
        ];
        
        // Store original order
        this.originalWords = [...this.words];
        
        console.log(`Loaded ${this.words.length} sample words`);
        this.updateProgress();
        alert('Using sample data. Check console for Google Sheets loading errors.');
    }

    applyWordOrder() {
        if (this.wordOrder === 'shuffle') {
            // Shuffle the words array
            const shuffled = [...this.originalWords];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            this.words = shuffled;
        } else {
            // Use original order
            this.words = [...this.originalWords];
        }
        
        // Reset to first card
        this.currentIndex = 0;
        this.isFlipped = false;
        this.showCurrentCard();
        this.updateProgress();
        
        console.log(`Applied ${this.wordOrder} word order`);
    }

    processWorkbook(workbook) {
        // Get the first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log('Raw Excel data (first 10 rows):', jsonData.slice(0, 10));
        console.log('Number of rows:', jsonData.length);
        
        // Debug column D specifically
        console.log('Column D (Furigana) data from first 10 rows:');
        jsonData.slice(0, 10).forEach((row, index) => {
            console.log(`Row ${index + 1}: Column D = "${row[3]}" (type: ${typeof row[3]})`);
        });
        
        // Process the data - Column B: Japanese, Column C: Meaning, Column D: Furigana
        // Column G: Understood Count, Column H: NG Count, Column I: Total Points
        const validRows = jsonData.filter(row => {
            // More flexible filtering - check if we have at least Japanese and Meaning
            const hasJapanese = row[1] && row[1].toString().trim() !== '';
            const hasMeaning = row[2] && row[2].toString().trim() !== '';
            return row.length >= 3 && hasJapanese && hasMeaning;
        });
        
        console.log(`Found ${validRows.length} valid rows out of ${jsonData.length} total rows`);
        
        this.words = validRows.map((row, index) => {
            const japanese = (row[1] || '').toString().trim();
            const meaning = (row[2] || '').toString().trim();
            let furigana = (row[3] || '').toString().trim();
            
            // Use furigana from column D, or generate if empty
            if (!furigana || furigana === 'Loading...' || furigana === '#N/A' || furigana.trim() === '') {
                furigana = this.generateFurigana(japanese);
                console.log(`Generated furigana for "${japanese}": "${furigana}"`);
            } else {
                console.log(`Using furigana from column D for "${japanese}": "${furigana}"`);
            }
            
            const word = {
                id: index,
                japanese: japanese, // Column B (index 1) - Japanese
                meaning: meaning,  // Column C (index 2) - Meaning
                furigana: furigana, // Column D (index 3) - Furigana (or generated)
                wrongCount: parseInt(row[4]) || 0, // Column E (index 4)
                lastStudied: row[5] ? new Date(row[5]).getTime() : null, // Column F (index 5)
                nextReview: Date.now(),
                understoodCount: parseInt(row[6]) || 0, // Column G (index 6)
                ngCount: parseInt(row[7]) || 0, // Column H (index 7)
                totalPoints: parseInt(row[8]) || 0 // Column I (index 8)
            };
            
            // Log first few words for debugging
            if (index < 5) {
                console.log(`Word ${index + 1}:`, word);
            }
            
            return word;
        });

        // Store original order
        this.originalWords = [...this.words];

        console.log('Processed words count:', this.words.length);
        console.log('Sample processed words (first 3):', this.words.slice(0, 3));

        if (this.words.length === 0) {
            console.log('No valid data found, falling back to sample data');
            this.loadSampleData();
            return;
        }

        console.log(`Successfully loaded ${this.words.length} words from Excel file`);
        this.updateProgress();
    }

    generateFurigana(japanese) {
        // Simple furigana generation based on common patterns
        // This is a basic implementation - for production, you'd want a more sophisticated approach
        
        if (!japanese || japanese.trim() === '') {
            return '';
        }
        
        // Remove any existing furigana in parentheses
        let cleanJapanese = japanese.replace(/[（(].*?[）)]/g, '').trim();
        
        // Basic katakana to hiragana conversion for common patterns
        const katakanaToHiragana = {
            'ア': 'あ', 'イ': 'い', 'ウ': 'う', 'エ': 'え', 'オ': 'お',
            'カ': 'か', 'キ': 'き', 'ク': 'く', 'ケ': 'け', 'コ': 'こ',
            'サ': 'さ', 'シ': 'し', 'ス': 'す', 'セ': 'せ', 'ソ': 'そ',
            'タ': 'た', 'チ': 'ち', 'ツ': 'つ', 'テ': 'て', 'ト': 'と',
            'ナ': 'な', 'ニ': 'に', 'ヌ': 'ぬ', 'ネ': 'ね', 'ノ': 'の',
            'ハ': 'は', 'ヒ': 'ひ', 'フ': 'ふ', 'ヘ': 'へ', 'ホ': 'ほ',
            'マ': 'ま', 'ミ': 'み', 'ム': 'む', 'メ': 'め', 'モ': 'も',
            'ヤ': 'や', 'ユ': 'ゆ', 'ヨ': 'よ',
            'ラ': 'ら', 'リ': 'り', 'ル': 'る', 'レ': 'れ', 'ロ': 'ろ',
            'ワ': 'わ', 'ヲ': 'を', 'ン': 'ん'
        };
        
        // Convert katakana to hiragana
        let furigana = '';
        for (let char of cleanJapanese) {
            if (katakanaToHiragana[char]) {
                furigana += katakanaToHiragana[char];
            } else if (char.match(/[ひらがな]/)) {
                // Already hiragana
                furigana += char;
            } else if (char.match(/[カタカナ]/)) {
                // Convert remaining katakana
                furigana += char;
            } else {
                // Keep other characters (kanji, etc.)
                furigana += char;
            }
        }
        
        // If we couldn't generate meaningful furigana, return a placeholder
        if (furigana === cleanJapanese || furigana.length === 0) {
            return '[読み方]'; // Placeholder for reading
        }
        
        return furigana;
    }

    async generateFuriganaWithAPI(japanese) {
        // Try to get furigana from a Japanese reading API
        try {
            // Using a free Japanese reading API
            const response = await fetch(`https://jlp.yahooapis.jp/FuriganaService/V1/furigana?appid=dj00aiZpPUNJd0V6V2J3VzVZSSZzPWNvbnN1bWVyc2VjcmV0Jng9YzE-&sentence=${encodeURIComponent(japanese)}`);
            const data = await response.json();
            
            if (data && data.result && data.result[0] && data.result[0].furigana) {
                return data.result[0].furigana;
            }
        } catch (error) {
            console.log('API furigana generation failed:', error);
        }
        
        // Fallback to basic generation
        return this.generateFurigana(japanese);
    }

    async generateAllFurigana() {
        console.log('Generating furigana for all words...');
        
        // Show loading indicator
        const progressText = document.getElementById('progress-text');
        const originalText = progressText.textContent;
        progressText.textContent = 'Generating furigana...';
        
        try {
            let generatedCount = 0;
            
            for (let i = 0; i < this.words.length; i++) {
                const word = this.words[i];
                
                // Always regenerate furigana for all words
                const newFurigana = this.generateFurigana(word.japanese);
                if (newFurigana && newFurigana !== '[読み方]') {
                    word.furigana = newFurigana;
                    generatedCount++;
                    console.log(`Generated furigana for "${word.japanese}": "${newFurigana}"`);
                }
                
                // Update progress
                if (i % 10 === 0) {
                    progressText.textContent = `Generating furigana... ${i + 1}/${this.words.length}`;
                }
            }
            
            // Update original words array as well
            this.originalWords.forEach((word, index) => {
                if (this.words[index]) {
                    word.furigana = this.words[index].furigana;
                }
            });
            
            // Save to database
            await this.saveStudyData();
            
            // Update display
            this.showCurrentCard();
            this.updateProgress();
            
            console.log(`Generated furigana for ${generatedCount} words`);
            alert(`Generated furigana for ${generatedCount} words!`);
            
        } catch (error) {
            console.error('Error generating furigana:', error);
            alert('Error generating furigana. Check console for details.');
        } finally {
            // Restore progress text
            progressText.textContent = originalText;
        }
    }

    async loadStudyDataFromFirebase() {
        if (!this.db) return;

        try {
            const userDoc = await this.db.collection('users').doc(this.userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                this.studyData = userData.studyData || {};
                
                // Load favorite words
                if (this.studyData.favoriteWords) {
                    this.favoriteWords = new Set(this.studyData.favoriteWords);
                }
                
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
                // Initialize point tracking for new users
                this.words.forEach(word => {
                    word.understoodCount = 0;
                    word.ngCount = 0;
                    word.totalPoints = 0;
                });
            }
        } catch (error) {
            console.error('Error loading data from Firebase:', error);
            // Fallback to localStorage
            this.loadStudyDataFromLocalStorage();
        }
    }

    loadStudyDataFromLocalStorage() {
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

    restoreSessionState() {
        const sessionState = localStorage.getItem('flashcardSessionState');
        if (sessionState) {
            const state = JSON.parse(sessionState);
            this.currentIndex = state.currentIndex || 0;
            this.isFlipped = state.isFlipped || false;
            
            // Check if session is recent (within 24 hours)
            const hoursSinceLastSession = (Date.now() - state.lastSessionTime) / (1000 * 60 * 60);
            if (hoursSinceLastSession < 24) {
                console.log(`Resuming from previous session (${Math.round(hoursSinceLastSession * 10) / 10} hours ago)`);
            } else {
                console.log('Previous session was over 24 hours ago, starting fresh');
                this.currentIndex = 0;
                this.isFlipped = false;
            }
        }
    }

    async saveStudyData() {
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
        
        // Save favorite words separately
        this.studyData.favoriteWords = Array.from(this.favoriteWords);
        
        // Save to Firebase
        if (this.db) {
            try {
                await this.db.collection('users').doc(this.userId).set({
                    studyData: this.studyData,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log('Study progress saved to Firebase');
            } catch (error) {
                console.error('Error saving to Firebase:', error);
                // Fallback to localStorage
                this.saveToLocalStorage();
            }
        } else {
            // Save to localStorage if Firebase not available
            this.saveToLocalStorage();
        }
        
        // Save current session state
        const sessionState = {
            currentIndex: this.currentIndex,
            isFlipped: this.isFlipped,
            lastSessionTime: Date.now()
        };
        localStorage.setItem('flashcardSessionState', JSON.stringify(sessionState));
    }

    saveToLocalStorage() {
        localStorage.setItem('flashcardStudyData', JSON.stringify(this.studyData));
        console.log('Study progress saved locally');
    }

    async updateGoogleSheets() {
        try {
            // Create a new workbook with the updated data
            const wb = XLSX.utils.book_new();
            
            // Prepare data for Excel - include study tracking columns
            // Column A: Empty, Column B: Japanese, Column C: Meaning, Column D: Furigana
            // Column E: Wrong Count, Column F: Last Studied, Column G: Understood Count, Column H: NG Count, Column I: Total Points
            const excelData = this.words.map(word => [
                '', // Column A (empty)
                word.japanese, // Column B - Japanese
                word.meaning,  // Column C - Meaning
                word.furigana, // Column D - Furigana
                word.wrongCount, // Column E
                word.lastStudied ? new Date(word.lastStudied).toISOString() : '', // Column F
                word.understoodCount || 0, // Column G
                word.ngCount || 0, // Column H
                word.totalPoints || 0 // Column I
            ]);
            
            // Add headers
            excelData.unshift(['', 'Japanese', 'Meaning', 'Furigana', 'Wrong Count', 'Last Studied', 'Understood Count', 'NG Count', 'Total Points']);
            
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
        
        this.isFlipped = !this.isFlipped;
        flashcard.classList.toggle('flipped', this.isFlipped);
    }

    showCurrentCard() {
        if (this.words.length === 0) return;

        const currentWord = this.words[this.currentIndex];
        
        // Reset flip state
        this.isFlipped = false;
        document.getElementById('flashcard').classList.remove('flipped');
        
        // Show content based on front mode
        if (this.frontMode === 'japanese') {
            // Show Japanese on front, explanation on back
            document.getElementById('japanese-word').textContent = currentWord.japanese;
            document.getElementById('meaning').textContent = currentWord.meaning;
            document.getElementById('furigana').textContent = currentWord.furigana;
        } else {
            // Show explanation on front, Japanese on back
            document.getElementById('japanese-word').textContent = currentWord.meaning + (currentWord.furigana ? ` (${currentWord.furigana})` : '');
            document.getElementById('meaning').textContent = currentWord.japanese;
            document.getElementById('furigana').textContent = '';
        }
        
        this.updateProgress();
        this.updateFavoriteButton();
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
        this.updatePerformanceChart();
        this.nextCard();
    }

    nextCard() {
        // Implement spaced repetition algorithm with favorite prioritization
        const now = Date.now();
        const availableWords = this.words.filter(word => word.nextReview <= now);
        
        if (availableWords.length > 0) {
            // Separate favorite and non-favorite words
            const favoriteWords = availableWords.filter(word => this.favoriteWords.has(word.id));
            const nonFavoriteWords = availableWords.filter(word => !this.favoriteWords.has(word.id));
            
            // Prioritize favorite words, then sort by difficulty
            const prioritizedWords = [...favoriteWords, ...nonFavoriteWords];
            
            // Sort by total points (lower points = more difficult = higher priority)
            prioritizedWords.sort((a, b) => {
                if (a.totalPoints !== b.totalPoints) {
                    return a.totalPoints - b.totalPoints; // Lower points first
                }
                return a.nextReview - b.nextReview; // Earlier review time first
            });
            
            // Find the index of the selected word in the current words array
            const selectedWord = prioritizedWords[0];
            const foundIndex = this.words.findIndex(word => word.id === selectedWord.id);
            
            if (foundIndex !== -1) {
                this.currentIndex = foundIndex;
            } else {
                // Fallback: pick a random word if the selected word is not found
                this.currentIndex = Math.floor(Math.random() * this.words.length);
            }
        } else {
            // If no words are due for review, prioritize favorites
            const favoriteWords = this.words.filter(word => this.favoriteWords.has(word.id));
            if (favoriteWords.length > 0) {
                // Pick a random favorite word
                const randomFavorite = favoriteWords[Math.floor(Math.random() * favoriteWords.length)];
                this.currentIndex = this.words.findIndex(word => word.id === randomFavorite.id);
            } else {
                // Pick a random word
                this.currentIndex = Math.floor(Math.random() * this.words.length);
            }
        }
        
        console.log(`Next card: index ${this.currentIndex}, word: ${this.words[this.currentIndex]?.japanese}, favorite: ${this.favoriteWords.has(this.words[this.currentIndex]?.id)}`);
        this.showCurrentCard();
    }

    updateProgress() {
        const totalWords = this.words.length;
        const studiedWords = this.words.filter(word => word.lastStudied).length;
        
        document.getElementById('progress-text').textContent = `${studiedWords} / ${totalWords}`;
        document.getElementById('progress-fill').style.width = `${(studiedWords / totalWords) * 100}%`;
    }

    initializePerformanceChart() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        this.performanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Total Answered',
                    data: [],
                    backgroundColor: 'rgba(33, 150, 243, 0.8)',
                    borderColor: 'rgba(33, 150, 243, 1)',
                    borderWidth: 0,
                    order: 2
                }, {
                    label: 'Understood',
                    data: [],
                    backgroundColor: 'rgba(76, 175, 80, 0.8)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 0,
                    order: 1
                }, {
                    label: 'Success Rate %',
                    data: [],
                    type: 'line',
                    backgroundColor: 'rgba(255, 193, 7, 0.8)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1',
                    order: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.6)',
                            font: {
                                size: 10
                            }
                        },
                        border: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.2)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.6)',
                            font: {
                                size: 10
                            }
                        },
                        border: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.2)'
                        }
                    },
                    x: {
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.6)',
                            font: {
                                size: 10
                            }
                        },
                        border: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.2)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 6,
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                if (label === 'Success Rate %') {
                                    return `${label}: ${value}%`;
                                }
                                return `${label}: ${value}`;
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        
        this.updatePerformanceChart();
    }

    getPerformanceData(period) {
        const now = new Date();
        const data = [];
        let days = 7;
        
        switch(period) {
            case 'week':
                days = 7;
                break;
            case 'month':
                days = 30;
                break;
            case '3months':
                days = 90;
                break;
        }
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayData = this.getDayPerformance(dateStr);
            data.push({
                date: dateStr,
                label: this.formatDateLabel(date, period),
                understood: dayData.understood,
                total: dayData.total,
                percentage: dayData.total > 0 ? Math.round((dayData.understood / dayData.total) * 100) : 0
            });
        }
        
        return data;
    }

    getDayPerformance(dateStr) {
        let understood = 0;
        let total = 0;
        
        this.words.forEach(word => {
            if (word.lastStudied) {
                const studyDate = new Date(word.lastStudied).toISOString().split('T')[0];
                if (studyDate === dateStr) {
                    total++;
                    if (word.understoodCount > 0) {
                        understood++;
                    }
                }
            }
        });
        
        return { understood, total };
    }

    formatDateLabel(date, period) {
        if (period === 'week') {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else if (period === 'month') {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    updatePerformanceChart() {
        const data = this.getPerformanceData(this.currentPeriod);
        
        this.performanceChart.data.labels = data.map(d => d.label);
        this.performanceChart.data.datasets[0].data = data.map(d => d.total); // Total Answered
        this.performanceChart.data.datasets[1].data = data.map(d => d.understood); // Understood
        this.performanceChart.data.datasets[2].data = data.map(d => d.percentage); // Success Rate
        
        this.performanceChart.update();
    }

    showDataDebug() {
        console.log('=== FLASHCARD DATA DEBUG ===');
        console.log('Current Words:', this.words);
        console.log('Study Data:', this.studyData);
        console.log('Current Index:', this.currentIndex);
        console.log('Session State:', {
            currentIndex: this.currentIndex,
            isFlipped: this.isFlipped,
            lastSessionTime: this.lastSessionTime
        });
        
        // Show performance summary
        const totalWords = this.words.length;
        const studiedWords = this.words.filter(w => w.understoodCount > 0 || w.ngCount > 0).length;
        const totalUnderstood = this.words.reduce((sum, w) => sum + (w.understoodCount || 0), 0);
        const totalNG = this.words.reduce((sum, w) => sum + (w.ngCount || 0), 0);
        const totalPoints = this.words.reduce((sum, w) => sum + (w.totalPoints || 0), 0);
        
        console.log('=== PERFORMANCE SUMMARY ===');
        console.log(`Total Words: ${totalWords}`);
        console.log(`Studied Words: ${studiedWords}`);
        console.log(`Total Understood: ${totalUnderstood}`);
        console.log(`Total NG: ${totalNG}`);
        console.log(`Total Points: ${totalPoints}`);
        console.log(`Success Rate: ${totalUnderstood + totalNG > 0 ? Math.round((totalUnderstood / (totalUnderstood + totalNG)) * 100) : 0}%`);
        
        // Show word scores
        console.log('=== WORD SCORES ===');
        this.words.forEach((word, index) => {
            if (word.understoodCount > 0 || word.ngCount > 0) {
                console.log(`${index + 1}. ${word.japanese} (${word.meaning})`);
                console.log(`   Understood: ${word.understoodCount}, NG: ${word.ngCount}, Points: ${word.totalPoints}`);
            }
        });
        
        alert(`Data logged to console! Check Developer Tools (F12) > Console tab.\n\nQuick Summary:\n- Total Words: ${totalWords}\n- Studied: ${studiedWords}\n- Understood: ${totalUnderstood}\n- NG: ${totalNG}\n- Points: ${totalPoints}`);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FlashcardApp();
});
