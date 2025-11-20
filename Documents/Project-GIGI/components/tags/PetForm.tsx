import React from 'react';
import type { PetTag } from '../../types';
import { calculateAge } from '../../utils/ageCalculator';

interface PetFormProps {
    tag: PetTag;
    onMetadataChange: (metadata: PetTag['metadata']) => void;
}

const PetForm: React.FC<PetFormProps> = ({ tag, onMetadataChange }) => {
    const age = calculateAge(tag.metadata.dates.birth || tag.metadata.dates.adoption);
    const inputStyle = "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent sm:text-sm text-gray-900 dark:text-white";

    // Safely format date strings for input fields
    const getFormattedDate = (dateString: string | undefined | null): string => {
        if (!dateString) return '';
        try {
            // Attempt to create a date and extract the YYYY-MM-DD part
            return new Date(dateString).toISOString().split('T')[0];
        } catch (e) {
            // If the date string is invalid, return an empty string
            return '';
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Species</label>
                <input 
                    type="text"
                    placeholder="e.g., Dog, Cat"
                    value={tag.metadata.species}
                    onChange={e => onMetadataChange({ ...tag.metadata, species: e.target.value })}
                    className={`mt-1 block w-full ${inputStyle}`}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Breed</label>
                <input 
                    type="text"
                    placeholder="e.g., Golden Retriever"
                    value={tag.metadata.breed || ''}
                    onChange={e => onMetadataChange({ ...tag.metadata, breed: e.target.value })}
                    className={`mt-1 block w-full ${inputStyle}`}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Adoption Date</label>
                <input 
                    type="date"
                    value={getFormattedDate(tag.metadata.dates.adoption)}
                    onChange={e => onMetadataChange({ ...tag.metadata, dates: { ...tag.metadata.dates, adoption: e.target.value } })}
                    className={`mt-1 block w-full ${inputStyle}`}
                />
                 {age !== null && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Approximate Age: {age}</p>}
            </div>
            {/* TODO: Add UI for medical, documents */}
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-4">(Medical and Documents editor coming soon)</p>
        </div>
    );
};
export default PetForm;