# Firebase Setup Instructions

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: "flashcard-app"
4. Enable Google Analytics (optional)
5. Click "Create project"

## 2. Enable Authentication

1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider
5. Click "Save"

## 3. Create Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location close to your users
5. Click "Done"

## 4. Get Firebase Configuration

1. In Firebase Console, go to "Project settings" (gear icon)
2. Scroll down to "Your apps" section
3. Click "Web" icon (</>) to add web app
4. Enter app nickname: "flashcard-webapp"
5. Click "Register app"
6. Copy the firebaseConfig object

## 5. Update Configuration in Code

Replace the placeholder configuration in `script.js`:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-actual-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-actual-sender-id",
    appId: "your-actual-app-id"
};
```

## 6. Set Firestore Security Rules

In Firebase Console, go to "Firestore Database" > "Rules" and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 7. Test the Application

1. Open your HTML file in a browser
2. Register a new account
3. Login and start studying
4. Check Firebase Console to see data being saved

## Features Included

- ✅ User registration and login
- ✅ Progress syncing across devices
- ✅ Real-time data storage
- ✅ Secure user data isolation
- ✅ Offline fallback to localStorage
- ✅ Session persistence

## Database Structure

```
users/{userId}
├── studyData: {
│   ├── wordId: {
│   │   ├── wrongCount: number
│   │   ├── lastStudied: timestamp
│   │   ├── nextReview: timestamp
│   │   ├── understoodCount: number
│   │   ├── ngCount: number
│   │   └── totalPoints: number
│   └── ...
│   }
├── lastUpdated: timestamp
└── email: string
```
