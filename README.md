# Japanese Flashcard Web App

A simple and effective flashcard web application for studying Japanese vocabulary that connects directly to your Excel file.

## Features

- **Direct Excel Integration**: Loads data directly from your Excel file (Google Sheets or direct file URL)
- **Simple UI**: Clean interface with just two buttons - "Understood" and "NG"
- **Spaced Repetition**: Words you answer incorrectly will be shown more frequently
- **Progress Tracking**: Visual progress bar showing your study progress
- **Data Persistence**: Saves your study data back to Excel format
- **Flip Animation**: Click the card or "Show Answer" button to reveal the meaning and furigana

## How to Use

1. **Open the App**: Open `index.html` in your web browser
2. **Load Your Data**: When prompted, enter the URL of your Excel file
   - For Google Sheets: Use the share link (make sure it's set to "Anyone with the link can view")
   - For direct Excel files: Use the direct file URL
3. **Study**: 
   - Click "Show Answer" or click the card to flip it
   - Click "Understood" if you knew the answer
   - Click "NG" if you didn't know the answer
4. **Save Progress**: Click "Save Progress to Excel" to download an updated Excel file with your study data

## Excel File Format

Your Excel file should have at least 3 columns:
- **Column A**: Japanese words
- **Column B**: English meanings
- **Column C**: Furigana (pronunciation)

The app will automatically add tracking columns for:
- Wrong Count
- Last Studied
- Next Review

## Spaced Repetition Algorithm

- Words answered correctly will be shown less frequently (up to 7 days)
- Words answered incorrectly will be shown more frequently (every 5 minutes)
- The app prioritizes words with more wrong answers
- Study data is saved locally and in the exported Excel file

## Technical Details

- Built with vanilla HTML, CSS, and JavaScript
- Uses SheetJS library for Excel file processing
- Data is stored locally in browser storage
- No server required - runs entirely in the browser

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript features
- Fetch API
- Local Storage
- File downloads

## Troubleshooting

- **CORS Issues**: If you get CORS errors with Google Sheets, make sure the sheet is set to "Anyone with the link can view"
- **File Format**: Ensure your Excel file has the correct column structure
- **Network Issues**: Check your internet connection when loading the Excel file
