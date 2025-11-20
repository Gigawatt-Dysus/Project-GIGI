import type { User, LifeEvent, Tag, Media, ChatMessage, GigiJournalEntry } from '../types';
import { dbGet, dbPut, dbGetAll, dbClearStore, dbDelete, closeDB } from './dbService';
import { mockEvents, mockMedia, mockTags } from './mockData';
import { sanitizeAllEvents, sanitizeAllMedia, sanitizeAllTags } from './dataValidator';

const USER_STORE_NAME = 'users';
const EVENTS_STORE_NAME = 'events';
const TAGS_STORE_NAME = 'tags';
const MEDIA_STORE_NAME = 'media';
const CHAT_HISTORY_STORE_NAME = 'chatHistory';
const GIGI_JOURNAL_STORE_NAME = 'gigiJournal';

// User Profile
export const getUserProfile = async (userId: string): Promise<User | null> => {
    const user = await dbGet<User>(USER_STORE_NAME, userId);
    if (user && user.joinDate) {
      user.joinDate = new Date(user.joinDate);
    }
    return user;
};
export const getAllUserProfiles = async (): Promise<User[]> => {
    const users = await dbGetAll<User>(USER_STORE_NAME);
    return users
        .filter(u => u && typeof u === 'object')
        .map(user => user.joinDate ? { ...user, joinDate: new Date(user.joinDate) } : user)
        .filter(user => user.joinDate && !isNaN(user.joinDate.getTime()));
};
export const updateUserProfile = async (userId: string, data: User): Promise<void> => {
    await dbPut(USER_STORE_NAME, { ...data, id: userId });
};

// Chat History
export const getChatHistory = async (userId: string): Promise<ChatMessage[]> => {
    const result = await dbGet<{ userId: string; history: ChatMessage[] }>(CHAT_HISTORY_STORE_NAME, userId);
    if (result && Array.isArray(result.history)) {
        return result.history
            .filter(msg => msg && msg.timestamp)
            .map(msg => ({ ...msg, timestamp: new Date(msg.timestamp) }))
            .filter(msg => !isNaN(msg.timestamp.getTime()));
    }
    return [];
};
export const saveChatHistory = async (userId: string, history: ChatMessage[]): Promise<void> => {
    await dbPut(CHAT_HISTORY_STORE_NAME, { userId, history });
};

// Gigi Journal
export const getGigiJournal = async (userId: string): Promise<GigiJournalEntry[]> => {
    // In local mode, journal is not user-specific, but we keep the API consistent.
    const entries = await dbGetAll<GigiJournalEntry>(GIGI_JOURNAL_STORE_NAME);
    if (entries && Array.isArray(entries)) {
        return entries
            .filter(e => e && e.creationDate)
            .map(e => ({...e, creationDate: new Date(e.creationDate)}))
            .filter(e => !isNaN(e.creationDate.getTime()));
    }
    return [];
};
export const saveGigiJournalEntry = async (userId: string, entry: GigiJournalEntry): Promise<void> => {
    await dbPut(GIGI_JOURNAL_STORE_NAME, entry);
};
export const deleteGigiJournalEntry = async (userId: string, entryId: string): Promise<void> => {
    await dbDelete(GIGI_JOURNAL_STORE_NAME, entryId);
};


// App Data
export const saveEvent = async (userId: string, event: LifeEvent): Promise<void> => {
    await dbPut(EVENTS_STORE_NAME, event);
};
export const deleteEvent = async (userId: string, eventId: string): Promise<void> => {
    await dbDelete(EVENTS_STORE_NAME, eventId);
};
export const saveTag = async (userId: string, tag: Tag): Promise<void> => {
    await dbPut(TAGS_STORE_NAME, tag);
};
export const deleteTag = async (userId: string, tagId: string): Promise<void> => {
    await dbDelete(TAGS_STORE_NAME, tagId);
};
export const saveMedia = async (userId: string, media: Media): Promise<void> => {
    await dbPut(MEDIA_STORE_NAME, media);
};
export const getAllEvents = async (userId: string): Promise<LifeEvent[]> => {
    const events = await dbGetAll<LifeEvent>(EVENTS_STORE_NAME);
    return sanitizeAllEvents(events);
};
export const getAllTags = async (userId: string): Promise<Tag[]> => {
    const tags = await dbGetAll<Tag>(TAGS_STORE_NAME);
    return sanitizeAllTags(tags);
};
export const getAllMedia = async (userId: string): Promise<Media[]> => {
    const media = await dbGetAll<Media>(MEDIA_STORE_NAME);
    return sanitizeAllMedia(media);
};

// Data Management
export const initializeMockData = async (): Promise<void> => {
    const eventsPromise = Promise.all(mockEvents.map(event => dbPut(EVENTS_STORE_NAME, event)));
    const tagsPromise = Promise.all(mockTags.map(tag => dbPut(TAGS_STORE_NAME, tag)));
    const mediaPromise = Promise.all(mockMedia.map(media => dbPut(MEDIA_STORE_NAME, media)));
    await Promise.all([eventsPromise, tagsPromise, mediaPromise]);
};
export const importLegacyData = async (userId: string, data: { events: LifeEvent[], tags: Tag[], media: Media[] }): Promise<void> => {
    await dbClearStore(EVENTS_STORE_NAME);
    await dbClearStore(TAGS_STORE_NAME);
    await dbClearStore(MEDIA_STORE_NAME);
    const eventsPromise = Promise.all(data.events.map(event => dbPut(EVENTS_STORE_NAME, event)));
    const tagsPromise = Promise.all(data.tags.map(tag => dbPut(TAGS_STORE_NAME, tag)));
    const mediaPromise = Promise.all(data.media.map(media => dbPut(MEDIA_STORE_NAME, media)));
    await Promise.all([eventsPromise, tagsPromise, mediaPromise]);
    // Removed closeDB() to prevent race conditions with concurrent operations (like auto-backup)
};
export const resetAndSeedDatabase = async (userId: string): Promise<void> => {
    await dbClearStore(EVENTS_STORE_NAME);
    await dbClearStore(TAGS_STORE_NAME);
    await dbClearStore(MEDIA_STORE_NAME);
    await initializeMockData();
    // Removed closeDB() to prevent race conditions with concurrent operations (like auto-backup)
};
export const exportAllData = async (userId: string): Promise<object> => {
    const users = await dbGetAll<User>(USER_STORE_NAME);
    const events = await dbGetAll<LifeEvent>(EVENTS_STORE_NAME);
    const tags = await dbGetAll<Tag>(TAGS_STORE_NAME);
    const media = await dbGetAll<Media>(MEDIA_STORE_NAME);
    const chatHistory = await dbGetAll(CHAT_HISTORY_STORE_NAME);
    const gigiJournal = await dbGetAll<GigiJournalEntry>(GIGI_JOURNAL_STORE_NAME);
    return { users, events, tags, media, chatHistory, gigiJournal };
};
export const importBackupData = async (data: any): Promise<void> => {
    // A valid backup must be an object and contain at least the core data arrays.
    if (!data || typeof data !== 'object' || !Array.isArray(data.users) || !Array.isArray(data.events) || !Array.isArray(data.tags) || !Array.isArray(data.media)) {
        throw new Error("Invalid backup file format.");
    }

    // Handle optional data arrays gracefully for backward compatibility.
    const chatHistoryToImport = Array.isArray(data.chatHistory) ? data.chatHistory : [];
    const gigiJournalToImport = Array.isArray(data.gigiJournal) ? data.gigiJournal : [];

    await Promise.all([
        dbClearStore(USER_STORE_NAME),
        dbClearStore(EVENTS_STORE_NAME),
        dbClearStore(TAGS_STORE_NAME),
        dbClearStore(MEDIA_STORE_NAME),
        dbClearStore(CHAT_HISTORY_STORE_NAME),
        dbClearStore(GIGI_JOURNAL_STORE_NAME)
    ]);
    const usersPromise = Promise.all(data.users.map((item: User) => dbPut(USER_STORE_NAME, item)));
    const eventsPromise = Promise.all(data.events.map((item: LifeEvent) => dbPut(EVENTS_STORE_NAME, item)));
    const tagsPromise = Promise.all(data.tags.map((item: Tag) => dbPut(TAGS_STORE_NAME, item)));
    const mediaPromise = Promise.all(data.media.map((item: Media) => dbPut(MEDIA_STORE_NAME, item)));
    const chatPromise = Promise.all(chatHistoryToImport.map((item: any) => dbPut(CHAT_HISTORY_STORE_NAME, item)));
    const journalPromise = Promise.all(gigiJournalToImport.map((item: GigiJournalEntry) => dbPut(GIGI_JOURNAL_STORE_NAME, item)));
    await Promise.all([usersPromise, eventsPromise, tagsPromise, mediaPromise, chatPromise, journalPromise]);
    // Removed closeDB() to prevent race conditions with concurrent operations (like auto-backup)
};