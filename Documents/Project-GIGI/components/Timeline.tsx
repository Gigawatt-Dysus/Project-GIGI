import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { LifeEvent, Media, Tag, User, Reaction, Comment } from '../types';
import { SortIcon, PlusIcon, PencilIcon, Squares2X2Icon, ViewColumnsIcon, CheckCircleIcon, EmojiIcon, SendIcon, ClipboardIcon, TrashIcon, EllipsisVerticalIcon } from './icons';
import TimeCircuits from './TimeCircuits';
import { parseNaturalDateString } from '../utils/ageCalculator';
import { base64ToBlob } from '../utils/fileUtils';
import { EMOJIS_FOR_PICKER } from './GigiJournalView';
import TagCardViewer from './TagCardViewer';
import CopyButton from './CopyButton';

interface TimeVortexProps {
    events: LifeEvent[];
    tags: Tag[];
    media: Media[];
    user: User;
    onEditEvent: (event: LifeEvent) => void;
    onCreateEvent: () => void;
    onEditTag: (tag: Tag) => void;
    onAddComment: (eventId: string, commentText: string) => void;
    onUpdateEvent: (event: LifeEvent) => void;
}

const Lightbox: React.FC<{ mediaItem: Media; onClose: () => void; }> = ({ mediaItem, onClose }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        const placeholder = 'https://dummyimage.com/800x600/e9d5ff/4c1d95.png&text=Loading...';
        setImageUrl(placeholder);

        const generateUrl = () => {
            if (mediaItem.base64Data && mediaItem.fileType) {
                try {
                    const blob = base64ToBlob(mediaItem.base64Data, mediaItem.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = newUrl;
                    setImageUrl(newUrl);
                } catch (e) { console.error("Error creating lightbox blob", e); }
            } else {
                setImageUrl(mediaItem.url || mediaItem.thumbnailUrl || placeholder);
            }
        };
        generateUrl();

        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [mediaItem]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white text-4xl leading-none font-bold hover:text-gray-300 z-10">&times;</button>
            <div className="relative max-w-5xl max-h-[90vh] w-full h-full" onClick={e => e.stopPropagation()}>
                {imageUrl ? <img src={imageUrl} alt={mediaItem.caption} className="max-w-full max-h-full object-contain mx-auto" /> : <div className="w-full h-full bg-gray-700 animate-pulse rounded-lg"/>}
                 {mediaItem.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-center text-white text-sm">{mediaItem.caption}</div>}
            </div>
        </div>
    );
};

const ExpandableSection: React.FC<{ title: string; content: string; color: string }> = ({ title, content, color }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="mt-4">
            <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className={`flex justify-between items-center w-full text-left text-sm font-medium ${color}`}
            >
                <span>{title}</span>
                <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>▼</span>
            </button>
            {isExpanded && (
                <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 prose prose-sm dark:prose-invert">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>
                </div>
            )}
        </div>
    );
};

const CommentActionMenu: React.FC<{ 
    comment: Comment; 
    user: User; 
    onDelete: () => void;
    onReport: () => void;
    onBan: () => void;
}> = ({ comment, user, onDelete, onReport, onBan }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const isMyComment = comment.authorId === user.id;
    const isMe = comment.authorId === user.id;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(p => !p); }} className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <EllipsisVerticalIcon className="w-4 h-4" />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1 text-sm">
                    <button onClick={() => { onDelete(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                        <TrashIcon className="w-4 h-4" /> Delete
                    </button>
                    
                    {!isMe && (
                        <>
                            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                            <button onClick={() => { onReport(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                                Report
                            </button>
                            <button onClick={() => { onBan(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                                Ban User
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

const CommentInput: React.FC<{
    onAddComment: (text: string) => void;
}> = ({ onAddComment }) => {
    const [commentText, setCommentText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [commentText]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (commentText.trim()) {
            onAddComment(commentText.trim());
            setCommentText('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-start gap-2 pt-2">
            <div className="flex-grow relative">
                <textarea
                    ref={textareaRef}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a comment..."
                    rows={1}
                    style={{ maxHeight: '120px' }}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-2 pr-12 text-sm focus:ring-1 focus:ring-violet-500 focus:outline-none resize-none custom-scrollbar"
                />
                 <div className="absolute right-1 top-2 flex items-center gap-1">
                    <div className="relative">
                        <button type="button" onClick={() => setShowEmojiPicker(p => !p)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:opacity-80 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <EmojiIcon className="w-4 h-4" />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border dark:border-gray-700 z-20 w-64">
                                <div className="grid grid-cols-7 gap-1">
                                    {EMOJIS_FOR_PICKER.map(emoji => (
                                        <button key={emoji} type="button" onClick={() => {
                                            setCommentText(prev => prev + emoji);
                                            setShowEmojiPicker(false);
                                            textareaRef.current?.focus();
                                        }} className="text-2xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md p-1 transition-colors">
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button type="submit" className="p-1.5 text-violet-600 dark:text-violet-400 hover:opacity-80 disabled:opacity-50" disabled={!commentText.trim()}>
                        <SendIcon className="w-4 h-4" />
                    </button>
                 </div>
            </div>
        </form>
    );
};

const EventViewerModal: React.FC<{
    event: LifeEvent;
    media: Media[];
    tags: Tag[];
    user: User;
    onClose: () => void;
    onEdit: () => void;
    onTagClick: (tag: Tag) => void;
    onMediaClick: (media: Media) => void;
    onAddComment: (text: string) => void;
    onUpdateEvent: (event: LifeEvent) => void;
}> = ({ event, media, tags, user, onClose, onEdit, onTagClick, onMediaClick, onAddComment, onUpdateEvent }) => {
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const eventMedia = useMemo(() => media.filter(m => event.mediaIds?.includes(m.id)), [media, event.mediaIds]);
    const eventTags = useMemo(() => tags.filter(t => event.tagIds?.includes(t.id)), [tags, event.tagIds]);
    const displayDate = event.date instanceof Date && !isNaN(event.date.getTime())
        ? event.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : 'Invalid Date';

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        if (event.comments && event.comments.length > 0) {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [event.comments]);

    const handleReaction = (emoji: string) => {
        let newReactions: Reaction[] = event.reactions || [];
        const existingIdx = newReactions.findIndex(r => r.reactorId === user.id);
        
        if (existingIdx > -1) {
             if (newReactions[existingIdx].emoji === emoji) {
                 newReactions = newReactions.filter((_, i) => i !== existingIdx);
             } else {
                 const updated = [...newReactions];
                 updated[existingIdx] = { ...updated[existingIdx], emoji };
                 newReactions = updated;
             }
        } else {
            newReactions = [...newReactions, {
                reactorId: user.id,
                reactorName: user.displayName,
                emoji,
                reactorAvatarUrl: user.profilePictureUrl
            }];
        }
        onUpdateEvent({...event, reactions: newReactions});
        setShowEmojiPicker(false);
    };

    const handleDeleteComment = (commentId: string) => {
        const updatedComments = event.comments?.filter(c => c.id !== commentId);
        onUpdateEvent({ ...event, comments: updatedComments });
    };

    const handleReportUser = (userId: string) => {
        alert(`Report submitted for user ${userId}. Thank you for helping keep our community safe.`);
    };

    const handleBanUser = (userId: string) => {
        if (window.confirm("Are you sure you want to ban this user? You won't see their comments anymore.")) {
             alert(`User ${userId} has been banned.`);
        }
    };

    const reactionsCount = (event.reactions || []).reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-xl flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-serif">{event.title}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{displayDate}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { onClose(); onEdit(); }} className="p-2 text-gray-500 hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400 transition-colors" title="Edit Event">
                            <PencilIcon className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-xl leading-none">&times;</button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
                    <div className="prose prose-lg dark:prose-invert max-w-none font-serif text-gray-800 dark:text-gray-200">
                        <p style={{ whiteSpace: 'pre-wrap' }}>{event.details}</p>
                    </div>

                    {eventMedia.length > 0 && (
                        <div className="my-6 grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {eventMedia.map(mediaItem => (
                                <img 
                                    key={mediaItem.id} 
                                    src={mediaItem.thumbnailUrl} 
                                    alt={mediaItem.caption} 
                                    onClick={() => onMediaClick(mediaItem)}
                                    className="rounded-lg object-cover w-full h-24 cursor-pointer hover:opacity-80 transition ring-1 ring-gray-300 dark:ring-gray-600 shadow-sm"
                                />
                            ))}
                        </div>
                    )}

                    {eventTags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {eventTags.map(tag => (
                                <button 
                                    key={tag.id} 
                                    onClick={() => onTagClick(tag)}
                                    className="inline-block bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 text-xs font-medium px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-800 transition"
                                >
                                    {tag.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {event.privateDetails && (
                        <ExpandableSection title="Private Details" content={event.privateDetails} color="text-red-600 dark:text-red-400" />
                    )}
                    
                    {event.historical && (
                        <ExpandableSection title="Historical Context" content={event.historical} color="text-blue-600 dark:text-blue-400" />
                    )}
                    
                     <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700/50">
                        <div className="flex items-center gap-2 mb-4">
                             <div className="relative">
                                 <button onClick={() => setShowEmojiPicker(p => !p)} className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors">
                                    <EmojiIcon className="w-5 h-5" />
                                </button>
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-2 border dark:border-gray-700 z-20 w-64">
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
                             <div className="flex gap-1 flex-wrap">
                                {Object.entries(reactionsCount).map(([emoji, count]) => (
                                    <span key={emoji} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-sm border border-gray-200 dark:border-gray-600">
                                        <span>{emoji}</span>
                                        <span className="font-semibold text-xs text-gray-600 dark:text-gray-300">{count}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                             <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Comments</h4>
                             <div className="max-h-60 overflow-y-auto space-y-3 pr-1 custom-scrollbar mb-3">
                                 {event.comments && event.comments.length > 0 ? (
                                     event.comments.map(comment => (
                                         <div key={comment.id} className="flex items-start gap-2 text-sm group">
                                             <img src={comment.authorAvatarUrl} alt={comment.authorName} className="w-8 h-8 rounded-full mt-1 flex-shrink-0 object-cover"/>
                                             <div className="bg-white dark:bg-gray-700 p-3 rounded-lg rounded-tl-none flex-grow border border-gray-200 dark:border-gray-600 relative">
                                                 <div className="flex justify-between items-start">
                                                     <span className="font-bold text-gray-900 dark:text-gray-100 mr-1">{comment.authorName}</span>
                                                     <CommentActionMenu 
                                                        comment={comment} 
                                                        user={user} 
                                                        onDelete={() => handleDeleteComment(comment.id)}
                                                        onReport={() => handleReportUser(comment.authorId)}
                                                        onBan={() => handleBanUser(comment.authorId)}
                                                     />
                                                 </div>
                                                 <span className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.content}</span>
                                             </div>
                                         </div>
                                     ))
                                 ) : (
                                     <p className="text-xs text-gray-500 italic text-center py-4">No comments yet. Be the first to share your thoughts!</p>
                                 )}
                                 <div ref={commentsEndRef} />
                             </div>
                             <CommentInput onAddComment={onAddComment} />
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );
};

const EventCard: React.FC<{ 
    event: LifeEvent; 
    media: Media[]; 
    tags: Tag[]; 
    user: User;
    onEdit: () => void; 
    onView: () => void;
    onTagClick: (tag: Tag) => void;
    onMediaClick: (media: Media) => void;
    onAddComment: (text: string) => void;
    onUpdateEvent: (event: LifeEvent) => void;
    viewMode: 'list' | 'tile';
}> = ({ event, media, tags, user, onEdit, onView, onTagClick, onMediaClick, onAddComment, onUpdateEvent, viewMode }) => {
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showComments, setShowComments] = useState(false);

    const eventMedia = useMemo(() =>
        media.filter(m => event.mediaIds?.includes(m.id)),
        [media, event.mediaIds]
    );

    const eventTags = useMemo(() =>
        tags.filter(t => event.tagIds?.includes(t.id)),
        [tags, event.tagIds]
    );
    
    const displayDate = event.date instanceof Date && !isNaN(event.date.getTime())
        ? event.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Invalid Date';

    const handleReaction = (emoji: string) => {
        let newReactions: Reaction[] = event.reactions || [];
        const existingIdx = newReactions.findIndex(r => r.reactorId === user.id);
        
        if (existingIdx > -1) {
             if (newReactions[existingIdx].emoji === emoji) {
                 newReactions = newReactions.filter((_, i) => i !== existingIdx);
             } else {
                 const updated = [...newReactions];
                 updated[existingIdx] = { ...updated[existingIdx], emoji };
                 newReactions = updated;
             }
        } else {
            newReactions = [...newReactions, {
                reactorId: user.id,
                reactorName: user.displayName,
                emoji,
                reactorAvatarUrl: user.profilePictureUrl
            }];
        }
        onUpdateEvent({...event, reactions: newReactions});
        setShowEmojiPicker(false);
    };

    const handleDeleteComment = (commentId: string) => {
        const updatedComments = event.comments?.filter(c => c.id !== commentId);
        onUpdateEvent({ ...event, comments: updatedComments });
    };

    const handleReportUser = (userId: string) => {
        alert("Report submitted.");
    };

    const handleBanUser = (userId: string) => {
        alert("User banned.");
    };

    const reactionsCount = (event.reactions || []).reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const isTile = viewMode === 'tile';

    if (isTile) {
        // TILE VIEW
        return (
            <div 
                onClick={onView}
                className="relative group flex flex-col h-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer"
            >
                 <div className="relative p-3 bg-gray-900/90 text-white rounded-t-lg border-b border-gray-700">
                    <div className="flex justify-between items-start">
                        <div className="overflow-hidden">
                            <h3 className="text-md font-semibold text-gray-100 font-serif truncate pr-6">{event.title || "Untitled"}</h3>
                            <p className="text-xs text-gray-400">{displayDate}</p>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                            className="text-gray-400 hover:text-white transition-colors z-10"
                        >
                            <PencilIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="p-4 flex-grow flex flex-col">
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4 mb-4 flex-grow">{event.details}</p>
                    
                    {eventMedia.length > 0 && (
                        <div className="flex gap-2 overflow-hidden mb-3">
                             {eventMedia.slice(0, 3).map(mediaItem => (
                                <img key={mediaItem.id} src={mediaItem.thumbnailUrl} className="w-12 h-12 rounded object-cover border border-gray-300 dark:border-gray-600" alt="thumbnail" />
                             ))}
                             {eventMedia.length > 3 && <div className="w-12 h-12 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500">+{eventMedia.length - 3}</div>}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
                         <div className="flex gap-1">
                            {Object.entries(reactionsCount).slice(0, 3).map(([emoji, count]) => (
                                <span key={emoji} className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{emoji} {count}</span>
                            ))}
                        </div>
                        <button onClick={() => setShowComments(p => !p)} className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium">
                            {event.comments?.length || 0} Comments
                        </button>
                    </div>
                     {showComments && (
                         <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
                             <div className="max-h-32 overflow-y-auto mb-2 custom-scrollbar">
                                 {event.comments?.map(c => (
                                    <div key={c.id} className="text-xs text-gray-600 dark:text-gray-300 mb-1">
                                        <span className="font-bold">{c.authorName}:</span> {c.content}
                                    </div>
                                 ))}
                             </div>
                             <CommentInput onAddComment={onAddComment} />
                         </div>
                     )}
                </div>
            </div>
        );
    }

    // LIST VIEW
    return (
        <div id={`event-card-${event.id}`} className="mb-8 relative group max-w-4xl mx-auto">
            <div className="relative p-4 bg-gray-900/90 text-white rounded-t-lg shadow-md border border-gray-700 border-b-0">
                <div className="flex justify-between items-start">
                     <div onClick={onView} className="cursor-pointer">
                        <h2 className="text-2xl font-semibold text-gray-100 font-serif hover:text-violet-300 transition-colors">{event.title || "Untitled Event"}</h2>
                        <p className="text-sm text-gray-400 mt-1">{displayDate}</p>
                    </div>
                    <button 
                        onClick={onEdit}
                        className="p-2 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label="Edit event"
                    >
                        <PencilIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="bg-white/90 dark:bg-gray-800/90 p-6 rounded-b-lg shadow-lg backdrop-blur-sm border border-gray-200 dark:border-gray-700 cursor-pointer" onClick={onView}>
                <div className="prose prose-lg dark:prose-invert max-w-none font-serif text-gray-700 dark:text-gray-300">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{event.details}</p>
                </div>
                
                {eventMedia.length > 0 && (
                    <div className="my-6 grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {eventMedia.map(mediaItem => (
                            <img 
                                key={mediaItem.id} 
                                src={mediaItem.thumbnailUrl} 
                                alt={mediaItem.caption} 
                                onClick={(e) => { e.stopPropagation(); onMediaClick(mediaItem); }}
                                className="rounded-lg object-cover w-full h-24 cursor-pointer hover:opacity-80 transition ring-1 ring-gray-300 dark:ring-gray-600 shadow-sm"
                            />
                        ))}
                    </div>
                )}
                
                {eventTags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {eventTags.map(tag => (
                            <button 
                                key={tag.id} 
                                onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                                className="inline-block bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 text-xs font-medium px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-800 transition"
                            >
                                {tag.name}
                            </button>
                        ))}
                    </div>
                )}

                {event.privateDetails && (
                    <div onClick={e => e.stopPropagation()}><ExpandableSection title="Private Details" content={event.privateDetails} color="text-red-600 dark:text-red-400" /></div>
                )}
                
                {event.historical && (
                    <div onClick={e => e.stopPropagation()}><ExpandableSection title="Historical Context" content={event.historical} color="text-blue-600 dark:text-blue-400" /></div>
                )}
                
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700/50 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                         <button onClick={() => setShowEmojiPicker(p => !p)} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
                            <EmojiIcon className="w-5 h-5" />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-2 border dark:border-gray-700 z-20 w-64">
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
                     <div className="flex gap-1 flex-wrap">
                        {Object.entries(reactionsCount).map(([emoji, count]) => (
                            <span key={emoji} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-sm border border-gray-200 dark:border-gray-600">
                                <span>{emoji}</span>
                                <span className="font-semibold text-xs text-gray-600 dark:text-gray-300">{count}</span>
                            </span>
                        ))}
                    </div>
                    <div className="flex-grow"></div>
                    <button onClick={() => setShowComments(p => !p)} className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline">
                        {event.comments?.length || 0} Comments
                    </button>
                </div>
                
                 {showComments && (
                     <div className="mt-3 space-y-3 animate-toastIn bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/30" onClick={e => e.stopPropagation()}>
                         <div className="max-h-60 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                             {event.comments?.map(comment => (
                                 <div key={comment.id} className="flex items-start gap-2 text-sm group">
                                     <img src={comment.authorAvatarUrl} alt={comment.authorName} className="w-8 h-8 rounded-full mt-1 flex-shrink-0 object-cover"/>
                                     <div className="bg-white dark:bg-gray-800 p-3 rounded-lg rounded-tl-none flex-grow border border-gray-200 dark:border-gray-700 relative">
                                         <div className="flex justify-between items-start">
                                             <span className="font-bold text-gray-900 dark:text-gray-100 mr-1">{comment.authorName}</span>
                                              <CommentActionMenu 
                                                comment={comment} 
                                                user={user} 
                                                onDelete={() => handleDeleteComment(comment.id)}
                                                onReport={() => handleReportUser(comment.authorId)}
                                                onBan={() => handleBanUser(comment.authorId)}
                                             />
                                         </div>
                                         <span className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.content}</span>
                                     </div>
                                 </div>
                             ))}
                         </div>
                         <CommentInput onAddComment={onAddComment} />
                     </div>
                 )}
            </div>
        </div>
    );
}


const TimeVortex: React.FC<TimeVortexProps> = ({ events, tags, media, user, onEditEvent, onCreateEvent, onEditTag, onAddComment, onUpdateEvent }) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('timelineSortOrder') as 'asc' | 'desc') || 'desc';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isExactSearch, setIsExactSearch] = useState(false);
  const [filteredEvents, setFilteredEvents] = useState<LifeEvent[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('list');
  const [lightboxMedia, setLightboxMedia] = useState<Media | null>(null);
  
  const [selectedEvent, setSelectedEvent] = useState<LifeEvent | null>(null);
  const [viewingTag, setViewingTag] = useState<Tag | null>(null);

  useEffect(() => {
    localStorage.setItem('timelineSortOrder', sortOrder);
  }, [sortOrder]);

  const handleSearch = (query: string, isExact: boolean) => {
      setSearchQuery(query);
      setIsExactSearch(isExact);
  };

  const handleTagClick = (tag: Tag) => {
      setViewingTag(tag);
  };

  const handleEditTag = (tag: Tag) => {
      setViewingTag(null);
      if (selectedEvent) setSelectedEvent(null);
      onEditTag(tag);
  };

  useEffect(() => {
    let sorted: LifeEvent[] = [];
    try {
        sorted = [...events].sort((a, b) => {
            const aTime = a?.date?.getTime();
            const bTime = b?.date?.getTime();
            if (isNaN(aTime) || isNaN(bTime)) return 0;
            return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
        });
    } catch (error) {
        console.error('[TimeVortex] CRITICAL: Failed to sort events.', error);
        sorted = events;
    }

    if (!searchQuery.trim()) {
      setFilteredEvents(sorted);
      return;
    }
    
    const date = parseNaturalDateString(searchQuery);
    if (date && !isExactSearch) {
      let closestEvent: LifeEvent | null = null;
      let minDiff = Infinity;

      sorted.forEach(event => {
        const diff = Math.abs(event.date.getTime() - date.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestEvent = event;
        }
      });
      
      setFilteredEvents(sorted);

      if (closestEvent) {
        setTimeout(() => {
          const element = document.getElementById(`event-card-${closestEvent!.id}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element?.classList.add('highlight-search-result');
          setTimeout(() => element?.classList.remove('highlight-search-result'), 2500);
        }, 100);
      }
      return;
    }

    const lowerCaseQuery = searchQuery.toLowerCase().trim();
    const results = sorted.filter(event => {
        const eventTags = tags.filter(t => event.tagIds?.includes(t.id));
        const tagNames = eventTags.map(t => t.name).join(' ').toLowerCase();
        
        const searchableContent = [
            event.title,
            event.details,
            event.privateDetails,
            event.historical,
            tagNames
        ].join(' ').toLowerCase();

        if (isExactSearch) {
            return searchableContent.includes(lowerCaseQuery);
        } else {
            if (lowerCaseQuery.includes(' or ')) {
                const terms = lowerCaseQuery.split(' or ').map(t => t.trim()).filter(Boolean);
                return terms.some(term => searchableContent.includes(term));
            } else {
                const terms = lowerCaseQuery.replace(/\+/g, ' ').split(' ').map(t => t.trim()).filter(Boolean);
                return terms.every(term => searchableContent.includes(term));
            }
        }
    });
    setFilteredEvents(results);

  }, [events, tags, sortOrder, searchQuery, isExactSearch]);


  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {lightboxMedia && <Lightbox mediaItem={lightboxMedia} onClose={() => setLightboxMedia(null)} />}
      
      {selectedEvent && (
          <EventViewerModal 
            event={selectedEvent}
            media={media}
            tags={tags}
            user={user}
            onClose={() => setSelectedEvent(null)}
            onEdit={() => onEditEvent(selectedEvent)}
            onTagClick={handleTagClick}
            onMediaClick={setLightboxMedia}
            onAddComment={(text) => onAddComment(selectedEvent.id, text)}
            onUpdateEvent={onUpdateEvent}
          />
      )}

      {viewingTag && (
          <TagCardViewer 
            tag={viewingTag}
            allMedia={media}
            onClose={() => setViewingTag(null)}
            onEdit={handleEditTag}
            onDiscuss={(tag) => { console.log("Discussing", tag.name); }}
          />
      )}

      <div className="flex-none z-20 pb-2 bg-transparent px-4 pt-2">
        <div className="text-center mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 text-glow">Your Life's Time Vortex</h1>
        </div>

        <div>
            <TimeCircuits onSearch={handleSearch} />

            <div className="mt-4 flex flex-wrap justify-center items-center gap-4">
                <div className="flex items-center p-1 bg-gray-100/80 dark:bg-gray-700/80 rounded-lg backdrop-blur-sm border border-gray-200 dark:border-gray-600">
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow text-violet-600 dark:text-violet-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}><ViewColumnsIcon className="w-5 h-5"/></button>
                    <button onClick={() => setViewMode('tile')} className={`p-2 rounded-md transition-all ${viewMode === 'tile' ? 'bg-white dark:bg-gray-600 shadow text-violet-600 dark:text-violet-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}><Squares2X2Icon className="w-5 h-5"/></button>
                </div>
                <button
                    onClick={onCreateEvent}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gigi-blue rounded-lg shadow-md hover:opacity-90 transition-colors border border-cyan-400/30"
                >
                    <PlusIcon className="w-4 h-4" />
                    Create New Event
                </button>
                {events.length > 0 && (
                    <button 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-700/80 rounded-lg hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-colors backdrop-blur-sm border border-gray-200 dark:border-gray-600"
                    >
                    <SortIcon className="w-4 h-4" />
                    Sort: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                    </button>
                )}
            </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto z-10 px-4 custom-scrollbar">
        <div className="mt-4 max-w-6xl mx-auto pb-10">
            {filteredEvents.length > 0 ? (
              <div className={viewMode === 'tile' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : ''}>
                  {filteredEvents.map((event) => (
                    <EventCard 
                        key={event.id} 
                        event={event} 
                        media={media} 
                        tags={tags} 
                        user={user}
                        onEdit={() => onEditEvent(event)} 
                        onView={() => setSelectedEvent(event)}
                        onTagClick={handleTagClick}
                        onMediaClick={setLightboxMedia}
                        onAddComment={(text) => onAddComment(event.id, text)}
                        onUpdateEvent={onUpdateEvent}
                        viewMode={viewMode}
                    />
                  ))}
              </div>
            ) : (
              <div className="max-w-md mx-auto mt-10 p-6 text-center text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">No Events Found</h3>
                  {searchQuery ? (
                      <p>Your {isExactSearch ? 'exact ' : ''}search for "{searchQuery}" did not match any events.</p>
                  ) : (
                      <p>Your Time Vortex is empty. Start by creating an event or chatting with Gigi!</p>
                  )}
              </div>
            )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5); 
          border-radius: 20px;
          border: 3px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(107, 114, 128, 0.8);
        }
      `}</style>
    </div>
  );
};

export default TimeVortex;