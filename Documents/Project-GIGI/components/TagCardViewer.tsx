import React, { useState, useEffect, useRef } from 'react';
import type { Tag, Media, PersonTag, PetTag, PlaceTag, ThingTag } from '../types';
import { base64ToBlob } from '../utils/fileUtils';
import { calculateAge } from '../utils/ageCalculator';
import { PencilIcon, ChatIcon } from './icons';
import { TagTypeBadge } from './TagGallery';

interface TagCardViewerProps {
    tag: Tag;
    allMedia: Media[];
    onClose: () => void;
    onEdit: (tag: Tag) => void;
    onDiscuss: (tag: Tag) => void;
}

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-md text-gray-800 dark:text-gray-200 font-semibold">{value || 'N/A'}</p>
    </div>
);

const PersonDetails: React.FC<{ tag: PersonTag }> = ({ tag }) => {
    const age = calculateAge(tag.metadata.dates.birth);
    return (
        <div className="grid grid-cols-2 gap-4">
            <DetailItem label="Birthday" value={new Date(tag.metadata.dates.birth).toLocaleDateString()} />
            {age !== null && <DetailItem label="Age" value={age} />}
            {tag.metadata.dates.death && <DetailItem label="Passed Away" value={new Date(tag.metadata.dates.death).toLocaleDateString()} />}
            <DetailItem label="Gender" value={tag.metadata.gender} />
        </div>
    );
};
const PetDetails: React.FC<{ tag: PetTag }> = ({ tag }) => (
    <div className="grid grid-cols-2 gap-4">
        <DetailItem label="Species" value={tag.metadata.species} />
        {tag.metadata.breed && <DetailItem label="Breed" value={tag.metadata.breed} />}
        <DetailItem label="Adoption Date" value={new Date(tag.metadata.dates.adoption).toLocaleDateString()} />
    </div>
);
const PlaceDetails: React.FC<{ tag: PlaceTag }> = ({ tag }) => (
    <div className="space-y-4">
        <DetailItem label="Address" value={tag.metadata.address} />
        <DetailItem label="Significance" value={tag.metadata.significance} />
    </div>
);
const ThingDetails: React.FC<{ tag: ThingTag }> = ({ tag }) => (
    <div className="space-y-4">
        <DetailItem label="Purpose" value={tag.metadata.purpose} />
        <DetailItem label="Acquired" value={new Date(tag.metadata.acquisition.date).toLocaleDateString()} />
    </div>
);

const GalleryItem: React.FC<{ media: Media, onClick: () => void }> = ({ media, onClick }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const placeholder = 'https://dummyimage.com/150x150/e9d5ff/4c1d95.png&text=?';
        let isMounted = true;

        const generateUrl = async () => {
            if (media.base64Data && media.fileType) {
                try {
                    const blob = base64ToBlob(media.base64Data, media.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = newUrl;
                    if (isMounted) setImageUrl(newUrl);
                } catch (e) {
                    console.error("Failed to create blob for gallery item", e);
                    if (isMounted) setImageUrl(placeholder);
                }
            } else {
                if (isMounted) setImageUrl(media.thumbnailUrl || media.url || placeholder);
            }
        };
        generateUrl();

        return () => {
            isMounted = false;
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [media]);

    return (
        <button onClick={onClick} className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden relative group bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500">
            {imageUrl ? <img src={imageUrl} alt={media.caption} className="w-full h-full object-cover" /> : <div className="w-full h-full animate-pulse" />}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                <p className="text-white text-xs text-center line-clamp-4">{media.caption || media.fileName}</p>
            </div>
        </button>
    );
};

const Lightbox: React.FC<{ mediaItem: Media; onClose: () => void; }> = ({ mediaItem, onClose }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        const placeholder = 'https://dummyimage.com/800x600/e9d5ff/4c1d95.png&text=Loading...';
        setImageUrl(placeholder);

        const generateUrl = () => {
            if (mediaItem.base64Data && mediaItem.fileType) {
                try {
                    const blob = base64ToBlob(mediaItem.base64Data, mediaItem.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = newUrl;
                    setImageUrl(newUrl);
                } catch (e) { console.error("Error creating lightbox blob", e); }
            } else {
                setImageUrl(mediaItem.url || mediaItem.thumbnailUrl || placeholder);
            }
        };
        generateUrl();

        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [mediaItem]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white text-4xl leading-none font-bold hover:text-gray-300 z-10">&times;</button>
            <div className="relative max-w-5xl max-h-[90vh] w-full h-full" onClick={e => e.stopPropagation()}>
                {imageUrl ? <img src={imageUrl} alt={mediaItem.caption} className="max-w-full max-h-full object-contain mx-auto" /> : <div className="w-full h-full bg-gray-700 animate-pulse rounded-lg"/>}
                 {mediaItem.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-center text-white text-sm">{mediaItem.caption}</div>}
            </div>
        </div>
    );
};

const TagCardViewer: React.FC<TagCardViewerProps> = ({ tag, allMedia, onClose, onEdit, onDiscuss }) => {
    const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);
    const [viewingMedia, setViewingMedia] = useState<Media | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        const ref = objectUrlRef;
        return () => {
            if (ref.current) {
                URL.revokeObjectURL(ref.current);
                ref.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const char = tag.name ? tag.name.charAt(0).toUpperCase() : '?';
        const safeChar = encodeURIComponent(char);
        const placeholder = `https://dummyimage.com/200x200/8b5cf6/ffffff.png&text=${safeChar}`;
        setMainImageUrl(placeholder);

        const mediaItem = tag.mainImageId ? allMedia.find(m => m.id === tag.mainImageId) : undefined;
        if (mediaItem?.base64Data && mediaItem.fileType) {
            setTimeout(() => {
                try {
                    const blob = base64ToBlob(mediaItem.base64Data, mediaItem.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = newUrl;
                    setMainImageUrl(newUrl);
                } catch (e) { console.error("Error creating main image blob", e); }
            }, 50);
        }
    }, [tag, allMedia]);

    const handleEdit = () => {
        onClose();
        onEdit(tag);
    };
    const handleDiscuss = () => {
        onClose();
        onDiscuss(tag);
    };

    const getDisplayType = (tag: Tag): string => {
        if (tag.type === 'person' && tag.metadata.relationships && tag.metadata.relationships.length > 0) {
            // Simple logic: return the first relationship type. Can be made more sophisticated later.
            return tag.metadata.relationships[0].type;
        }
        return tag.type.charAt(0).toUpperCase() + tag.type.slice(1);
    };

    const renderDetails = () => {
        switch (tag.type) {
            case 'person': return <PersonDetails tag={tag} />;
            case 'pet': return <PetDetails tag={tag} />;
            case 'place': return <PlaceDetails tag={tag} />;
            case 'thing': return <ThingDetails tag={tag} />;
            default: return <p className="text-sm text-gray-500 dark:text-gray-400 italic">No specific details available for this tag type.</p>;
        }
    };
    
    const galleryMedia = (tag.mediaIds || []).map(id => allMedia.find(m => m.id === id)).filter((m): m is Media => !!m);

    return (
        <>
            {viewingMedia && <Lightbox mediaItem={viewingMedia} onClose={() => setViewingMedia(null)} />}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/20 dark:border-gray-700" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                    {/* New Header */}
                    <div className="relative p-4 bg-gray-900/80 text-white rounded-t-2xl flex items-center justify-between">
                        <h1 className="text-2xl font-bold">{tag.name}</h1>
                        <span className="text-sm font-semibold uppercase tracking-wider bg-white/10 px-3 py-1 rounded-full">{getDisplayType(tag)}</span>
                    </div>

                    <div className="flex-grow p-6 overflow-y-auto space-y-6">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                            <div className="flex-shrink-0">
                                {mainImageUrl ? <img src={mainImageUrl} alt={tag.name} className="w-32 h-32 rounded-full object-cover shadow-lg border-4 border-white dark:border-gray-700" /> : <div className="w-32 h-32 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />}
                            </div>
                            <div className="flex-grow text-center sm:text-left">
                                <p className="text-gray-600 dark:text-gray-300">{tag.description || <span className="italic">No description provided.</span>}</p>
                                <div className="mt-4 flex justify-center sm:justify-start gap-2">
                                    <button onClick={handleEdit} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                        <PencilIcon className="w-4 h-4" /> Edit
                                    </button>
                                    <button onClick={handleDiscuss} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                        <ChatIcon className="w-4 h-4" /> Discuss
                                    </button>
                                </div>
                            </div>
                        </div>
                    
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700/50 pb-2">Details</h3>
                            {renderDetails()}
                        </div>

                        {galleryMedia.length > 0 && <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700/50 pb-2">Gallery</h3>
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6">
                                {galleryMedia.map(media => <GalleryItem key={media.id} media={media} onClick={() => setViewingMedia(media)} />)}
                            </div>
                        </div>}

                    </div>

                    <div className="p-4 border-t border-gray-200 dark:border-gray-700/50 flex justify-end bg-gray-50/50 dark:bg-gray-900/50 rounded-b-2xl">
                        <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Close</button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TagCardViewer;