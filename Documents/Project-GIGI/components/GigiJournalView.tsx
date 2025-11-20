
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { GigiJournalEntry, User, Reaction, Comment } from '../types';
import { GIGI_AVATAR_URL } from '../services/mockData';
import CopyButton from './CopyButton';
import { SortIcon, EmojiIcon, SendIcon, Squares2X2Icon, ViewColumnsIcon, EllipsisVerticalIcon, ClipboardIcon, DocumentTextIcon } from './icons';
import JournalTile from './JournalTile';
import SelectionActionsBar from './SelectionActionsBar';

interface GigiJournalViewProps {
    journal: GigiJournalEntry[];
    user: User;
    onAddComment: (entryId: string, commentText: string) => void;
    onUpdateEntry: (entry: GigiJournalEntry) => void;
}

const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
};

const formatJournalDate = (date: Date): string => {
    if (!date || isNaN(date.getTime())) {
        return "Invalid Date";
    }
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
    const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
    const day = date.getDate();
    const year = date.getFullYear();
    const time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    }).format(date).toLowerCase();

    return `${dayOfWeek}, ${month} ${day}${getOrdinalSuffix(day)}, ${year} | ${time}`;
};

export const EMOJI_LIST = ['❤️', '😂', '🤔', '😢', '👍', '💡', '✨'];
// Expanded list as requested
export const EMOJIS_FOR_PICKER = [
    '😂', '❤️', '👍', '😭', '🙏', '🔥', '🥰', '😍', '😊', '🥳', 
    '🥺', '😅', '🤩', '✨', '🤔', '💅', '💯', '😈', '💦', '🍑', 
    '🍆', '🤯', '😇', '💔', '🤦‍♀️', '🤷‍♀️', '🎉', '😉', '😎', '😋', 
    '🤣', '😩', '🤤', '😏', '😳', '🙄', '🥂'
];

const CommentView: React.FC<{ comment: Comment; isAI: boolean }> = ({ comment, isAI }) => (
    <div className="flex items-start gap-3">
        <img src={comment.authorAvatarUrl} alt={comment.authorName} className={`w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1 ${isAI ? 'ai-avatar-glow' : ''}`}/>
        <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg px-3 py-2">
            <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{comment.authorName}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.content}</p>
        </div>
    </div>
);

const JournalActionsMenu: React.FC<{ entry: GigiJournalEntry }> = ({ entry }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatTranscript = () => {
        return `Title: ${entry.title}\nDate: ${formatJournalDate(entry.creationDate)}\n\n---\n\n${entry.content}`;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(formatTranscript());
        setIsOpen(false);
    };

    const handleSave = () => {
        const blob = new Blob([formatTranscript()], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date(entry.creationDate).toISOString().split('T')[0];
        a.download = `journal-${date}-${entry.title.replace(/\s+/g, '-').toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={() => setIsOpen(p => !p)} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                <EllipsisVerticalIcon className="w-5 h-5" />
            </button>
            {isOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border dark:border-gray-600 z-10">
                    <button onClick={handleCopy} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-lg">
                        <ClipboardIcon className="w-4 h-4" /> Copy Transcript
                    </button>
                    <button onClick={handleSave} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-lg">
                        <DocumentTextIcon className="w-4 h-4" /> Save Transcript...
                    </button>
                </div>
            )}
        </div>
    );
};


export const JournalEntry: React.FC<{
    entry: GigiJournalEntry,
    user: User,
    isConversation?: boolean,
    onAddComment: (entryId: string, commentText: string) => void,
    onUpdateEntry: (entry: GigiJournalEntry) => void,
    isModalView?: boolean, // New prop
}> = ({ entry, user, isConversation = false, onAddComment, onUpdateEntry, isModalView = false }) => {
    const [reactions, setReactions] = useState<Reaction[]>(entry.reactions || []);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showCommentEmojiPicker, setShowCommentEmojiPicker] = useState(false);
    const [commentText, setCommentText] = useState('');
    const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setReactions(entry.reactions || []);
    }, [entry.reactions]);

    // Auto-scroll to bottom when comments change
    useEffect(() => {
        if (entry.comments && entry.comments.length > 0) {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [entry.comments]);

    useEffect(() => {
        const textarea = commentTextareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [commentText]);


    const handleReaction = (emoji: string) => {
        let newReactions: Reaction[];
        const existingReactionIndex = reactions.findIndex(r => r.reactorId === user.id);

        if (existingReactionIndex > -1) {
            if (reactions[existingReactionIndex].emoji === emoji) {
                newReactions = reactions.filter(r => r.reactorId !== user.id);
            } else {
                const updated = [...reactions];
                updated[existingReactionIndex] = { ...reactions[existingReactionIndex], emoji };
                newReactions = updated;
            }
        } else {
            newReactions = [...reactions, {
                reactorId: user.id,
                reactorName: user.displayName,
                emoji: emoji,
                reactorAvatarUrl: user.profilePictureUrl,
            }];
        }
        
        setReactions(newReactions);
        onUpdateEntry({ ...entry, reactions: newReactions });
        setShowEmojiPicker(false);
    };

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (commentText.trim()) {
            onAddComment(entry.id, commentText.trim());
            setCommentText('');
        }
    };

    const groupedReactions = useMemo(() => {
        return reactions.reduce((acc, reaction) => {
            acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [reactions]);

    const getAvatar = (speakerName: string) => {
        const companion = user.aiCompanions.find(c => c.name === speakerName);
        return companion?.avatarUrl || GIGI_AVATAR_URL;
    };

    const content = isConversation ? (
        <div className="mt-4 space-y-4">
            {entry.content.split('\n').map((line, index) => {
                 const parts = line.split(': ');
                 const speaker = parts[0];
                 const text = parts.slice(1).join(': ');
                 return (
                    <div key={index} className="flex items-start gap-3">
                        <img src={getAvatar(speaker)} alt={speaker} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1 ai-avatar-glow"/>
                        <div>
                            <p className="font-bold text-gray-800 dark:text-gray-200">{speaker}</p>
                            <p className="text-gray-700 dark:text-gray-300">{text}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    ) : (
        <div className="prose prose-lg dark:prose-invert max-w-none font-serif text-gray-700 dark:text-gray-300">
            <p style={{ whiteSpace: 'pre-wrap' }}>{entry.content}</p>
        </div>
    );
    
    const contentClasses = isConversation
        ? "bg-gray-100/80 dark:bg-gray-800/80"
        : "bg-amber-50/80 dark:bg-gray-800/80";

    const containerClasses = isModalView ? "" : "rounded-lg shadow-lg backdrop-blur-sm relative group border border-gray-200 dark:border-gray-700";

    return (
        <div className={containerClasses}>
            {!isModalView && (
                 <div className="relative p-4 bg-gray-900/80 text-white rounded-t-lg">
                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyButton textToCopy={entry.content} />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-100 font-serif">{entry.title}</h2>
                    <p className="text-sm text-gray-400">{formatJournalDate(entry.creationDate)}</p>
                </div>
            )}
            <div className={`${contentClasses} p-6 ${isModalView ? '' : 'rounded-b-lg'}`}>
                {content}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50 flex items-center gap-2">
                    <div className="relative">
                        <button onClick={() => setShowEmojiPicker(p => !p)} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="React">
                            <EmojiIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute bottom-full mb-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-2 border dark:border-gray-700 z-20 w-64">
                                 <div className="grid grid-cols-7 gap-1">
                                    {EMOJIS_FOR_PICKER.map(emoji => (
                                        <button key={emoji} onClick={() => handleReaction(emoji)} className="text-xl p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-transform hover:scale-125">
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {Object.entries(groupedReactions).map(([emoji, count]) => (
                        <div key={emoji} className="flex items-center gap-1 bg-violet-100 dark:bg-violet-500/20 px-2 py-0.5 rounded-full text-sm">
                            <span className="text-base">{emoji}</span>
                            <span className="font-semibold text-violet-700 dark:text-violet-300">{count}</span>
                        </div>
                    ))}
                </div>
                {/* Comments Section */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50 space-y-4">
                    <div className="max-h-[40vh] overflow-y-auto pr-2 space-y-4">
                        {entry.comments && entry.comments.map(comment => (
                            <CommentView key={comment.id} comment={comment} isAI={comment.authorId !== user.id} />
                        ))}
                        <div ref={commentsEndRef} />
                    </div>
                    <form onSubmit={handleCommentSubmit} className="flex items-start gap-2 pt-2">
                        <img src={user.profilePictureUrl} alt={user.displayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"/>
                        <JournalActionsMenu entry={entry} />
                        <div className="flex-grow relative">
                             <textarea
                                ref={commentTextareaRef}
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommentSubmit(e); } }}
                                placeholder="Write a comment... Use @Name to tag specific AI."
                                rows={1}
                                style={{ maxHeight: '120px' }}
                                className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-lg p-2 pr-12 text-sm focus:ring-1 focus:ring-violet-500 focus:outline-none resize-none"
                             />
                             <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                                <button type="button" onClick={() => setShowCommentEmojiPicker(p => !p)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:opacity-80">
                                    <EmojiIcon className="w-4 h-4" />
                                </button>
                                <button type="submit" className="p-1.5 text-violet-600 dark:text-violet-400 hover:opacity-80 disabled:opacity-50" disabled={!commentText.trim()}>
                                    <SendIcon className="w-4 h-4" />
                                </button>
                             </div>
                             {showCommentEmojiPicker && (
                                <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border dark:border-gray-700 z-10 w-64">
                                    <div className="grid grid-cols-7 gap-1">
                                        {EMOJIS_FOR_PICKER.map(emoji => (
                                            <button key={emoji} type="button" onClick={() => {
                                                setCommentText(prev => prev + emoji);
                                                setShowCommentEmojiPicker(false);
                                                commentTextareaRef.current?.focus();
                                            }} className="text-2xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md p-1 transition-colors">
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const JournalDetailView: React.FC<{
    entry: GigiJournalEntry,
    user: User,
    onClose: () => void,
    onAddComment: (entryId: string, commentText: string) => void,
    onUpdateEntry: (entry: GigiJournalEntry) => void,
}> = ({ entry, user, onClose, onAddComment, onUpdateEntry }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                 <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-700/50 flex justify-between items-center bg-gray-50/80 dark:bg-gray-900/50">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-4">{entry.title}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatJournalDate(entry.creationDate)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <JournalActionsMenu entry={entry} />
                        <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 text-2xl leading-none">&times;</button>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto">
                    <JournalEntry 
                        entry={entry} 
                        user={user} 
                        isConversation={entry.type === 'conversation'}
                        onAddComment={onAddComment}
                        onUpdateEntry={onUpdateEntry}
                        isModalView={true}
                    />
                </div>
            </div>
        </div>
    );
};

const GigiJournalView: React.FC<GigiJournalViewProps> = ({ journal, user, onAddComment, onUpdateEntry }) => {
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'list' | 'tiles'>('list');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [viewingEntry, setViewingEntry] = useState<GigiJournalEntry | null>(null);
    
    const sortedJournal = useMemo(() => 
        [...journal].sort((a, b) => {
            const aTime = a.creationDate.getTime();
            const bTime = b.creationDate.getTime();
            return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
        }),
        [journal, sortOrder]
    );
    const primaryCompanion = user.aiCompanions[0];
    const aiName = primaryCompanion?.name || 'Gigi';

    const handleToggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleClearSelection = () => {
        setSelectedIds(new Set());
        setSelectionMode(false);
    };

    const getSelectedEntries = () => sortedJournal.filter(j => selectedIds.has(j.id));

    const handlePrint = () => {
        const selectedEntries = getSelectedEntries();
        if (selectedEntries.length === 0) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Could not open print window. Please disable your pop-up blocker.");
            return;
        }
        printWindow.document.write('<html><head><title>Gigi Journal Export</title>');
        printWindow.document.write(`<style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; padding: 1in; }
            article { border-bottom: 1px solid #ddd; padding-bottom: 1.5rem; margin-bottom: 1.5rem; page-break-inside: avoid; }
            article:last-child { border-bottom: none; }
            h2 { font-size: 1.5rem; margin-bottom: 0.25rem; }
            time { color: #555; font-size: 0.9rem; }
            p { white-space: pre-wrap; margin-top: 1rem; }
            @media print { body { padding: 0.5in; } }
        </style>`);
        printWindow.document.write('</head><body>');
        printWindow.document.write(`<h1>${aiName}'s Journal Export (${selectedEntries.length} entries)</h1>`);

        selectedEntries.forEach(entry => {
            printWindow.document.write('<article>');
            printWindow.document.write(`<h2>${entry.title}</h2>`);
            printWindow.document.write(`<time>${formatJournalDate(entry.creationDate)}</time>`);
            printWindow.document.write(`<p>${entry.content.replace(/\n/g, '<br>')}</p>`);
            printWindow.document.write('</article>');
        });

        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500); // Wait for content to render
    };

    const handleExportTxt = () => {
        const selectedEntries = getSelectedEntries();
        if (selectedEntries.length === 0) return;

        let textContent = `GIGI JOURNAL EXPORT\n${new Date().toLocaleString()}\n\n`;
        textContent += `========================================\n\n`;

        selectedEntries.forEach(entry => {
            textContent += `Title: ${entry.title}\n`;
            textContent += `Date: ${formatJournalDate(entry.creationDate)}\n\n`;
            textContent += `${entry.content}\n`;
            textContent += '\n----------------------------------------\n\n';
        });

        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `gigi-journal-export-${date}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    return (
        <div className="max-w-4xl mx-auto relative pb-24">
            {viewingEntry && (
                <JournalDetailView
                    entry={viewingEntry}
                    user={user}
                    onClose={() => setViewingEntry(null)}
                    onAddComment={onAddComment}
                    onUpdateEntry={onUpdateEntry}
                />
            )}
            <div className="text-center mb-8">
                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-gray-100 font-tangerine text-glow">{aiName}'s Personal Log</h1>
                <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">"Here are some of my thoughts and reflections on our conversations."</p>
            </div>
            
            <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
                <button 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-700/80 rounded-lg hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-colors backdrop-blur-sm"
                >
                    <SortIcon className="w-4 h-4" />
                    Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                </button>
                <div className="flex items-center p-1 bg-gray-100/80 dark:bg-gray-700/80 rounded-lg backdrop-blur-sm">
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}><ViewColumnsIcon className="w-5 h-5"/></button>
                    <button onClick={() => setViewMode('tiles')} className={`p-2 rounded-md ${viewMode === 'tiles' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}><Squares2X2Icon className="w-5 h-5"/></button>
                </div>
                <button 
                    onClick={() => setSelectionMode(true)} 
                    disabled={viewMode === 'list' || selectionMode}
                    className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg shadow-sm hover:bg-violet-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Select
                </button>
            </div>

            {selectionMode && (
                <SelectionActionsBar 
                    selectedCount={selectedIds.size}
                    onClearSelection={handleClearSelection}
                    onPrint={handlePrint}
                    onExportTxt={handleExportTxt}
                />
            )}

            {sortedJournal.length > 0 ? (
                viewMode === 'list' ? (
                    <div className="space-y-8">
                        {sortedJournal.map(entry => (
                            <JournalEntry 
                                key={entry.id} 
                                entry={entry} 
                                user={user} 
                                isConversation={entry.type === 'conversation'}
                                onAddComment={onAddComment}
                                onUpdateEntry={onUpdateEntry}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {sortedJournal.map(entry => (
                            <JournalTile 
                                key={entry.id} 
                                entry={entry} 
                                isSelected={selectedIds.has(entry.id)} 
                                onClick={() => {
                                    if (selectionMode) {
                                        handleToggleSelection(entry.id);
                                    } else {
                                        setViewingEntry(entry);
                                    }
                                }}
                            />
                        ))}
                    </div>
                )
            ) : (
                <div className="text-center py-16 px-6 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                    <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">The Pages are Blank</h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        {aiName} hasn't written any journal entries yet.
                        <br />
                        Have a chat with them to create some shared memories!
                    </p>
                </div>
            )}
        </div>
    );
};

export default GigiJournalView;
