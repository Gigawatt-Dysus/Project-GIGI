import React, { useState, useRef, useEffect } from 'react';
import type { User, View, AiCompanion, GigiPersona } from '../types';
import { ImageCropper } from './ImageCropper';
import { PlusIcon, PencilIcon, TrashIcon } from './icons';
import { GIGI_AVATAR_URL } from '../services/mockData';

interface AiCompanionsManagerProps {
  user: User;
  onUserUpdate: (user: User) => void;
  onNavigate: (view: View) => void;
}

// Sub-component for the editor form
const AiCompanionEditorForm: React.FC<{
    companion: AiCompanion,
    onSave: (companion: AiCompanion) => void,
    onCancel: () => void
}> = ({ companion, onSave, onCancel }) => {
    const [formData, setFormData] = useState<AiCompanion>(companion);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImageToCrop(reader.result as string);
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleCropComplete = (croppedImageUrl: string) => {
        setFormData(prev => ({...prev, avatarUrl: croppedImageUrl}));
        setImageToCrop(null);
    };

    const handleSaveChanges = () => {
        onSave(formData);
    };

    const spiceLabels: { [key: number]: string } = {
        1: "G (Tame)",
        2: "PG",
        3: "R (Mature)",
        4: "NC-17 (Explicit)",
        5: "X (Feral)",
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             {imageToCrop && (
                <ImageCropper 
                imageSrc={imageToCrop}
                onCropComplete={handleCropComplete}
                onCancel={() => setImageToCrop(null)}
                />
            )}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                     <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {companion.id.startsWith('new-') ? 'Create New AI Companion' : `Edit ${companion.name}`}
                    </h2>
                </div>
                <div className="flex-grow p-6 space-y-6 overflow-y-auto">
                    <div className="flex flex-col md:flex-row items-start gap-8">
                        <div className="flex-shrink-0 flex flex-col items-center w-full md:w-auto">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Avatar</h3>
                            <img src={formData.avatarUrl} alt="Avatar Preview" className="w-40 h-40 rounded-full object-cover shadow-md mb-4 ai-avatar-glow"/>
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleProfilePicChange} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm font-medium text-violet-700 bg-violet-100 rounded-md hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-300">Change Image</button>
                        </div>
                        <div className="w-full space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className="mt-1 block w-full md:max-w-md px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-violet-500"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">About (Bio)</label>
                                <textarea rows={3} value={formData.bio} onChange={(e) => setFormData(p => ({...p, bio: e.target.value}))} className="w-full shadow-sm sm:text-sm rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-violet-500"/>
                            </div>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Persona</label>
                         <select value={formData.persona} onChange={e => setFormData(p => ({...p, persona: e.target.value as GigiPersona}))} className="mt-1 block w-full pl-3 pr-10 py-2 text-base rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-violet-500">
                            <option value="buddy">Buddy</option>
                            <option value="sister">Sister</option>
                            <option value="aunt">Aunt</option>
                            <option value="grandmother">Grandmother</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="spiceLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Spice Level</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">Controls the AI's content filtering and willingness to use mature language.</p>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                id="spiceLevel"
                                min="1"
                                max="5"
                                value={formData.spiceLevel || 1}
                                onChange={e => setFormData(p => ({ ...p, spiceLevel: parseInt(e.target.value) }))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                            <span className="font-semibold text-gray-700 dark:text-gray-300 w-32 text-center">{spiceLabels[formData.spiceLevel || 1]}</span>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Custom Persona Description (Core Instructions)</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">Used if 'Custom' persona is selected. This is the primary prompt that defines the AI's personality, rules, and behavior.</p>
                        <textarea rows={8} value={formData.customPersonaDescription} onChange={(e) => setFormData(p => ({...p, customPersonaDescription: e.target.value}))} className="w-full shadow-sm sm:text-sm rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-violet-500 font-mono"/>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4 bg-gray-50 dark:bg-gray-800/50">
                    <button onClick={onCancel} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                    <button onClick={handleSaveChanges} className="px-6 py-2 bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700">Save Changes</button>
                </div>
            </div>
        </div>
    );
}

const AiCompanionsManager: React.FC<AiCompanionsManagerProps> = ({ user, onUserUpdate, onNavigate }) => {
    const [editingCompanion, setEditingCompanion] = useState<AiCompanion | null>(null);

    const handleCreateNew = () => {
        setEditingCompanion({
            id: `new-${Date.now()}`,
            name: 'New Companion',
            avatarUrl: GIGI_AVATAR_URL,
            bio: '',
            persona: 'buddy',
            isPrimary: false,
            spiceLevel: 1, // Default to G
        });
    };

    const handleSave = (companionToSave: AiCompanion) => {
        const existingIndex = user.aiCompanions.findIndex(c => c.id === companionToSave.id);
        let updatedCompanions;

        if (existingIndex > -1) {
            updatedCompanions = user.aiCompanions.map(c => c.id === companionToSave.id ? companionToSave : c);
        } else {
            updatedCompanions = [...user.aiCompanions, companionToSave];
        }

        onUserUpdate({ ...user, aiCompanions: updatedCompanions });
        setEditingCompanion(null);
    };

    const handleDelete = (companionId: string) => {
        if (window.confirm("Are you sure you want to delete this AI companion? This action cannot be undone.")) {
            const updatedCompanions = user.aiCompanions.filter(c => c.id !== companionId);
            onUserUpdate({ ...user, aiCompanions: updatedCompanions });
        }
    };


  return (
    <div className="max-w-4xl mx-auto">
        {editingCompanion && <AiCompanionEditorForm companion={editingCompanion} onSave={handleSave} onCancel={() => setEditingCompanion(null)} />}
        <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">AI Companions</h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">Manage the AI personalities that help you build your archive.</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/50 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Your AIs</h2>
                <button onClick={handleCreateNew} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg shadow-sm hover:bg-violet-700">
                    <PlusIcon className="w-5 h-5"/> Create New
                </button>
            </div>
            <div className="space-y-3">
                {user.aiCompanions.map(companion => (
                    <div key={companion.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div className="flex items-center gap-4">
                            <img src={companion.avatarUrl} alt={companion.name} className="w-12 h-12 rounded-full object-cover ai-avatar-glow"/>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">{companion.name} {companion.isPrimary && <span className="text-xs text-violet-500">(Primary)</span>}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{companion.persona}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={() => setEditingCompanion(companion)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="Edit">
                                <PencilIcon className="w-5 h-5 text-gray-600 dark:text-gray-300"/>
                            </button>
                            {!companion.isPrimary && (
                                <button onClick={() => handleDelete(companion.id)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="Delete">
                                    <TrashIcon className="w-5 h-5 text-red-500 dark:text-red-400"/>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default AiCompanionsManager;