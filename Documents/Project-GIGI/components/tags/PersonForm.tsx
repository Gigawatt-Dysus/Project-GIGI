import React, { useState } from 'react';
import type { PersonTag, Tag, PersonRelationship } from '../../types';
import { calculateAge } from '../../utils/ageCalculator';
import { PlusIcon } from '../icons';

interface PersonFormProps {
    tag: PersonTag;
    allTags: Tag[];
    onMetadataChange: (metadata: PersonTag['metadata']) => void;
}

const PersonForm: React.FC<PersonFormProps> = ({ tag, allTags, onMetadataChange }) => {
    const [newRelationship, setNewRelationship] = useState<{ relatedPersonId: string; type: string }>({ relatedPersonId: '', type: '' });
    
    const age = calculateAge(tag.metadata.dates.birth);
    const inputStyle = "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent sm:text-sm text-gray-900 dark:text-white";

    // Safely format date strings for input fields
    const getFormattedDate = (dateString: string | undefined | null): string => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    const handleAddRelationship = () => {
        if (newRelationship.relatedPersonId && newRelationship.type) {
            const updatedRelationships = [...tag.metadata.relationships, newRelationship];
            onMetadataChange({ ...tag.metadata, relationships: updatedRelationships });
            setNewRelationship({ relatedPersonId: '', type: '' });
        }
    };

    const handleRemoveRelationship = (index: number) => {
        const updatedRelationships = tag.metadata.relationships.filter((_, i) => i !== index);
        onMetadataChange({ ...tag.metadata, relationships: updatedRelationships });
    };

    const personOptions = allTags.filter(t => t.type === 'person' && t.id !== tag.id);
    const tagMap = new Map(allTags.map(t => [t.id, t.name]));

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Birthday</label>
                    <input type="date" value={getFormattedDate(tag.metadata.dates.birth)} onChange={e => onMetadataChange({ ...tag.metadata, dates: { ...tag.metadata.dates, birth: e.target.value } })} className={`mt-1 block w-full ${inputStyle}`} />
                    {age !== null && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Age: {age}</p>}
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Passing</label>
                    <input type="date" value={getFormattedDate(tag.metadata.dates.death)} onChange={e => onMetadataChange({ ...tag.metadata, dates: { ...tag.metadata.dates, death: e.target.value } })} className={`mt-1 block w-full ${inputStyle}`} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                    <select value={tag.metadata.gender} onChange={e => onMetadataChange({ ...tag.metadata, gender: e.target.value as PersonTag['metadata']['gender'] })} className={`mt-1 block w-full ${inputStyle}`}>
                        <option>Prefer not to say</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Non-binary</option>
                        <option>Other</option>
                    </select>
                </div>
            </div>
            
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100">Relationships</h4>
                <div className="mt-2 space-y-2">
                    {tag.metadata.relationships.map((rel, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                            <p className="text-sm text-gray-800 dark:text-gray-200">
                                <span className="font-semibold">{tagMap.get(rel.relatedPersonId) || 'Unknown Person'}</span> is the <span className="font-semibold">{rel.type}</span>
                            </p>
                            <button type="button" onClick={() => handleRemoveRelationship(index)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold">&times;</button>
                        </div>
                    ))}
                    {tag.metadata.relationships.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No relationships defined.</p>}
                </div>
                <div className="mt-4 p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                     <h5 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Add New Relationship</h5>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                        <select
                            value={newRelationship.relatedPersonId}
                            onChange={e => setNewRelationship(p => ({...p, relatedPersonId: e.target.value}))}
                            className={`flex-grow w-full ${inputStyle}`}
                        >
                            <option value="">Select a person...</option>
                            {personOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input
                            type="text"
                            placeholder="Relationship (e.g., Mother)"
                            value={newRelationship.type}
                            onChange={e => setNewRelationship(p => ({...p, type: e.target.value}))}
                            className={`flex-grow w-full ${inputStyle}`}
                        />
                        <button type="button" onClick={handleAddRelationship} className="p-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:bg-violet-300 w-full sm:w-auto">
                            <PlusIcon className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            </div>
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-2">(Locations, Contacts, and Socials editor coming soon)</p>
        </div>
    );
};
export default PersonForm;