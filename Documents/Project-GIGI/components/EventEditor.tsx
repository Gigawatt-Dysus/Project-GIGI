import React, { useState, useEffect } from 'react';
import type { LifeEvent, Tag, Media } from '../types';
import { TrashIcon, PlusIcon } from './icons';
import CopyButton from './CopyButton';

interface EventEditorProps {
    event: LifeEvent;
    allTags: Tag[];
    allMedia: Media[];
    onSave: (event: LifeEvent) => void;
    onDelete: (eventId: string) => void;
    onCreateTag: (tagName: string, tagType: Tag['type']) => Promise<Tag>;
    onCancel: () => void;
}

const EventEditor: React.FC<EventEditorProps> = ({ event, allTags, allMedia, onSave, onDelete, onCreateTag, onCancel }) => {
    const [formData, setFormData] = useState<LifeEvent>(event);
    const [tagInput, setTagInput] = useState('');
    const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);

    useEffect(() => {
        // Only update the form data if the event ID in the prop is different from the one in the state.
        // This prevents parent component re-renders from overwriting user input while they are typing.
        if(event && event.id !== formData.id) {
            setFormData(event);
        }
    }, [event, formData.id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateString = e.target.value;
        const date = new Date(dateString);
        // Adjust for timezone offset to prevent date from changing
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        setFormData(prev => ({ ...prev, date: adjustedDate }));
    };

    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setTagInput(value);
        if (value) {
            const suggestions = allTags.filter(tag => 
                tag.name.toLowerCase().includes(value.toLowerCase()) && 
                !formData.tagIds.includes(tag.id)
            );
            setTagSuggestions(suggestions.slice(0, 5));
        } else {
            setTagSuggestions([]);
        }
    };

    const addTag = (tag: Tag) => {
        if (!formData.tagIds.includes(tag.id)) {
            setFormData(prev => ({ ...prev, tagIds: [...prev.tagIds, tag.id] }));
        }
        setTagInput('');
        setTagSuggestions([]);
    };

    const createAndAddTag = async () => {
        if (tagInput.trim() && !allTags.some(t => t.name.toLowerCase() === tagInput.trim().toLowerCase())) {
            // In a real app, you might prompt for a tag type
            const newTag = await onCreateTag(tagInput.trim(), 'unknown');
            addTag(newTag);
        }
    };

    const removeTag = (tagId: string) => {
        setFormData(prev => ({ ...prev, tagIds: prev.tagIds.filter(id => id !== tagId) }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const eventTags = allTags.filter(t => formData.tagIds.includes(t.id));
    const eventMedia = allMedia.filter(m => formData.mediaIds.includes(m.id));
    const inputStyle = "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent sm:text-sm text-gray-900 dark:text-white";


    return (
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-white/80 dark:bg-gray-800/50 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{event.id.startsWith('event-') ? 'Create New Event' : 'Edit Event'}</h1>
                <p className="mt-1 text-gray-600 dark:text-gray-300">Fill in the details of your memory below.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                    <input type="text" id="title" value={formData.title} onChange={handleInputChange} required className={`mt-1 block w-full ${inputStyle}`} />
                </div>
                <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                    <input type="date" id="date" value={formData.date.toISOString().split('T')[0]} onChange={handleDateChange} required className={`mt-1 block w-full ${inputStyle}`} />
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center">
                    <label htmlFor="details" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Details</label>
                    <CopyButton textToCopy={formData.details} />
                </div>
                <textarea id="details" rows={5} value={formData.details} onChange={handleInputChange} className={`mt-1 block w-full ${inputStyle}`} placeholder="Describe what happened..."></textarea>
            </div>

            <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                    {eventTags.map(tag => (
                        <span key={tag.id} className="flex items-center gap-2 bg-violet-100 text-violet-800 text-sm font-medium px-2.5 py-1 rounded-full dark:bg-violet-900 dark:text-violet-300">
                            {tag.name}
                            <button type="button" onClick={() => removeTag(tag.id)} className="text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-200">&times;</button>
                        </span>
                    ))}
                </div>
                <div className="relative">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={tagInput}
                            onChange={handleTagInputChange}
                            placeholder="Add a person, place, or thing..."
                            className={`w-full ${inputStyle}`}
                        />
                        <button type="button" onClick={createAndAddTag} className="p-2 bg-violet-600 text-white rounded-md hover:bg-violet-700"><PlusIcon className="w-5 h-5"/></button>
                    </div>
                    {tagSuggestions.length > 0 && (
                        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                            {tagSuggestions.map(tag => (
                                <li key={tag.id} onClick={() => addTag(tag)} className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">{tag.name}</li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            
            {eventMedia.length > 0 && (
                 <div>
                    <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">Associated Media</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {eventMedia.map(mediaItem => (
                            <img key={mediaItem.id} src={mediaItem.thumbnailUrl} alt={mediaItem.caption} className="rounded-lg object-cover w-full h-20"/>
                        ))}
                    </div>
                </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-5 flex items-center justify-between">
                <button type="button" onClick={() => onDelete(event.id)} className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline">
                    <TrashIcon className="w-4 h-4" /> Delete Event
                </button>
                <div className="flex items-center gap-4">
                    <button type="button" onClick={onCancel} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700">Save Changes</button>
                </div>
            </div>
        </form>
    );
};

export default EventEditor;