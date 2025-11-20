import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc, Timestamp, Firestore } from 'firebase/firestore';
import type { User, LifeEvent, Tag, Media, ChatMessage, GigiJournalEntry } from '../types';
import { mockEvents, mockMedia, mockTags } from './mockData';
import { sanitizeAllEvents, sanitizeAllMedia, sanitizeAllTags } from './dataValidator';

let db: Firestore;

export const initializeFirestore = () => {
    db = getFirestore();
};

const USERS_COLLECTION = 'users';
const EVENTS_COLLECTION = 'events';
const TAGS_COLLECTION = 'tags';
const MEDIA_COLLECTION = 'media';
const CHAT_HISTORY_COLLECTION = 'chatHistory';

// Helper to convert Firestore Timestamps to JS Dates in nested objects
const convertTimestampsToDates = (obj: any): any => {
    for (const key in obj) {
        if (obj[key] instanceof Timestamp) {
            obj[key] = obj[key].toDate();
        } else if (obj[key] && typeof obj[key] === 'object') {
            convertTimestampsToDates(obj[key]);
        }
    }
    return obj;
};

// User Profile
export const getUserProfile = async (userId: string): Promise<User | null> => {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return convertTimestampsToDates(docSnap.data() as User);
    }
    return null;
};
export const getAllUserProfiles = async (): Promise<User[]> => {
    // In Firestore mode, we only care about the logged-in user, but this is here for compatibility.
    return [];
};
export const updateUserProfile = async (userId: string, data: User): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(docRef, { ...data, id: userId });
};

// Chat History
export const getChatHistory = async (userId: string): Promise<ChatMessage[]> => {
    const docRef = doc(db, USERS_COLLECTION, userId, CHAT_HISTORY_COLLECTION, 'history');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.history)) {
             return data.history.map(convertTimestampsToDates);
        }
    }
    return [];
};
export const saveChatHistory = async (userId: string, history: ChatMessage[]): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, userId, CHAT_HISTORY_COLLECTION, 'history');
    await setDoc(docRef, { history });
};

// Gigi Journal - Not yet implemented for Firestore
export const getGigiJournal = async (userId: string): Promise<GigiJournalEntry[]> => {
    console.warn("Gigi Journal is not yet implemented for Firestore mode.");
    return [];
};
export const saveGigiJournalEntry = async (userId: string, entry: GigiJournalEntry): Promise<void> => {
    console.warn("Gigi Journal is not yet implemented for Firestore mode.");
};
export const deleteGigiJournalEntry = async (userId: string, entryId: string): Promise<void> => {
    console.warn("Gigi Journal is not yet implemented for Firestore mode.");
};

// App Data
const getSubcollectionRef = (userId: string, subcollection: string) => collection(db, USERS_COLLECTION, userId, subcollection);

export const saveEvent = async (userId: string, event: LifeEvent): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, EVENTS_COLLECTION), event.id);
    await setDoc(docRef, event);
};
export const deleteEvent = async (userId: string, eventId: string): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, EVENTS_COLLECTION), eventId);
    await deleteDoc(docRef);
};
export const saveTag = async (userId: string, tag: Tag): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, TAGS_COLLECTION), tag.id);
    await setDoc(docRef, tag);
};
export const deleteTag = async (userId: string, tagId: string): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, TAGS_COLLECTION), tagId);
    await deleteDoc(docRef);
};
export const saveMedia = async (userId: string, media: Media): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, MEDIA_COLLECTION), media.id);
    await setDoc(docRef, media);
};

export const getAllEvents = async (userId: string): Promise<LifeEvent[]> => {
    const querySnapshot = await getDocs(getSubcollectionRef(userId, EVENTS_COLLECTION));
    const events = querySnapshot.docs.map(doc => convertTimestampsToDates(doc.data() as LifeEvent));
    return sanitizeAllEvents(events);
};
export const getAllTags = async (userId: string): Promise<Tag[]> => {
    const querySnapshot = await getDocs(getSubcollectionRef(userId, TAGS_COLLECTION));
    const tags = querySnapshot.docs.map(doc => doc.data() as Tag);
    return sanitizeAllTags(tags);
};
export const getAllMedia = async (userId: string): Promise<Media[]> => {
    const querySnapshot = await getDocs(getSubcollectionRef(userId, MEDIA_COLLECTION));
    const media = querySnapshot.docs.map(doc => convertTimestampsToDates(doc.data() as Media));
    return sanitizeAllMedia(media);
};


// Data Management
export const importLegacyData = async (userId: string, data: { events: LifeEvent[], tags: Tag[], media: Media[] }): Promise<void> => {
    const batch = writeBatch(db);
    // Clear existing data for this user
    const existingEvents = await getDocs(getSubcollectionRef(userId, EVENTS_COLLECTION));
    existingEvents.forEach(doc => batch.delete(doc.ref));
    const existingTags = await getDocs(getSubcollectionRef(userId, TAGS_COLLECTION));
    existingTags.forEach(doc => batch.delete(doc.ref));
    const existingMedia = await getDocs(getSubcollectionRef(userId, MEDIA_COLLECTION));
    existingMedia.forEach(doc => batch.delete(doc.ref));
    
    // Write new data
    data.events.forEach(event => batch.set(doc(getSubcollectionRef(userId, EVENTS_COLLECTION), event.id), event));
    data.tags.forEach(tag => batch.set(doc(getSubcollectionRef(userId, TAGS_COLLECTION), tag.id), tag));
    data.media.forEach(mediaItem => batch.set(doc(getSubcollectionRef(userId, MEDIA_COLLECTION), mediaItem.id), mediaItem));

    await batch.commit();
};

export const resetAndSeedDatabase = async (userId: string): Promise<void> => {
    const batch = writeBatch(db);
    const collectionsToClear = [EVENTS_COLLECTION, TAGS_COLLECTION, MEDIA_COLLECTION];
    for (const coll of collectionsToClear) {
        const snapshot = await getDocs(getSubcollectionRef(userId, coll));
        snapshot.forEach(doc => batch.delete(doc.ref));
    }
    
    // Seed with mock data
    mockEvents.forEach(event => batch.set(doc(getSubcollectionRef(userId, EVENTS_COLLECTION), event.id), event));
    mockTags.forEach(tag => batch.set(doc(getSubcollectionRef(userId, TAGS_COLLECTION), tag.id), tag));
    mockMedia.forEach(mediaItem => batch.set(doc(getSubcollectionRef(userId, MEDIA_COLLECTION), mediaItem.id), mediaItem));

    await batch.commit();
};

export const exportAllData = async (userId: string): Promise<object> => {
    const [user, events, tags, media, chatHistory, gigiJournal] = await Promise.all([
        getUserProfile(userId),
        getAllEvents(userId),
        getAllTags(userId),
        getAllMedia(userId),
        getChatHistory(userId),
        getGigiJournal(userId)
    ]);
    return { users: [user], events, tags, media, chatHistory: [{userId, history: chatHistory}], gigiJournal };
};

export const importBackupData = async (data: any): Promise<void> => {
    // Full backup import replaces ALL data, including users.
    // This is a destructive operation intended for development/testing.
    if (!data || typeof data !== 'object' || !Array.isArray(data.users)) {
        throw new Error("Invalid backup file format.");
    }

    const batch = writeBatch(db);

    // This is a very basic import; a real app might need more complex logic
    // to handle existing users. For now, we assume a clean slate.
    for (const user of data.users) {
        const userRef = doc(db, USERS_COLLECTION, user.id);
        batch.set(userRef, user);
    }
    // Note: This simplified backup/restore doesn't handle subcollections.
    // A production-ready version would need a more robust strategy.
    console.warn("Firestore backup import is simplified and does not restore subcollections (events, tags, etc). Only user profiles are restored in this version.");
    await batch.commit();
};