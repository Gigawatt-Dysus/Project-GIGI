import React from 'react';
import type { EventTag } from '../../types';

interface EventTagFormProps {
    tag: EventTag;
    onMetadataChange: (metadata: EventTag['metadata']) => void;
}

const EventTagForm: React.FC<EventTagFormProps> = ({ tag, onMetadataChange }) => {
    return (
        <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                This tag is used to group events in your timeline.
            </p>
             <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-4">(Linked timeline entries will be shown here in a future update.)</p>
        </div>
    );
};
export default EventTagForm;
