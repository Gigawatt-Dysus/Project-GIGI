import { isFirebaseConfigured } from '../firebaseConfig';
import { initializeAuth } from './authService';

import * as localDb from './localDbService';
import * as firebaseDb from './firebaseDbService';

// Define a consistent interface for our data services
interface AppDataService {
    getUserProfile: (userId: string) => Promise<any | null>;
    getAllUserProfiles: () => Promise<any[]>;
    updateUserProfile: (userId: string, data: any) => Promise<void>;
    getChatHistory: (userId: string) => Promise<any[]>;
    saveChatHistory: (userId: string, history: any[]) => Promise<void>;
    getGigiJournal: (userId: string) => Promise<any[]>;
    saveGigiJournalEntry: (userId: string, entry: any) => Promise<void>;
    deleteGigiJournalEntry: (userId: string, entryId: string) => Promise<void>;
    saveEvent: (userId: string, event: any) => Promise<void>;
    deleteEvent: (userId: string, eventId: string) => Promise<void>;
    saveTag: (userId: string, tag: any) => Promise<void>;
    deleteTag: (userId: string, tagId: string) => Promise<void>;
    saveMedia: (userId: string, media: any) => Promise<void>;
    getAllEvents: (userId: string) => Promise<any[]>;
    getAllTags: (userId: string) => Promise<any[]>;
    getAllMedia: (userId: string) => Promise<any[]>;
    importLegacyData: (userId: string, data: any) => Promise<void>;
    resetAndSeedDatabase: (userId: string) => Promise<void>;
    exportAllData: (userId: string) => Promise<object>;
    importBackupData: (data: any) => Promise<void>;
}

let appDataService: AppDataService;

const firebaseIsConfigured = isFirebaseConfigured();

if (firebaseIsConfigured) {
    console.log("[Service Manager] Firebase configured. Using Firestore services.");
    initializeAuth();
    firebaseDb.initializeFirestore();
    appDataService = firebaseDb;
} else {
    console.log("[Service Manager] Firebase not configured. Using local IndexedDB services.");
    appDataService = localDb;
}

const initializeServices = (): boolean => {
    return firebaseIsConfigured;
};

export { appDataService, initializeServices };