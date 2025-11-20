



import type { LifeEvent, Tag, Media, PersonTag, PetTag, ThingTag, PlaceTag, EventTag, UnknownTag } from '../types';

const isInvalidDate = (date: any): boolean => {
    // Check if it's already a Date object and valid
    if (date instanceof Date && !isNaN(date.getTime())) {
        return false;
    }
    // Check if it can be parsed into a valid Date
    const parsedDate = new Date(date);
    return isNaN(parsedDate.getTime());
};

export const sanitizeEvent = (event: any): LifeEvent | null => {
    if (!event || typeof event !== 'object') {
        console.warn('Sanitizer discarded an invalid event record (was not an object):', event);
        return null;
    }

    if (isInvalidDate(event.date)) {
        console.warn('Sanitizer discarded an event with an invalid or missing date:', event);
        return null;
    }

    return {
        id: typeof event.id === 'string' && event.id ? event.id : `event-${Date.now()}-${Math.random()}`,
        title: typeof event.title === 'string' && event.title ? event.title : 'Untitled Event',
        date: new Date(event.date),
        details: typeof event.details === 'string' ? event.details : '',
        privateDetails: typeof event.privateDetails === 'string' ? event.privateDetails : undefined,
        isPrivateDetailsCloaked: typeof event.isPrivateDetailsCloaked === 'boolean' ? event.isPrivateDetailsCloaked : undefined,
        historical: typeof event.historical === 'string' ? event.historical : undefined,
        tagIds: Array.isArray(event.tagIds) ? event.tagIds.filter(id => typeof id === 'string') : [],
        mediaIds: Array.isArray(event.mediaIds) ? event.mediaIds.filter(id => typeof id === 'string') : [],
    };
};

export const sanitizeMedia = (media: any): Media | null => {
    if (!media || typeof media !== 'object') {
        console.warn('Sanitizer discarded an invalid media record (was not an object):', media);
        return null;
    }
    
    if (isInvalidDate(media.uploadDate)) {
        console.warn('Sanitizer discarded media with an invalid or missing uploadDate:', media);
        return null;
    }

    return {
        id: typeof media.id === 'string' && media.id ? media.id : `media-${Date.now()}-${Math.random()}`,
        url: typeof media.url === 'string' ? media.url : '',
        thumbnailUrl: typeof media.thumbnailUrl === 'string' ? media.thumbnailUrl : (typeof media.url === 'string' ? media.url : ''),
        caption: typeof media.caption === 'string' ? media.caption : '',
        uploadDate: new Date(media.uploadDate),
        fileType: typeof media.fileType === 'string' ? media.fileType : 'unknown',
        fileName: typeof media.fileName === 'string' ? media.fileName : undefined,
        size: typeof media.size === 'number' ? media.size : undefined,
        base64Data: typeof media.base64Data === 'string' ? media.base64Data : undefined,
        tagIds: Array.isArray(media.tagIds) ? media.tagIds.filter(id => typeof id === 'string') : [],
    };
};

export const sanitizeTag = (tag: any): Tag | null => {
    console.log(`[sanitizeTag] Attempting to sanitize tag:`, { id: tag?.id, name: tag?.name, type: tag?.type });
    if (!tag || typeof tag !== 'object') {
        console.warn('Sanitizer discarded an invalid tag record (was not an object):', tag);
        return null;
    }

    if (typeof tag.id !== 'string' || !tag.id || typeof tag.name !== 'string' || !tag.name) {
        console.warn('Sanitizer discarded tag with missing id or name:', tag);
        return null;
    }

    const baseTag = {
        id: tag.id,
        name: tag.name,
        mainImageId: typeof tag.mainImageId === 'string' ? tag.mainImageId : undefined,
        mediaGallery: Array.isArray(tag.mediaGallery) ? tag.mediaGallery : [],
        description: typeof tag.description === 'string' ? tag.description : '',
        privateNotes: typeof tag.privateNotes === 'string' ? tag.privateNotes : '',
        isPrivate: typeof tag.isPrivate === 'boolean' ? tag.isPrivate : false,
        tagIds: Array.isArray(tag.tagIds) ? tag.tagIds.filter((id: any) => typeof id === 'string') : [],
        mediaIds: Array.isArray(tag.mediaIds) ? tag.mediaIds.filter((id: any) => typeof id === 'string') : [],
    };
    
    const m = tag.metadata || {};

    switch (tag.type) {
        case 'person':
            return {
                ...baseTag,
                type: 'person',
                metadata: {
                    dates: m.dates || { birth: new Date().toISOString() },
                    gender: m.gender || 'Prefer not to say',
                    relationships: Array.isArray(m.relationships) ? m.relationships : [],
                    locations: Array.isArray(m.locations) ? m.locations : [],
                    contacts: Array.isArray(m.contacts) ? m.contacts : [],
                    emails: Array.isArray(m.emails) ? m.emails : [],
                    socials: Array.isArray(m.socials) ? m.socials : [],
                }
            } as PersonTag;
        case 'pet':
            return {
                ...baseTag,
                type: 'pet',
                metadata: {
                    species: typeof m.species === 'string' ? m.species : 'Unknown',
                    breed: typeof m.breed === 'string' ? m.breed : '',
                    dates: m.dates || { adoption: new Date().toISOString() },
                    medical: m.medical || { vetName: '', conditions: [] },
                    documents: Array.isArray(m.documents) ? m.documents : [],
                }
            } as PetTag;
        case 'thing':
            return {
                ...baseTag,
                type: 'thing',
                metadata: {
                   acquisition: m.acquisition || { date: new Date().toISOString(), cost: 0, sourceTagId: '' },
                   status: m.status || { currentVal: 0, condition: '', locationTagId: '' },
                   purpose: typeof m.purpose === 'string' ? m.purpose : '',
                }
            } as ThingTag;
        case 'place':
            return {
                ...baseTag,
                type: 'place',
                metadata: {
                    address: typeof m.address === 'string' ? m.address : '',
                    significance: typeof m.significance === 'string' ? m.significance : '',
                    coordinates: m.coordinates || { lat: 0, lng: 0 },
                }
            } as PlaceTag;
        case 'event':
             return { ...baseTag, type: 'event', metadata: m || {} } as EventTag;
        default:
             return { ...baseTag, type: 'unknown', metadata: m || {} } as UnknownTag;
    }
};


export const sanitizeAllEvents = (events: any[]): LifeEvent[] => {
    console.log(`[Validator] Sanitizing ${events?.length ?? 0} raw event records.`);
    if (!Array.isArray(events)) {
        console.error('[Validator] Raw events data is not an array. Aborting sanitization.', events);
        return [];
    }
    const sanitized: LifeEvent[] = [];
    for (const event of events) {
        try {
            const sanitizedEvent = sanitizeEvent(event);
            if (sanitizedEvent) {
                sanitized.push(sanitizedEvent);
            }
        } catch (error) {
            console.error('[Validator] CRITICAL: Error sanitizing a single event record. Skipping it.', { event, error });
        }
    }
    console.log(`[Validator] Sanitization complete. Returning ${sanitized.length} valid events.`);
    return sanitized;
};

export const sanitizeAllMedia = (media: any[]): Media[] => {
    console.log(`[Validator] Sanitizing ${media?.length ?? 0} raw media records.`);
    if (!Array.isArray(media)) {
        console.error('[Validator] Raw media data is not an array. Aborting sanitization.', media);
        return [];
    }
    const sanitized: Media[] = [];
    for (const item of media) {
        try {
            const sanitizedItem = sanitizeMedia(item);
            if (sanitizedItem) {
                sanitized.push(sanitizedItem);
            }
        } catch (error) {
            console.error('[Validator] CRITICAL: Error sanitizing a single media record. Skipping it.', { item, error });
        }
    }
    console.log(`[Validator] Sanitization complete. Returning ${sanitized.length} valid media items.`);
    return sanitized;
};

export const sanitizeAllTags = (tags: any[]): Tag[] => {
    console.log(`[Validator] Sanitizing ${tags?.length ?? 0} raw tag records.`);
    if (!Array.isArray(tags)) {
        console.error('[Validator] Raw tags data is not an array. Aborting sanitization.', tags);
        return [];
    }
    const sanitized: Tag[] = [];
    for (const tag of tags) {
        try {
            const sanitizedTag = sanitizeTag(tag);
            if (sanitizedTag) {
                sanitized.push(sanitizedTag);
            }
        } catch (error) {
            console.error('[Validator] CRITICAL: Error sanitizing a single tag record. Skipping it.', { tag, error });
        }
    }
    console.log(`[Validator] Sanitization complete. Returning ${sanitized.length} valid tags.`);
    return sanitized;
};