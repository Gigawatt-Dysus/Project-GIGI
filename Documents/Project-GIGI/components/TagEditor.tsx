import React, { useState, useEffect, useRef } from 'react';
import type { Tag, Media } from '../types';
import PersonForm from './tags/PersonForm';
import PetForm from './tags/PetForm';
import ThingForm from './tags/ThingForm';
import PlaceForm from './tags/PlaceForm';
import EventTagForm from './tags/EventTagForm';
import { ChatIcon, UploadIcon } from './icons';
import { blobToBase64, base64ToBlob } from '../../utils/fileUtils';
import CopyButton from './CopyButton';

interface TagEditorProps {
    tag: Tag;
    allTags: Tag[];
    allMedia: Media[];
    onSave: (tag: Tag) => void;
    onSaveMedia: (media: Media) => void;
    onCancel: () => void;
    onDiscuss: (tag: Tag) => void;
    createDefaultMetadata: (type: Tag['type']) => any;
}

type Tab = 'General' | 'Details' | 'Private' | 'Gallery' | 'Connections';

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

const GalleryImage: React.FC<{ media: Media, onClick: () => void }> = ({ media, onClick }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const placeholder = `https://dummyimage.com/150x150/e9d5ff/4c1d95.png&text=?`;
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
                    console.error("Failed to create blob for gallery image", e);
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

    if (!imageUrl) {
        return <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />;
    }

    return (
        <button onClick={onClick} className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group relative focus:outline-none focus:ring-2 focus:ring-violet-500">
            <img src={imageUrl} alt={media.caption} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                <p className="text-white text-xs text-center line-clamp-3">{media.caption || media.fileName}</p>
            </div>
        </button>
    );
};

const TagEditor: React.FC<TagEditorProps> = ({ tag, allTags, allMedia, onSave, onSaveMedia, onCancel, onDiscuss, createDefaultMetadata }) => {
    const [activeTab, setActiveTab] = useState<Tab>('General');
    const [formData, setFormData] = useState<Tag>(tag);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [isImageLoading, setIsImageLoading] = useState(true);
    const [viewingMedia, setViewingMedia] = useState<Media | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const galleryFileInputRef = useRef<HTMLInputElement>(null);
    const objectUrlRef = useRef<string | null>(null);
    
    useEffect(() => {
        if (tag && tag.id !== formData.id) {
            setFormData(tag);
        }
    }, [tag, formData.id]);

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
        setIsImageLoading(true);

        const char = formData.name ? formData.name.charAt(0).toUpperCase() : '?';
        const safeChar = encodeURIComponent(char);
        const placeholder = `https://dummyimage.com/100x100/8b5cf6/ffffff.png&text=${safeChar}`;
        
        const mediaItem = formData.mainImageId ? allMedia.find(m => m.id === formData.mainImageId) : undefined;

        if (mediaItem?.base64Data && mediaItem.fileType) {
            setImagePreviewUrl(placeholder);
            setTimeout(() => {
                try {
                    const blob = base64ToBlob(mediaItem!.base64Data!, mediaItem!.fileType!);
                    const newObjectUrl = URL.createObjectURL(blob);
                    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = newObjectUrl;
                    setImagePreviewUrl(newObjectUrl);
                } catch (error) {
                    console.error("Failed to create blob from base64:", error);
                    setImagePreviewUrl(placeholder);
                } finally {
                    setIsImageLoading(false);
                }
            }, 100);
        } else {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
            setImagePreviewUrl(placeholder);
            setIsImageLoading(false);
        }
    }, [formData.mainImageId, formData.name, allMedia]);
    

    const handleSave = () => {
        onSave(formData);
    };

    const handleMetadataChange = (metadata: any) => {
        setFormData(prev => ({ ...prev, metadata }));
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value as Tag['type'];
        setFormData(prev => ({
            ...prev,
            type: newType,
            metadata: createDefaultMetadata(newType),
        }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const base64Data = await blobToBase64(file);
        const newMedia: Media = {
            id: `media-${tag.id}-${Date.now()}`,
            url: '',
            thumbnailUrl: '',
            caption: `Main image for tag: ${formData.name}`,
            uploadDate: new Date(),
            fileType: file.type,
            fileName: file.name,
            size: file.size,
            base64Data,
            tagIds: [tag.id],
        };

        onSaveMedia(newMedia);
        setFormData(prev => ({ ...prev, mainImageId: newMedia.id }));
        e.target.value = '';
    };

    const handleGalleryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
    
        const newMediaIds: string[] = [];
    
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;

            const base64Data = await blobToBase64(file);
            const newMedia: Media = {
                id: `media-${tag.id}-gallery-${Date.now()}-${Math.random()}`,
                url: '',
                thumbnailUrl: '',
                caption: file.name,
                uploadDate: new Date(),
                fileType: file.type,
                fileName: file.name,
                size: file.size,
                base64Data,
                tagIds: [tag.id],
            };
    
            onSaveMedia(newMedia);
            newMediaIds.push(newMedia.id);
        }
    
        setFormData(prev => ({
            ...prev,
            mediaIds: [...(prev.mediaIds || []), ...newMediaIds]
        }));
    
        e.target.value = '';
    };

    const renderDetailsForm = () => {
        switch (formData.type) {
            case 'person': return <PersonForm tag={formData} allTags={allTags} onMetadataChange={handleMetadataChange} />;
            case 'pet': return <PetForm tag={formData} onMetadataChange={handleMetadataChange} />;
            case 'thing': return <ThingForm tag={formData} onMetadataChange={handleMetadataChange} />;
            case 'place': return <PlaceForm tag={formData} onMetadataChange={handleMetadataChange} />;
            case 'event': return <EventTagForm tag={formData} onMetadataChange={handleMetadataChange} />;
            default: return <p>This tag type has no specific details to edit.</p>;
        }
    };
    
    const TabButton: React.FC<{ tabName: Tab }> = ({ tabName }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tabName 
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' 
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
        >
            {tabName}
        </button>
    );
    
    const inputStyle = "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent sm:text-sm text-gray-900 dark:text-white";

    const tagMedia = (formData.mediaIds || [])
        .map(id => allMedia.find(m => m.id === id))
        .filter((m): m is Media => !!m);

    return (
        <div className="max-w-4xl mx-auto">
             {viewingMedia && <Lightbox mediaItem={viewingMedia} onClose={() => setViewingMedia(null)} />}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Edit Tag</h1>
                <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">Refine the details of this item in your archive.</p>
            </div>

            <div className="bg-white/80 dark:bg-gray-800/50 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-4 mb-6">
                    <div className="flex-shrink-0 text-center">
                        {isImageLoading || !imagePreviewUrl ? (
                            <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        ) : (
                            <img src={imagePreviewUrl} alt={formData.name} className="w-24 h-24 rounded-full object-cover bg-gray-200 dark:bg-gray-700"/>
                        )}
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                         <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-sm text-violet-600 dark:text-violet-400 hover:underline">Change</button>
                    </div>
                    <div className="flex-grow">
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tag Name</label>
                         <input 
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
                            className={`mt-1 block w-full text-lg ${inputStyle}`}
                         />
                    </div>
                </div>
                
                <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                    <nav className="flex space-x-2">
                       <TabButton tabName="General" />
                       <TabButton tabName="Details" />
                       <TabButton tabName="Private" />
                       <TabButton tabName="Gallery" />
                       <TabButton tabName="Connections" />
                    </nav>
                </div>

                <div className="min-h-[250px]">
                    {activeTab === 'General' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tag Type</label>
                                <select value={formData.type} onChange={handleTypeChange} className={`mt-1 block w-full ${inputStyle}`}>
                                    <option value="unknown">Unknown</option>
                                    <option value="person">Person</option>
                                    <option value="pet">Pet</option>
                                    <option value="place">Place</option>
                                    <option value="thing">Thing</option>
                                    <option value="event">Event Category</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                                    <CopyButton textToCopy={formData.description} />
                                </div>
                                <textarea rows={4} value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className={`mt-1 block w-full ${inputStyle}`} />
                            </div>
                        </div>
                    )}
                    {activeTab === 'Details' && renderDetailsForm()}
                    {activeTab === 'Private' && (
                         <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Private Notes</label>
                                    <CopyButton textToCopy={formData.privateNotes} />
                                </div>
                                <textarea rows={4} value={formData.privateNotes} onChange={e => setFormData(prev => ({ ...prev, privateNotes: e.target.value }))} className={`mt-1 block w-full ${inputStyle}`} />
                            </div>
                            <div className="flex items-center">
                                <input id="isPrivate" type="checkbox" checked={formData.isPrivate} onChange={e => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                                <label htmlFor="isPrivate" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">Mark as Private (Hide in Reports)</label>
                            </div>
                        </div>
                    )}
                     {activeTab === 'Gallery' && (
                        <div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mb-4">
                                {tagMedia.map(media => (
                                    <GalleryImage key={media.id} media={media} onClick={() => setViewingMedia(media)} />
                                ))}
                            </div>
                            <input
                                type="file"
                                multiple
                                ref={galleryFileInputRef}
                                onChange={handleGalleryFileChange}
                                className="hidden"
                                accept="image/*,video/*,.pdf,.doc,.docx"
                            />
                            <button
                                type="button"
                                onClick={() => galleryFileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition"
                            >
                                <UploadIcon className="w-5 h-5" />
                                <span>Upload Images, Videos, or Documents</span>
                            </button>
                        </div>
                     )}
                     {activeTab === 'Connections' && <p className="text-center text-gray-500 dark:text-gray-400 p-4">Connections editor coming soon.</p>}
                </div>

                <div className="p-4 mt-6 -mx-8 -mb-8 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                    <button onClick={() => onDiscuss(formData)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        <ChatIcon className="w-5 h-5" />
                        Discuss with Gigi
                    </button>
                    <div className="flex gap-4">
                         <button onClick={onCancel} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                         <button onClick={handleSave} className="px-6 py-2 bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default TagEditor;