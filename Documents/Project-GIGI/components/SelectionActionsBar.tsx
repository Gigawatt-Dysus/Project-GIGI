import React from 'react';
import { PrintIcon, DocumentTextIcon, TrashIcon } from './icons';

interface SelectionActionsBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onPrint: () => void;
    onExportTxt: () => void;
    // onDelete?: () => void; // Optional delete action
}

const ActionButton: React.FC<{
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}> = ({ onClick, icon, label }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/50 dark:bg-gray-700/50 rounded-lg hover:bg-white dark:hover:bg-gray-600 transition-colors shadow"
    >
        {icon}
        {label}
    </button>
);

const SelectionActionsBar: React.FC<SelectionActionsBarProps> = ({
    selectedCount,
    onClearSelection,
    onPrint,
    onExportTxt,
}) => {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg z-20 border-t dark:border-gray-700 animate-toastIn">
            <div className="container mx-auto p-3 flex flex-wrap justify-between items-center gap-4">
                <div className="font-semibold text-gray-800 dark:text-gray-200">
                    {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
                </div>
                <div className="flex items-center gap-2">
                    <ActionButton onClick={onPrint} icon={<PrintIcon className="w-5 h-5" />} label="Print" />
                    <ActionButton onClick={onExportTxt} icon={<DocumentTextIcon className="w-5 h-5" />} label="Export .txt" />
                    {/* Add other actions like delete here if needed */}
                    <button
                        onClick={onClearSelection}
                        className="px-4 py-2 text-sm font-semibold text-white bg-gray-500 rounded-lg shadow-sm hover:bg-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelectionActionsBar;