import React, { useState, useEffect, useRef } from 'react';
import type { Tag, Media } from '../../types';
import PersonForm from './PersonForm';
import PetForm from './PetForm';
import ThingForm from './ThingForm';
import PlaceForm from './PlaceForm';
import EventTagForm from './EventTagForm';
import { ChatIcon, UploadIcon } from '../icons';
import { blobToBase64, base64ToBlob } from '../../utils/fileUtils';

interface TagEditorModalProps {
    tag: Tag;
    allTags: Tag[];
    allMedia: Media[];
    onSave: (tag: Tag) => void;
    onSaveMedia: (media: Media) => void;
    onClose: () => void;
    onDiscuss: (tag: Tag) => void;
    createDefaultMetadata: (type: Tag['type']) => any;
}

type Tab = 'General' | 'Details' | 'Private' | 'Gallery' | 'Connections';

const TagEditorModal: React.FC<TagEditorModalProps> = ({ tag, allTags, allMedia, onSave, onSaveMedia, onClose, onDiscuss, createDefaultMetadata }) => {
    console.log(`[TagEditorModal] Component rendering. Received tag prop:`, tag);
    const [activeTab, setActiveTab] = useState<Tab>('General');
    const [formData, setFormData] = useState<Tag>(tag);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [isImageLoading, setIsImageLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const objectUrlRef = useRef<string | null>(null);
    
    useEffect(() => {
        setFormData(tag);
    }, [tag]);

    // This effect runs ONCE on mount and cleans up ONCE on unmount to prevent memory leaks.
    useEffect(() => {
        const ref = objectUrlRef;
        return () => {
            if (ref.current) {
                console.log(`[TagEditorModal.unmount] Revoking final object URL: ${ref.current}`);
                URL.revokeObjectURL(ref.current);
                ref.current = null;
            }
        };
    }, []);

    // This effect handles loading and changing the main image.
    useEffect(() => {
        if (!formData.name) return; // Guard against running with incomplete initial data

        console.log(`[TagEditorModal.useEffect] Image effect running for tag: ${formData.name}`);
        setIsImageLoading(true);

        const char = formData.name ? formData.name.charAt(0).toUpperCase() : '?';
        const safeChar = encodeURIComponent(char);
        const placeholder = `https://dummyimage.com/100x100/8b5cf6/ffffff.png&text=${safeChar}`;
        
        let mediaItem: Media | undefined;

        if (formData.mainImageId) {
            mediaItem = allMedia.find(m => m.id === formData.mainImageId);
        }

        if (mediaItem?.base64Data && mediaItem.fileType) {
            // Show placeholder immediately and schedule the heavy work.
            setImagePreviewUrl(placeholder);

            const timer = setTimeout(() => {
                console.log(`[TagEditorModal.setTimeout] Starting blocking decode for ${formData.name}`);
                try {
                    // This is a blocking operation, but it's deferred.
                    const blob = base64ToBlob(mediaItem!.base64Data!, mediaItem!.fileType!);
                    const newObjectUrl = URL.createObjectURL(blob);
                    
                    // Revoke the previous URL before setting the new one.
                    if (objectUrlRef.current) {
                        URL.revokeObjectURL(objectUrlRef.current);
                    }
                    
                    objectUrlRef.current = newObjectUrl;
                    setImagePreviewUrl(newObjectUrl);
                    console.log(`[TagEditorModal.setTimeout] Decode complete. New URL: ${newObjectUrl}`);
                } catch (error) {
                    console.error("Failed to create blob from base64:", error);
                    setImagePreviewUrl(placeholder);
                } finally {
                    setIsImageLoading(false);
                }
            }, 100); // 100ms delay to allow UI to render first.

            return () => clearTimeout(timer);
        } else {
            // No image data, just show the placeholder.
            console.log(`[TagEditorModal.useEffect] No media data. Using placeholder.`);
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
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
            url: '', // Object URL will be generated on the fly for display
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
        
        e.target.value = ''; // Allow re-uploading the same file
    };

    const renderDetailsForm = () => {
        console.log(`[TagEditorModal.renderDetailsForm] Rendering details form for type: ${formData.type}`);
        switch (formData.type) {
            case 'person':
                // FIX: Pass the required 'allTags' prop to the PersonForm component.
                return <PersonForm tag={formData} allTags={allTags} onMetadataChange={handleMetadataChange} />;
            case 'pet':
                return <PetForm tag={formData} onMetadataChange={handleMetadataChange} />;
            case 'thing':
                return <ThingForm tag={formData} onMetadataChange={handleMetadataChange} />;
            case 'place':
                return <PlaceForm tag={formData} onMetadataChange={handleMetadataChange} />;
            case 'event':
                return <EventTagForm tag={formData} onMetadataChange={handleMetadataChange} />;
            default:
                return <p>This tag type has no specific details to edit.</p>;
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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" role="dialog" aria-modal="true">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Tag: {formData.name}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
                </div>

                {/* Content */}
                <div className="flex-grow p-6 overflow-y-auto">
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

                    <div>
                        {activeTab === 'General' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tag Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={handleTypeChange}
                                        className={`mt-1 block w-full ${inputStyle}`}
                                    >
                                        <option value="unknown">Unknown</option>
                                        <option value="person">Person</option>
                                        <option value="pet">Pet</option>
                                        <option value="place">Place</option>
                                        <option value="thing">Thing</option>
                                        <option value="event">Event Category</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                                    <textarea rows={4} value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className={`mt-1 block w-full ${inputStyle}`} />
                                </div>
                            </div>
                        )}
                        {activeTab === 'Details' && renderDetailsForm()}
                        {activeTab === 'Private' && (
                             <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Private Notes</label>
                                    <textarea rows={4} value={formData.privateNotes} onChange={e => setFormData(prev => ({ ...prev, privateNotes: e.target.value }))} className={`mt-1 block w-full ${inputStyle}`} />
                                </div>
                                <div className="flex items-center">
                                    <input id="isPrivate" type="checkbox" checked={formData.isPrivate} onChange={e => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                                    <label htmlFor="isPrivate" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">Mark as Private (Hide in Reports)</label>
                                </div>
                            </div>
                        )}
                         {activeTab === 'Gallery' && <p className="text-center text-gray-500 dark:text-gray-400 p-4">Gallery editor coming soon.</p>}
                         {activeTab === 'Connections' && <p className="text-center text-gray-500 dark:text-gray-400 p-4">Connections editor coming soon.</p>}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <button onClick={() => onDiscuss(formData)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        <ChatIcon className="w-5 h-5" />
                        Discuss with Gigi
                    </button>
                    <div className="flex gap-4">
                         <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                         <button onClick={handleSave} className="px-6 py-2 bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default TagEditorModal;
