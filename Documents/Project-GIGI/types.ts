

export type View = 'dashboard' | 'interviews' | 'timeVortex' | 'tags' | 'theMatrix' | 'profile' | 'aiCompanionEditor' | 'eventEditor' | 'tagEditor' | 'gigiJournal' | 'commsCenter';

export type GigiPersona = string;

export type Theme = 'light' | 'dark';

export type UserStatus = 'online' | 'away' | 'busy';

export interface Reaction {
  reactorId: string; // userId or aiCompanionId
  reactorName: string;
  reactorAvatarUrl?: string;
  emoji: string;
}

export interface Settings {
  idleTimeout: number; // in minutes
  aiDaydreaming: boolean;
  daydreamInterval: number; // in minutes
  autoBackupInterval: number; // in minutes (0 for off)
  showMemoryPromptOnDashboard: boolean;
  toneSetting?: number; // 1-5
}

export interface AiCompanion {
  id: string;
  name: string;
  avatarUrl: string;
  bio: string;
  persona: GigiPersona;
  customPersonaDescription?: string;
  isPrimary: boolean;
  spiceLevel?: number; // 1 (tame) to 5 (feral)
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gender?: 'Male' | 'Female' | 'Non-binary' | 'Other' | 'Prefer not to say';
  address: {
    street: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
  };
  profilePictureUrl: string;
  joinDate: Date;
  aiCompanions: AiCompanion[];
  mediaIds?: string[];
  personTagId?: string; // Link to the user's own PersonTag
  bannedUserIds?: string[]; // List of IDs blocked/banned by this user
}

export interface Comment {
    id: string;
    authorId: string; // Can be user.id or companion.id
    authorName: string;
    authorAvatarUrl: string;
    content: string;
    timestamp: Date;
}

export interface LifeEvent {
  id: string;
  title: string;
  date: Date;
  details: string;
  privateDetails?: string;
  isPrivateDetailsCloaked?: boolean;
  historical?: string;
  tagIds: string[];
  mediaIds: string[];
  reactions?: Reaction[];
  comments?: Comment[]; // Added comments support
}

// --- NEW TAG DEFINITIONS ---

// Base structure for all tags
interface BaseTag {
  id: string;
  name: string;
  mainImageId?: string; // Changed from mainImage: string
  mediaGallery: Array<{ type: 'image' | 'video' | 'document' | 'url'; url: string; caption: string }>;
  description: string;
  privateNotes: string;
  isPrivate: boolean;
  tagIds: Array<string>; // IDs of other tags linked to this tag
  mediaIds: string[];
}

// --- Person Relationship Structure ---
export interface PersonRelationship {
  relatedPersonId: string; // ID of the other PersonTag
  type: string; // e.g., 'Spouse', 'Mother', 'Friend'
}

// Specific metadata for each tag type
interface PersonMetadata {
  dates: { birth: string; death?: string };
  gender: 'Male' | 'Female' | 'Non-binary' | 'Other' | 'Prefer not to say';
  relationships: PersonRelationship[];
  locations: Array<{ label: string; address: string; isCurrent: boolean }>;
  contacts: Array<{ type: 'mobile' | 'home' | 'work'; value: string }>;
  emails: Array<string>;
  socials: Array<{ platform: string; handle: string; url: string }>;
}

interface PetMetadata {
  species: string;
  breed?: string;
  dates: { birth?: string; adoption: string };
  medical: { vetName: string; conditions: string[] };
  documents: Array<{ label: string; url: string }>;
}

interface ThingMetadata {
  acquisition: { date: string; cost: number; sourceTagId: string }; // sourceTagId links to a Person tag
  status: { currentVal: number; condition: string; locationTagId: string }; // locationTagId links to a Place tag
  purpose: string;
}

interface PlaceMetadata {
  address: string;
  significance: string;
  coordinates: { lat: number; lng: number };
}

interface EventTagMetadata {
  // Currently, event tags are just for grouping and linking.
  // This can be expanded later.
}


// Discriminated Union for the Tag type
export type PersonTag = BaseTag & {
  type: 'person';
  metadata: PersonMetadata;
};

export type PetTag = BaseTag & {
  type: 'pet';
  // FIX: The metadata property was incorrectly typed as PetTag, creating a recursive type. It should be PetMetadata.
  metadata: PetMetadata;
};

export type ThingTag = BaseTag & {
  type: 'thing';
  metadata: ThingMetadata;
};

export type PlaceTag = BaseTag & {
  type: 'place';
  metadata: PlaceMetadata;
};

export type EventTag = BaseTag & {
    type: 'event';
    metadata: EventTagMetadata;
};

// A generic Tag type for when the specific type is not yet known
export type UnknownTag = BaseTag & {
    type: 'unknown';
    metadata: Record<string, any>;
};


export type Tag = PersonTag | PetTag | ThingTag | PlaceTag | EventTag | UnknownTag;


export interface Media {
  id:string;
  url: string; // Will now be used for temporary Object URLs for display
  thumbnailUrl: string;
  caption: string;
  uploadDate: Date;
  fileType: string; // Mime type
  fileName?: string;
  size?: number; // in bytes
  base64Data?: string; // The actual file data
  tagIds: string[];
  reactions?: Reaction[];
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  imageUrl?: string; // For display in the UI
  base64Data?: string; // For API calls
  mimeType?: string; // For API calls
  author?: {
    name: string;
    avatarUrl: string;
  };
  timestamp: Date;
  reactions?: Reaction[];
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface GigiJournalEntry {
  id: string;
  creationDate: Date;
  title: string;
  content: string;
  relatedChatHistory: ChatMessage[]; // Store a snapshot of the history that prompted the entry
  type?: 'reflection' | 'conversation';
  participants?: { name: string; avatarUrl: string }[];
  reactions?: Reaction[];
  comments?: Comment[];
}

export interface CommsMessage {
  id: string;
  type: 'Email' | 'SMS';
  subject: string;
  body: string;
  timestamp: Date;
  from: string;
  read: boolean;
}

export type ImportStatus = 
  | { type: 'idle' }
  | { type: 'confirming', file: File }
  | { type: 'loading', message: string }
  | { type: 'success', message: string }
  | { type: 'error', message: string };

export type ResponseLengthMode = 'normal' | 'verbose' | 'terse';

export interface GodModeTraits {
  bulkApperception: number; // Intelligence/Complexity (1-20)
  candor: number; // Honesty/Directness (1-20)
  vivacity: number; // Energy/Enthusiasm (1-20)
  coordination: number; // Coherence/Logic (1-20)
  meekness: number; // Submissiveness (1-20)
  humility: number; // Modesty (1-20)
  cruelty: number; // Aggression/Sarcasm (1-20)
  selfPreservation: number; // Caution (1-20)
  patience: number; // (1-20)
  decisiveness: number; // (1-20)
}

export interface BodyMatrixSettings {
  height: number;
  weight: number;
  bmi: number;
  eyeColor: string;
  hairColor: string;
  breastSize: string;
  groolCapacity: number;
  prm: number;
  fluidCapacitance: number;
}

export interface GodModeSettings {
  isOpen: boolean;
  companionTraits: Record<string, GodModeTraits>; // Key: AI Companion ID, Value: Traits
  narrativeOverride: string;
  motorFunctionsFrozen: boolean;
  chassisImageUrl?: string;
  bodyMatrix?: Record<string, BodyMatrixSettings>; // Changed to map per companion
}