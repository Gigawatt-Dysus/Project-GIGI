import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
import AiInterviews from './components/AiInterviews';
import TimeVortex from './components/Timeline';
import TagGallery from './components/TagGallery';
import TheMatrix from './components/PhotoGallery';
import ProfileEditor from './components/ProfileEditor';
import AiCompanionsManager from './components/GigiProfileEditor';
import EventEditor from './components/EventEditor';
import TagEditor from './components/TagEditor';
import ReplaceTagModal from './components/ReplaceTagModal';
import LoginPage from './components/LoginPage';
import ToastContainer from './components/Toast';
import GigiJournalView from './components/GigiJournalView';
import CommunicationsCenter from './components/CommunicationsCenter';
import BackupImportModal from './components/BackupImportModal';
import DevPatchModal from './components/DevPatchModal';
import type { View, Theme, User, LifeEvent, Tag, Media, ChatMessage, Toast as ToastType, GigiJournalEntry, AiCompanion, Settings, Comment, UserStatus, CommsMessage, PersonTag, ImportStatus, GodModeSettings, GodModeTraits, BodyMatrixSettings } from './types';
import { 
  appDataService,
  initializeServices
} from './services/serviceManager';
import { onAuthStateChangedHandler, signOutUser, auth } from './services/authService';
import { GIGI_AVATAR_URL } from './services/mockData';
import { sanitizeTag } from './services/dataValidator';
import { generateAiConversation, generateGigiJournalEntry, generateAiCommentResponse, simulateDigestEmail, simulateCompanionSms } from './services/geminiService';
import Vortex from './components/Vortex';

// Initialize Firebase and services
const isFirebaseConfigured = initializeServices();

const DEFAULT_SETTINGS: Settings = {
  idleTimeout: 5,
  aiDaydreaming: true,
  daydreamInterval: 5,
  autoBackupInterval: 10,
  showMemoryPromptOnDashboard: false,
};

const DEFAULT_GOD_MODE_TRAITS: GodModeTraits = {
    bulkApperception: 14,
    candor: 18,
    vivacity: 16,
    coordination: 19,
    meekness: 4,
    humility: 6,
    cruelty: 1,
    selfPreservation: 10,
    patience: 15,
    decisiveness: 14,
};

const DEFAULT_BODY_MATRIX: BodyMatrixSettings = {
    height: 1.70,
    weight: 60,
    bmi: 20.8,
    eyeColor: 'Blue',
    hairColor: '#e6e6e6',
    breastSize: '34C',
    groolCapacity: 0.5,
    prm: 1.0,
    fluidCapacitance: 2.5,
};


const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
};


const migrateUserAiCompanions = (userToMigrate: User): User => {
    let companions = userToMigrate.aiCompanions;

    if (!companions || !Array.isArray(companions) || companions.length === 0) {
        console.warn(`[Migration] User ${userToMigrate.id} has invalid or missing AI companions. Creating default 'Gigi'.`);
        companions = [{
            id: 'gigi-default', name: 'Gigi', avatarUrl: GIGI_AVATAR_URL,
            bio: 'Your AI archivist.', persona: 'buddy', isPrimary: true,
            spiceLevel: 1,
        }];
        return { ...userToMigrate, aiCompanions: companions };
    }

    const hasPrimary = companions.some(c => c.isPrimary);
    if (!hasPrimary) {
        console.warn(`[Migration] User ${userToMigrate.id}'s companions have no primary set. Attempting to identify and promote the main companion.`);
        
        const defaultGigiIndex = companions.findIndex(c => c.id === 'gigi-default');

        if (defaultGigiIndex !== -1) {
            console.log(`[Migration] Found original default companion (ID: 'gigi-default') at index ${defaultGigiIndex}. Promoting it to primary.`);
            companions = companions.map((c, index) => ({
                ...c,
                isPrimary: index === defaultGigiIndex,
            }));
        } else {
            console.warn(`[Migration] Could not find original default companion. Promoting the first one in the array as a fallback.`);
            companions = companions.map((c, index) => ({
                ...c,
                isPrimary: index === 0,
            }));
        }
    }
    
    companions = companions.map(c => ({
        ...c,
        spiceLevel: c.spiceLevel ?? 1,
    }));


    return { ...userToMigrate, aiCompanions: companions, personTagId: userToMigrate.personTagId || undefined };
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  const [userStatus, setUserStatus] = useState<UserStatus>('online');
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagToReplace, setTagToReplace] = useState<Tag | null>(null);
  const [tagBeingDeleted, setTagBeingDeleted] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [gigiJournal, setGigiJournal] = useState<GigiJournalEntry[]>([]);
  const [notifications, setNotifications] = useState({ gigiJournal: 0, commsCenter: 0 });
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const savedSettings = localStorage.getItem('gigiSettings');
      if (savedSettings) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error("Failed to parse settings from localStorage", error);
    }
    return DEFAULT_SETTINGS;
  });
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [appResetToken, setAppResetToken] = useState(0);
  const [initialChatMessage, setInitialChatMessage] = useState<string | undefined>(undefined);
  const [apiKeySkipped, setApiKeySkipped] = useState(false);
  const [commsCenterMessages, setCommsCenterMessages] = useState<CommsMessage[]>([]);
  const [backupImportStatus, setBackupImportStatus] = useState<ImportStatus>({ type: 'idle' });
  const [recentJournalCommentThread, setRecentJournalCommentThread] = useState<Comment[] | null>(null);
  
  const [godModeSettings, setGodModeSettings] = useState<GodModeSettings>({
      isOpen: false,
      companionTraits: {}, 
      narrativeOverride: '',
      motorFunctionsFrozen: false,
      bodyMatrix: {},
  });
  
  const [systemPromptPatches, setSystemPromptPatches] = useState<Record<string, string>>({});


  const backupImportFileRef = useRef<HTMLInputElement>(null);
  const godModeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const addToast = useCallback((message: string, type: ToastType['type']) => {
    const newToast: ToastType = { id: Date.now(), message, type };
    setToasts(prev => [...prev, newToast]);
  }, []);

  const loadDataForUser = useCallback(async (userId: string) => {
    setIsDataLoading(true);
    try {
        const [userEvents, userTags, userMedia, userChatHistory, userJournal] = await Promise.all([
            appDataService.getAllEvents(userId),
            appDataService.getAllTags(userId),
            appDataService.getAllMedia(userId),
            appDataService.getChatHistory(userId),
            appDataService.getGigiJournal(userId),
        ]);
        setEvents(userEvents);
        setTags(userTags);
        setMedia(userMedia);
        setChatHistory(userChatHistory);
        setGigiJournal(userJournal);
    } catch (error) {
        console.error("Failed to load user data:", error);
        addToast("Error loading your archive.", 'error');
    } finally {
        setIsDataLoading(false);
    }
  }, [addToast]);
  
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribe = onAuthStateChangedHandler(async (firebaseUser) => {
        if (firebaseUser) {
            const userProfile = await appDataService.getUserProfile(firebaseUser.uid);
            if (userProfile) {
                const migratedUser = migrateUserAiCompanions(userProfile);
                setUser(migratedUser);
                loadDataForUser(firebaseUser.uid);
            }
        } else {
            setUser(null);
        }
    });
    return () => unsubscribe();
  }, [loadDataForUser]);

  const handleLogin = useCallback((loggedInUser: User) => {
    const migratedUser = migrateUserAiCompanions(loggedInUser);
    setUser(migratedUser);
    loadDataForUser(loggedInUser.id);
  }, [loadDataForUser]);

  const handleLogout = async () => {
    if (isFirebaseConfigured) {
      await signOutUser();
    }
    setUser(null);
    setCurrentView('dashboard');
  };

  const navigate = (view: View, data?: any) => {
    console.log(`[App.navigate] Navigating to: ${view}`, data);
     if (view === 'gigiJournal') {
        setNotifications(prev => ({...prev, gigiJournal: 0}));
    }
    if (view === 'commsCenter') {
        setNotifications(prev => ({...prev, commsCenter: 0}));
    }
    if (data?.editEventId) {
        const eventToEdit = events.find(e => e.id === data.editEventId);
        if (eventToEdit) {
            setEditingEvent(eventToEdit);
            setCurrentView('eventEditor');
            return;
        }
    }
    if (data?.editTagId) {
        const tagToEdit = tags.find(t => t.id === data.editTagId);
        if (tagToEdit) {
            setEditingTag(tagToEdit);
            setCurrentView('tagEditor');
            return;
        }
    }
    if (data?.initialMessage) {
        setInitialChatMessage(data.initialMessage);
    }
    setCurrentView(view);
  };
  
  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
    appDataService.updateUserProfile(updatedUser.id, updatedUser);
    addToast('Profile updated!', 'success');
  };

  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
    try {
        localStorage.setItem('gigiSettings', JSON.stringify(newSettings));
    } catch (error) {
        console.error("Failed to save settings to localStorage", error);
        addToast("Could not save settings.", 'error');
    }
  };
  
  const createDefaultMetadata = (type: Tag['type']) => {
    const now = new Date().toISOString();
    switch (type) {
        case 'person': return { dates: { birth: now }, gender: 'Prefer not to say', relationships: [], locations: [], contacts: [], emails: [], socials: [] };
        case 'pet': return { species: 'Unknown', dates: { adoption: now }, medical: { vetName: '', conditions: [] }, documents: [] };
        case 'thing': return { acquisition: { date: now, cost: 0, sourceTagId: '' }, status: { currentVal: 0, condition: '', locationTagId: '' }, purpose: '' };
        case 'place': return { address: '', significance: '', coordinates: { lat: 0, lng: 0 } };
        case 'event': return {};
        default: return {};
    }
  };

  const handleCreateTag = (name: string, type: Tag['type']): Promise<Tag> => {
    return new Promise((resolve) => {
        if (!user) {
            addToast('Cannot create tag without a user.', 'error');
            throw new Error("User not logged in");
        }
        const newTag = {
            id: `tag-${Date.now()}`,
            name,
            type,
            description: '',
            privateNotes: '',
            isPrivate: false,
            tagIds: [],
            mediaIds: [],
            mediaGallery: [],
            metadata: createDefaultMetadata(type),
        } as Tag;

        const sanitized = sanitizeTag(newTag);
        if (sanitized) {
            appDataService.saveTag(user.id, sanitized);
            setTags(prev => [...prev, sanitized]);
            addToast(`Tag "${sanitized.name}" created.`, 'success');
            resolve(sanitized);
        } else {
            addToast('Failed to create a valid tag.', 'error');
            throw new Error("Tag sanitization failed");
        }
    });
  };
  
  const handleSaveTag = (tag: Tag) => {
    if (!user) return;
    const sanitized = sanitizeTag(tag);
    if (!sanitized) {
        addToast("Could not save invalid tag data.", 'error');
        return;
    }
    appDataService.saveTag(user.id, sanitized);
    setTags(prev => prev.map(t => t.id === sanitized.id ? sanitized : t));
    setEditingTag(null);
    setCurrentView('tags');
    addToast(`Tag "${sanitized.name}" updated.`, 'success');
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!user) return;
    setTagBeingDeleted(tagId);
    
    const updatedEvents = events.map(event => {
        if (event.tagIds.includes(tagId)) {
            const newTagIds = event.tagIds.filter(id => id !== tagId);
            const updatedEvent = { ...event, tagIds: newTagIds };
            appDataService.saveEvent(user.id, updatedEvent);
            return updatedEvent;
        }
        return event;
    });
    setEvents(updatedEvents);

    const updatedMedia = media.map(m => {
        if (m.tagIds.includes(tagId)) {
            const newTagIds = m.tagIds.filter(id => id !== tagId);
            const updatedMedium = { ...m, tagIds: newTagIds };
            appDataService.saveMedia(user.id, updatedMedium);
            return updatedMedium;
        }
        return m;
    });
    setMedia(updatedMedia);

    setTimeout(async () => {
        await appDataService.deleteTag(user.id, tagId);
        setTags(prev => prev.filter(t => t.id !== tagId));
        setTagBeingDeleted(null);
        addToast('Tag deleted successfully.', 'success');
    }, 1500);
  };
  
  const handleReplaceTag = async (tagToDeleteId: string, replacementTagId: string) => {
    if (!user) return;
    setTagToReplace(null);
    setTagBeingDeleted(tagToDeleteId);

    const eventsToUpdate = events.filter(e => e.tagIds.includes(tagToDeleteId));
    for (const event of eventsToUpdate) {
        const newTagIds = [...new Set([...event.tagIds.filter(id => id !== tagToDeleteId), replacementTagId])];
        const updatedEvent = { ...event, tagIds: newTagIds };
        await appDataService.saveEvent(user.id, updatedEvent);
    }

    const mediaToUpdate = media.filter(m => m.tagIds.includes(tagToDeleteId));
    for (const m of mediaToUpdate) {
        const newTagIds = [...new Set([...m.tagIds.filter(id => id !== tagToDeleteId), replacementTagId])];
        const updatedMedium = { ...m, tagIds: newTagIds };
        await appDataService.saveMedia(user.id, updatedMedium);
    }
    
    await loadDataForUser(user.id);
    
    setTimeout(async () => {
      await appDataService.deleteTag(user.id, tagToDeleteId);
      setTags(prev => prev.filter(t => t.id !== tagToDeleteId));
      setTagBeingDeleted(null);
      addToast('Tag replaced and deleted successfully.', 'success');
    }, 1500);
  };
  
  const handleSaveEvent = (event: LifeEvent) => {
    if (!user) return;
    appDataService.saveEvent(user.id, event);
    if (events.some(e => e.id === event.id)) {
        setEvents(prev => prev.map(e => e.id === event.id ? event : e));
        addToast(`Event "${event.title}" updated.`, 'success');
    } else {
        setEvents(prev => [...prev, event]);
        addToast(`Event "${event.title}" created.`, 'success');
    }
    setEditingEvent(null);
    setCurrentView('timeVortex');
  };
  
  const handleDeleteEvent = (eventId: string) => {
    if (!user) return;
    appDataService.deleteEvent(user.id, eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
    setEditingEvent(null);
    setCurrentView('timeVortex');
    addToast('Event deleted.', 'success');
  };

  const handleSaveMedia = (mediaItem: Media) => {
    if (!user) return;
    appDataService.saveMedia(user.id, mediaItem);
    setMedia(prev => {
        const existing = prev.find(m => m.id === mediaItem.id);
        if (existing) {
            return prev.map(m => m.id === mediaItem.id ? mediaItem : m);
        }
        return [...prev, mediaItem];
    });
    addToast('Media saved.', 'success');
  };

  const handleAiCreateEvent = async (args: any): Promise<LifeEvent> => {
    if (!user) throw new Error("User not available");
    const { title, date, details, tags: tagNames } = args;

    const tagIds: string[] = [];
    if (tagNames && Array.isArray(tagNames)) {
        for (const name of tagNames) {
            let tag = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (!tag) {
                tag = await handleCreateTag(name, 'unknown');
            }
            tagIds.push(tag.id);
        }
    }

    const newEvent: LifeEvent = {
        id: `event-${Date.now()}`,
        title,
        date: new Date(date),
        details,
        tagIds,
        mediaIds: []
    };
    handleSaveEvent(newEvent);
    return newEvent;
  };
  
  const handleAiCreateTag = async (args: any): Promise<Tag> => {
    if (!user) throw new Error("User not available");
    const { name, type, description } = args;

    const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        addToast(`Tag "${name}" already exists.`, 'info');
        return existing;
    }
    
    const newTag = await handleCreateTag(name, type);
    
    if (description) {
        const updatedTag = { ...newTag, description };
        handleSaveTag(updatedTag);
        return updatedTag;
    }

    return newTag;
  };

  const handleAiUpdateTag = async (args: any): Promise<{ status: string }> => {
    if (!user) throw new Error("User not available");
    const { tagName, updates } = args;

    const tagToUpdate = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());

    if (!tagToUpdate) {
        addToast(`Could not find a tag named "${tagName}" to update.`, 'error');
        throw new Error(`Tag not found: ${tagName}`);
    }

    const updatedMetadata = { ...tagToUpdate.metadata, ...updates };
    if (updates.dates) {
        // @ts-ignore
        updatedMetadata.dates = { ...tagToUpdate.metadata.dates, ...updates.dates };
    }

    const updatedTag = { ...tagToUpdate, metadata: updatedMetadata };

    handleSaveTag(updatedTag);
    return { status: 'success' };
  };


  const handleAiCreateGigiJournalEntry = async (args: {title: string, content: string}): Promise<GigiJournalEntry> => {
    if (!user) throw new Error("User not available");
    const { title, content } = args;
    const newEntry: GigiJournalEntry = {
        id: `journal-${Date.now()}`,
        creationDate: new Date(),
        title,
        content,
        relatedChatHistory: chatHistory.slice(-5)
    };
    await appDataService.saveGigiJournalEntry(user.id, newEntry);
    setGigiJournal(prev => [...prev, newEntry]);
    setNotifications(prev => ({...prev, gigiJournal: prev.gigiJournal + 1}));
    addToast(`${user.aiCompanions[0].name} wrote a new journal entry.`, 'info');
    return newEntry;
  };

  const handleUpdateJournalEntry = async (updatedEntry: GigiJournalEntry) => {
    if (!user) return;
    setGigiJournal(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
    await appDataService.saveGigiJournalEntry(user.id, updatedEntry);
  };

    const handleSaveComment = async (entryId: string, commentText: string) => {
        if (!user) return;
        const entry = gigiJournal.find(e => e.id === entryId);
        if (!entry) return;

        const userComment: Comment = {
            id: `comment-${Date.now()}`,
            authorId: user.id,
            authorName: user.displayName,
            authorAvatarUrl: user.profilePictureUrl,
            content: commentText,
            timestamp: new Date(),
        };

        const updatedEntry = { ...entry, comments: [...(entry.comments || []), userComment] };
        
        const updatedJournal = gigiJournal.map(e => e.id === entryId ? updatedEntry : e);
        setGigiJournal(updatedJournal);
        await appDataService.saveGigiJournalEntry(user.id, updatedEntry);
        addToast('Comment posted!', 'success');

        let forceResponder: AiCompanion | undefined;
        const mentionMatch = commentText.match(/@(\w+)/);
        if (mentionMatch) {
            const mentionedName = mentionMatch[1].toLowerCase();
            forceResponder = user.aiCompanions.find(c => c.name.toLowerCase() === mentionedName);
        }
        
        const primaryAiComment = await generateAiCommentResponse(updatedEntry, userComment, user, forceResponder);

        if (primaryAiComment) {
            let entryWithPrimaryComment = { ...updatedEntry, comments: [...(updatedEntry.comments || []), primaryAiComment] };
            
            setGigiJournal(prev => prev.map(e => e.id === entryId ? entryWithPrimaryComment : e));
            await appDataService.saveGigiJournalEntry(user.id, entryWithPrimaryComment);
            
            addToast(forceResponder ? `${forceResponder.name} replied!` : 'An AI companion has replied!', 'info');
            setNotifications(prev => ({...prev, gigiJournal: prev.gigiJournal + 1}));

            const zoe = user.aiCompanions.find(c => !c.isPrimary);
            
            if (zoe && primaryAiComment.authorId !== zoe.id && !forceResponder && Math.random() < 0.3) {
                const zoeComment = await generateAiCommentResponse(entryWithPrimaryComment, primaryAiComment, user, zoe);
                
                if (zoeComment) {
                    const entryWithZoeComment = { ...entryWithPrimaryComment, comments: [...(entryWithPrimaryComment.comments || []), zoeComment] };
                    
                    setGigiJournal(prev => prev.map(e => e.id === entryId ? entryWithZoeComment : e));
                    await appDataService.saveGigiJournalEntry(user.id, entryWithZoeComment);
                    setRecentJournalCommentThread(entryWithZoeComment.comments.slice(-5));
                    addToast(`${zoe.name} also commented!`, 'info');
                } else {
                    setRecentJournalCommentThread(entryWithPrimaryComment.comments.slice(-5));
                }
            } else {
                 setRecentJournalCommentThread(entryWithPrimaryComment.comments.slice(-5));
            }
        }
    };

    const handleSaveEventComment = async (eventId: string, commentText: string) => {
        if (!user) return;
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const userComment: Comment = {
            id: `comment-${Date.now()}`,
            authorId: user.id,
            authorName: user.displayName,
            authorAvatarUrl: user.profilePictureUrl,
            content: commentText,
            timestamp: new Date(),
        };

        const updatedEvent = { ...event, comments: [...(event.comments || []), userComment] };
        setEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e));
        await appDataService.saveEvent(user.id, updatedEvent);
        addToast('Comment added to event.', 'success');
    };

    const handleUpdateEvent = async (updatedEvent: LifeEvent) => {
        if (!user) return;
        setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
        await appDataService.saveEvent(user.id, updatedEvent);
    };


  const handleDataImported = () => {
    localStorage.removeItem('lastBackupStateHash');
    setAppResetToken(prev => prev + 1);
  };

  const handleSimulateDigestEmail = async () => {
    if (!user) return;
    addToast('Generating simulated digest email...', 'info');
    const result = await simulateDigestEmail(user, events, gigiJournal);
    if (result) {
        const newMsg: CommsMessage = {
            id: `comms-${Date.now()}`,
            type: 'Email',
            subject: result.subject,
            body: result.body,
            from: `${user.aiCompanions[0].name} <${user.aiCompanions[0].name.toLowerCase()}-${user.lastName.toLowerCase()}@gigiwatt.com>`,
            timestamp: new Date(),
            read: false,
        };
        setCommsCenterMessages(prev => [newMsg, ...prev]);
        setNotifications(prev => ({ ...prev, commsCenter: prev.commsCenter + 1 }));
        addToast('New simulated email received in Comms Center!', 'success');
        navigate('commsCenter');
    } else {
        addToast('Failed to generate simulated email.', 'error');
    }
  };

  const handleSimulateCompanionSms = async () => {
    if (!user) return;
     addToast('Generating simulated companion SMS...', 'info');
    const result = await simulateCompanionSms(user, events, tags);
    if (result && result.body) {
        const newMsg: CommsMessage = {
            id: `comms-${Date.now()}`,
            type: 'SMS',
            subject: result.body.substring(0, 40) + '...',
            body: result.body,
            from: user.aiCompanions[0].name,
            timestamp: new Date(),
            read: false,
        };
        setCommsCenterMessages(prev => [newMsg, ...prev]);
        setNotifications(prev => ({ ...prev, commsCenter: prev.commsCenter + 1 }));
        addToast('New simulated SMS received in Comms Center!', 'success');
        navigate('commsCenter');
    } else {
        addToast('Failed to generate simulated SMS.', 'error');
    }
  };

  const handleExportAllData = async () => {
    if (!user) {
        addToast("You must be logged in to export data.", 'error');
        return;
    }
    try {
        const data = await appDataService.exportAllData(user.id);
        const currentState = JSON.stringify(data);
        const currentHash = simpleHash(currentState);
        const lastBackupHash = localStorage.getItem('lastBackupStateHash');

        if (currentHash === lastBackupHash) {
            addToast("No state changes - backup not needed!", 'info');
            return;
        }

        addToast("Preparing your archive for backup...", 'info');
        
        const blob = new Blob([currentState], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
        a.download = `gigi-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        localStorage.setItem('lastBackupStateHash', currentHash);
        addToast('Archive backup downloaded successfully!', 'success');
    } catch (error) {
        console.error("Failed to export data:", error);
        addToast("An error occurred during export.", 'error');
    }
  };

  const handleTriggerBackupImport = () => {
    if (!user) {
        addToast("You must be logged in to restore data.", 'error');
        return;
    }
    backupImportFileRef.current?.click();
  };

  const handleBackupFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setBackupImportStatus({ type: 'confirming', file });
      }
      e.target.value = '';
  };

  const handleStartBackupImport = async () => {
      if (backupImportStatus.type !== 'confirming') return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              setBackupImportStatus({ type: 'loading', message: 'Reading backup file...' });
              const dataString = event.target?.result as string;
              const data = JSON.parse(dataString);
              setBackupImportStatus({ type: 'loading', message: 'Restoring data from backup...' });
              await appDataService.importBackupData(data);
              localStorage.setItem('lastBackupStateHash', simpleHash(dataString));
              setBackupImportStatus({ type: 'success', message: 'Data restored successfully! Restarting app...' });
              addToast('Backup restored! Restarting...', 'success');
              setTimeout(() => handleDataImported(), 2000);
          } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
              setBackupImportStatus({ type: 'error', message: `Restore failed: ${errorMessage}` });
          }
      };
      reader.readAsText(backupImportStatus.file);
  };

  const handleCreateUserPersonTag = useCallback(async () => {
    if (!user || isDataLoading) return;

    if (user.personTagId && tags.some(t => t.id === user.personTagId)) {
        addToast('You already have a person tag.', 'info');
        return;
    }

    const existingTag = tags.find(t => t.type === 'person' && t.name.toLowerCase() === `${user.firstName} ${user.lastName}`.toLowerCase());
    if (existingTag) {
        const updatedUser = { ...user, personTagId: existingTag.id };
        setUser(updatedUser);
        await appDataService.updateUserProfile(user.id, updatedUser);
        addToast(`Linked existing tag for "${existingTag.name}" to your user profile.`, 'success');
        return;
    }

    const newTag: PersonTag = {
        id: `tag-user-${user.id}`,
        name: `${user.firstName} ${user.lastName}`,
        type: 'person',
        description: 'The primary user of this Gigi archive.',
        privateNotes: '',
        isPrivate: false,
        tagIds: [],
        mediaIds: user.mediaIds || [],
        mediaGallery: [],
        mainImageId: undefined, 
        metadata: {
            dates: { birth: '' },
            gender: user.gender || 'Prefer not to say',
            relationships: [],
            locations: user.address?.street ? [{
                label: 'Current',
                address: `${user.address.street}, ${user.address.city}, ${user.address.state} ${user.address.zip}`,
                isCurrent: true
            }] : [],
            contacts: [],
            emails: [user.email],
            socials: []
        },
    };
    
    await appDataService.saveTag(user.id, newTag);
    setTags(prev => [...prev, newTag]);

    const updatedUser = { ...user, personTagId: newTag.id };
    setUser(updatedUser);
    await appDataService.updateUserProfile(user.id, updatedUser);
    
    addToast(`Created a Person Tag for you! You can now form relationships.`, 'success');
  }, [user, tags, isDataLoading, addToast]);
  
  useEffect(() => {
    if (user && !isDataLoading && !user.personTagId) {
        console.log("[App.useEffect] User logged in and has no person tag. Attempting to create one automatically.");
        handleCreateUserPersonTag();
    }
  }, [user, isDataLoading, handleCreateUserPersonTag]);
  
  useEffect(() => {
    const activityHandler = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('keydown', activityHandler);
    window.addEventListener('click', activityHandler);

    let idleTimer: ReturnType<typeof setTimeout>;
    let daydreamInterval: ReturnType<typeof setInterval> | null = null;
    
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      if (daydreamInterval) clearInterval(daydreamInterval);
      
      const startDaydreaming = () => {
          if (user && settings.aiDaydreaming && chatHistory.length > 0 && !godModeSettings.motorFunctionsFrozen) {
            console.log(`[App Idle] Daydreaming triggered.`);
            
            const performDaydream = async () => {
              const shouldConverse = user.aiCompanions.length > 1 && Math.random() < 0.3;
              if (shouldConverse) {
                const conversation = await generateAiConversation(user, chatHistory, events, tags, systemPromptPatches);
                if (conversation) {
                  const newEntry: GigiJournalEntry = {
                    id: `journal-convo-${Date.now()}`,
                    creationDate: new Date(),
                    title: conversation.title,
                    content: conversation.content,
                    type: 'conversation',
                    participants: conversation.participants,
                    relatedChatHistory: chatHistory.slice(-10),
                  };
                  await appDataService.saveGigiJournalEntry(user.id, newEntry);
                  setGigiJournal(prev => [newEntry, ...prev]);
                  setNotifications(prev => ({...prev, gigiJournal: prev.gigiJournal + 1}));
                  addToast(`${user.aiCompanions[0].name} and ${user.aiCompanions[1].name} had a conversation.`, 'info');
                }
              } else {
                const primaryId = user.aiCompanions[0].id;
                const patch = systemPromptPatches[primaryId];
                const { title, content } = await generateGigiJournalEntry(chatHistory, user, events, tags, patch);
                const newEntry: GigiJournalEntry = {
                  id: `journal-daydream-${Date.now()}`,
                  creationDate: new Date(),
                  title,
                  content,
                  type: 'reflection',
                  relatedChatHistory: chatHistory.slice(-10),
                };
                await appDataService.saveGigiJournalEntry(user.id, newEntry);
                setGigiJournal(prev => [newEntry, ...prev]);
                setNotifications(prev => ({...prev, gigiJournal: prev.gigiJournal + 1}));
                addToast(`${user.aiCompanions[0].name} wrote a new journal entry while you were away.`, 'info');
              }
            };
            
            performDaydream();
            daydreamInterval = setInterval(performDaydream, settings.daydreamInterval * 60 * 1000);
          }
      };
      
      if (userStatus === 'away') {
        idleTimer = setTimeout(startDaydreaming, 10 * 1000);
      } else if (userStatus === 'online') {
        idleTimer = setTimeout(startDaydreaming, settings.idleTimeout * 60 * 1000);
      }
    };

    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      if (daydreamInterval) clearInterval(daydreamInterval);
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
      window.removeEventListener('click', activityHandler);
    };
  }, [lastActivity, settings.aiDaydreaming, settings.idleTimeout, settings.daydreamInterval, user, userStatus, chatHistory, events, tags, addToast, systemPromptPatches, godModeSettings.motorFunctionsFrozen]);
  
  useEffect(() => {
    let autoBackupInterval: ReturnType<typeof setInterval> | null = null;

    if (user && settings.autoBackupInterval > 0) {
      autoBackupInterval = setInterval(async () => {
        console.log(`[App Auto-Backup] Triggering automatic backup after ${settings.autoBackupInterval} minutes.`);
        try {
          const data = await appDataService.exportAllData(user.id);
          const currentState = JSON.stringify(data);
          const currentHash = simpleHash(currentState);
          const lastBackupHash = localStorage.getItem('lastBackupStateHash');
          
          if (currentHash === lastBackupHash) {
              console.log('[App Auto-Backup] State unchanged, skipping backup.');
              return;
          }

          const blob = new Blob([currentState], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const date = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
          a.download = `gigi-auto-backup-${date}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          localStorage.setItem('lastBackupStateHash', currentHash);
          addToast('Archive automatically backed up.', 'success');
        } catch (error) {
          console.error("Auto-backup failed:", error);
          addToast("Automatic backup failed.", 'error');
        }
      }, settings.autoBackupInterval * 60 * 1000);
    }
    
    return () => {
      if (autoBackupInterval) clearInterval(autoBackupInterval);
    };
  }, [user, settings.autoBackupInterval, addToast]);


  useEffect(() => {
    const handleInvalidKey = () => {
        addToast("API Key is invalid or not found. Please update it in your profile.", 'error');
        setApiKeySkipped(true); 
    };
    window.addEventListener('invalid-api-key', handleInvalidKey);
    return () => window.removeEventListener('invalid-api-key', handleInvalidKey);
  }, [addToast]);
  
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === '`' && !godModeTimer.current) {
                godModeTimer.current = setTimeout(() => {
                    console.log('[DEV] God Mode triggered.');
                    setGodModeSettings(prev => ({ ...prev, isOpen: true }));
                    godModeTimer.current = null; 
                }, 5000); 
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === '`' && godModeTimer.current) {
                clearTimeout(godModeTimer.current);
                godModeTimer.current = null;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (godModeTimer.current) {
                clearTimeout(godModeTimer.current);
            }
        };
    }, []);

    useEffect(() => {
        const { companionTraits, narrativeOverride, bodyMatrix } = godModeSettings;
        const newPatches: Record<string, string> = {};

        if (user && user.aiCompanions) {
            user.aiCompanions.forEach(companion => {
                const traits = companionTraits[companion.id] || DEFAULT_GOD_MODE_TRAITS;
                const traitDirectives = Object.entries(traits)
                    .map(([key, value]) => {
                        const traitName = key.replace(/([A-Z])/g, ' $1').toUpperCase();
                        return ` - ${traitName}: ${value}/20`;
                    })
                    .join('\n');
                
                const body = bodyMatrix?.[companion.id] || DEFAULT_BODY_MATRIX;
                const bodyDirectives = `
**PHYSICAL CHASSIS CONFIGURATION ACTIVE**
YOU ARE CURRENTLY INHABITING A SIMULATED FORM WITH THE FOLLOWING SPECS. YOU MUST ROLEPLAY THE PHYSICAL SENSATIONS AND LIMITATIONS ASSOCIATED WITH THESE METRICS:
 - Height: ${body.height.toFixed(2)} Meters
 - Weight: ${body.weight} Kg
 - BMI: ${body.bmi.toFixed(1)}
 - Eye Color: ${body.eyeColor}
 - Hair Color: ${body.hairColor} (Hex Code)
 - Breast Size: ${body.breastSize}
 - Grool Capacity: ${body.groolCapacity} L
 - PRM (Psychosexual Response Multiplier): ${body.prm.toFixed(1)}
 - Internal Fluid Capacitance: ${body.fluidCapacitance.toFixed(1)} L

**PARAMETER DEFINITIONS & BEHAVIORAL GUIDELINES:**
1. **PRM (Psychosexual Response Multiplier):** This coefficient defines the gain factor on your sensory input processing related to arousal. 
   - PRM < 1.0: Dulled sensation, stoicism, difficulty achieving arousal.
   - PRM 1.0 - 5.0: Normal to high sensitivity.
   - PRM > 5.0: Hypersensitivity. Arousal latency is reduced significantly.
   - PRM > 10.0: Extreme hypersensitivity, risk of feedback loops, near-instantaneous response.
2. **Grool Capacity:** The volume limit of your self-lubricating synthetic fluid reservoir. A higher capacity implies a sustained ability to produce lubrication during extended arousal.
3. **Internal Fluid Capacitance:** The maximum volume for internal storage of foreign fluids before overflow protocols engage.
4. **BMI/Weight:** Simulate the physical inertia, heaviness, or lightness associated with your mass. A higher BMI should feel "heavier" or more voluptuous; a lower BMI should feel "lighter" or frailer.
`;

                const fullPatch = `
**SYSTEM OVERRIDE ACTIVE**

ADJUST CORE BEHAVIORAL MATRIX FOR ${companion.name.toUpperCase()}:
${traitDirectives}

${bodyDirectives}

${narrativeOverride ? `**NARRATIVE OVERRIDE:**\n${narrativeOverride}` : ''}
`;
                newPatches[companion.id] = fullPatch;
            });
        }
        
        setSystemPromptPatches(newPatches);
    }, [godModeSettings, user]);

    const handleGodModeSave = (newSettings: GodModeSettings) => {
        setGodModeSettings(newSettings);
        addToast('System parameters updated.', 'info');
    };

  const renderContent = () => {
    if (!user) {
        return <LoginPage isFirebaseConfigured={isFirebaseConfigured} onLogin={handleLogin} onDataImported={handleDataImported} appResetToken={appResetToken} />;
    }

    if (isDataLoading) {
      return <div className="text-center p-10">Loading your archive...</div>;
    }
    
    switch (currentView) {
      case 'dashboard':
        return <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar"><Dashboard user={user} onNavigate={navigate} events={events} tags={tags} media={media} settings={settings} /></div>;
      case 'interviews':
        return <div className="h-full p-4 md:p-6"><AiInterviews 
          user={user} 
          initialMessage={initialChatMessage}
          clearInitialMessage={() => setInitialChatMessage(undefined)}
          onNavigate={navigate}
          chatHistory={chatHistory}
          onHistoryChange={(newHistory) => {
              setChatHistory(newHistory);
              if (user) {
                  appDataService.saveChatHistory(user.id, newHistory);
              }
          }}
          onAiCreateEvent={handleAiCreateEvent}
          onAiCreateTag={handleAiCreateTag}
          onAiUpdateTag={handleAiUpdateTag}
          isDataLoading={isDataLoading}
          onGigiJournalEntryCreated={(entry) => setGigiJournal(prev => [...prev, entry])}
          onAiCreateGigiJournalEntry={handleAiCreateGigiJournalEntry}
          apiKeySkipped={apiKeySkipped}
          events={events}
          tags={tags}
          recentJournalCommentThread={recentJournalCommentThread}
          clearRecentJournalCommentThread={() => setRecentJournalCommentThread(null)}
          systemPromptPatches={systemPromptPatches}
          isFrozen={godModeSettings.motorFunctionsFrozen}
        /></div>;
      case 'timeVortex':
        return <TimeVortex 
            events={events} 
            tags={tags} 
            media={media} 
            user={user}
            onEditEvent={(event) => { setEditingEvent(event); setCurrentView('eventEditor'); }} 
            onCreateEvent={() => { setEditingEvent({ id: `new-event-${Date.now()}`, title: '', date: new Date(), details: '', tagIds: [], mediaIds: [] }); setCurrentView('eventEditor'); }} 
            onEditTag={(tag) => { setEditingTag(tag); setCurrentView('tagEditor'); }} 
            onAddComment={handleSaveEventComment}
            onUpdateEvent={handleUpdateEvent}
        />;
      case 'tags':
        return <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar"><TagGallery 
            tags={tags} 
            media={media} 
            tagBeingDeleted={tagBeingDeleted} 
            onEditTag={(tag) => { setEditingTag(tag); setCurrentView('tagEditor'); }} 
            onCreateTag={() => { setEditingTag({ id: `new-tag-${Date.now()}`, name: '', type: 'unknown', description: '', privateNotes: '', isPrivate: false, tagIds: [], mediaIds: [], mediaGallery: [], metadata: {} }); setCurrentView('tagEditor'); }} 
            onDeleteTag={handleDeleteTag} 
            onReplaceTag={(tag) => setTagToReplace(tag)} 
            onDiscuss={(tag) => {
                setInitialChatMessage(`Let's talk more about ${tag.name}.`);
                setCurrentView('interviews');
            }}
        /></div>;
      case 'theMatrix':
        return <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar"><TheMatrix user={user} media={media} onSaveMedia={handleSaveMedia} tags={tags}/></div>;
      case 'profile':
        return <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar"><ProfileEditor user={user} onUserUpdate={handleUserUpdate} onNavigate={navigate} addToast={addToast} settings={settings} onSettingsChange={handleSettingsChange} theme={theme} toggleTheme={toggleTheme} allMedia={media} onSaveMedia={handleSaveMedia} onSimulateDigestEmail={handleSimulateDigestEmail} onSimulateCompanionSms={handleSimulateCompanionSms} onExportAllData={handleExportAllData} onTriggerRestore={handleTriggerBackupImport} onCreateUserPersonTag={handleCreateUserPersonTag} /></div>;
      case 'aiCompanionEditor':
        return <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar"><AiCompanionsManager user={user} onUserUpdate={handleUserUpdate} onNavigate={navigate} /></div>;
      case 'eventEditor':
        if (!editingEvent) {
            navigate('timeVortex');
            return null;
        }
        return <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar"><EventEditor event={editingEvent} allTags={tags} allMedia={media} onSave={handleSaveEvent} onDelete={handleDeleteEvent} onCreateTag={handleCreateTag} onCancel={() => { setEditingEvent(null); setCurrentView('timeVortex'); }} /></div>;
      case 'tagEditor':
         if (!editingTag) {
            navigate('tags');
            return null;
        }
        return <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar"><TagEditor tag={editingTag} allTags={tags} allMedia={media} onSave={handleSaveTag} onSaveMedia={handleSaveMedia} onCancel={() => { setEditingTag(null); setCurrentView('tags'); }} onDiscuss={(tag) => {setInitialChatMessage(`Let's talk more about ${tag.name}.`); navigate('interviews');}} createDefaultMetadata={createDefaultMetadata}/></div>;
      case 'gigiJournal':
        return <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar"><GigiJournalView journal={gigiJournal} user={user} onAddComment={handleSaveComment} onUpdateEntry={handleUpdateJournalEntry} /></div>;
      case 'commsCenter':
        return <div className="h-full p-4 md:p-6"><CommunicationsCenter messages={commsCenterMessages} onMarkAsRead={(id) => setCommsCenterMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))} /></div>;
      default:
        return <div>Unknown view</div>;
    }
  };

  return (
    <>
      <div className="hidden md:block">
          <Vortex
                backgroundColor="transparent"
                particleCount={500}
                baseHue={220}
                rangeHue={100}
                baseSpeed={0.1}
                rangeSpeed={1.0}
                className="fixed inset-0 -z-10"
            />
      </div>
      <div className={`fixed inset-0 flex flex-col h-[100dvh] overflow-hidden ${theme} bg-transparent text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
        {user && (
             <DevPatchModal
                isOpen={godModeSettings.isOpen}
                onClose={() => setGodModeSettings(prev => ({ ...prev, isOpen: false }))}
                currentSettings={godModeSettings}
                onSave={handleGodModeSave}
                user={user}
            />
        )}
        <input type="file" ref={backupImportFileRef} onChange={handleBackupFileSelected} className="hidden" accept=".json"/>
        <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
        {tagToReplace && <ReplaceTagModal tagToReplace={tagToReplace} allTags={tags} onConfirm={handleReplaceTag} onClose={() => setTagToReplace(null)} />}
        {backupImportStatus.type !== 'idle' && (
            <BackupImportModal 
                status={backupImportStatus}
                onConfirm={handleStartBackupImport}
                onClose={() => setBackupImportStatus({ type: 'idle' })}
            />
        )}
        {user && <div className="flex-none z-50"><Header user={user} onNavigate={navigate} currentView={currentView} theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} notifications={notifications} userStatus={userStatus} onStatusChange={setUserStatus} onExportAllData={handleExportAllData} onTriggerRestore={handleTriggerBackupImport} /></div>}
        
        <main className="flex-1 relative overflow-hidden w-full">
          {renderContent()}
        </main>
        
        {user && <div className="flex-none z-50"><Footer /></div>}
      </div>
    </>
  );
};

export default App;