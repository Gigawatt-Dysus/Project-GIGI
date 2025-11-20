import React from 'react';
import type { PlaceTag } from '../../types';

interface PlaceFormProps {
    tag: PlaceTag;
    onMetadataChange: (metadata: PlaceTag['metadata']) => void;
}

const PlaceForm: React.FC<PlaceFormProps> = ({ tag, onMetadataChange }) => {
    const inputStyle = "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent sm:text-sm text-gray-900 dark:text-white";

    return (
        <div className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                <input 
                    type="text"
                    placeholder="e.g., 123 Main St, Anytown, USA"
                    value={tag.metadata.address}
                    onChange={e => onMetadataChange({ ...tag.metadata, address: e.target.value })}
                    className={`mt-1 block w-full ${inputStyle}`}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Significance</label>
                <textarea 
                    rows={3}
                    placeholder="e.g., Childhood home, favorite vacation spot"
                    value={tag.metadata.significance}
                    onChange={e => onMetadataChange({ ...tag.metadata, significance: e.target.value })}
                    className={`mt-1 block w-full ${inputStyle}`}
                />
            </div>
            {/* TODO: Add UI for coordinates */}
             <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-4">(Map/Coordinates editor coming soon)</p>
        </div>
    );
};
export default PlaceForm;
