import React from 'react';
import type { ImportStatus } from '../types';

interface BackupImportModalProps {
    status: ImportStatus;
    onConfirm: () => void;
    onClose: () => void;
}

const BackupImportModal: React.FC<BackupImportModalProps> = ({ status, onConfirm, onClose }) => {
    if (status.type === 'idle') return null;

    const renderContent = () => {
        switch (status.type) {
            case 'confirming':
                return (
                    <>
                        <div className="p-6 space-y-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Confirm Restore</h3>
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-r-lg">
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Ready to restore from: <span className="font-bold">{status.file.name}</span></p>
                                <p className="text-sm text-red-700 dark:text-red-400 mt-2 font-semibold">Warning: This will overwrite ALL current data, including user profiles. This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                            <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                            <button onClick={onConfirm} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Confirm & Restore</button>
                        </div>
                    </>
                );
            case 'loading':
            case 'success':
            case 'error':
                const colorClasses = {
                    loading: 'bg-blue-900/50 text-blue-200 border-blue-500',
                    success: 'bg-green-900/50 text-green-200 border-green-500',
                    error: 'bg-red-900/50 text-red-200 border-red-500',
                };
                return (
                    <div className="p-8">
                         <div className={`p-6 rounded-lg text-lg text-center ${colorClasses[status.type]}`}>
                            <p>{status.message}</p>
                            {(status.type === 'loading' || status.type === 'success') && (
                                <div className="mt-4 h-1 w-full bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-1 bg-gradient-to-r from-green-400 to-violet-500 animate-pulse w-full"></div>
                                </div>
                            )}
                            {status.type === 'error' && (
                                <button onClick={onClose} className="mt-4 px-4 py-1.5 text-sm font-semibold text-gray-200 bg-white/10 hover:bg-white/20 rounded-lg">Close</button>
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg" role="dialog" aria-modal="true">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Restore from Backup</h2>
                     <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default BackupImportModal;