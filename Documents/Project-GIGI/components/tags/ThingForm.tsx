import React from 'react';
import type { ThingTag } from '../../types';

interface ThingFormProps {
    tag: ThingTag;
    onMetadataChange: (metadata: ThingTag['metadata']) => void;
}

const ThingForm: React.FC<ThingFormProps> = ({ tag, onMetadataChange }) => {
    const inputStyle = "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent sm:text-sm text-gray-900 dark:text-white";
    
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purpose</label>
                <input 
                    type="text"
                    placeholder="e.g., Musical Instrument, Family Heirloom"
                    value={tag.metadata.purpose}
                    onChange={e => onMetadataChange({ ...tag.metadata, purpose: e.target.value })}
                    className={`mt-1 block w-full ${inputStyle}`}
                />
            </div>
            {/* TODO: Add UI for acquisition, status */}
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-4">(Acquisition and Status editor coming soon)</p>
        </div>
    );
};
export default ThingForm;
