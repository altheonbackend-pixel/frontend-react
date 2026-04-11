import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import '../styles/Forum.css';
import api from '../../../shared/services/api';
import PageLoader from '../../../shared/components/PageLoader';

interface ForumComment {
    id: number;
    author_name: string;
    author_specialty: string;
    content: string;
    created_at: string;
}

interface ForumPost {
    id: number;
    author_name: string;
    author_specialty: string;
    title: string;
    content: string;
    created_at: string;
    comments: ForumComment[];
    is_flagged: boolean;
}

const Forum = () => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newPost, setNewPost] = useState({ title: '', content: '' });
    const [newComment, setNewComment] = useState<{ [key: number]: string }>({});
    const [postSubmitting, setPostSubmitting] = useState(false);
    const [commentSubmitting, setCommentSubmitting] = useState<number | null>(null);
    const [flagging, setFlagging] = useState<number | null>(null);
    const [flagReason, setFlagReason] = useState<{ [key: number]: string }>({});
    const [showFlagForm, setShowFlagForm] = useState<{ [key: number]: boolean }>({});
    const [expandedComments, setExpandedComments] = useState<{ [key: number]: boolean }>({});

    useEffect(() => {
        fetchPosts();
    }, [token]);

    const fetchPosts = async () => {
        if (!token) {
            setError(t('forum.error.auth'));
            setLoading(false);
            return;
        }
        try {
            const response = await api.get('/forum/posts/');
            setPosts(response.data.results ?? response.data);
        } catch {
            setError(t('forum.error.load'));
        } finally {
            setLoading(false);
        }
    };

    const handlePostSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPost.title.trim() || !newPost.content.trim()) return;
        setPostSubmitting(true);
        setError(null);
        try {
            await api.post('/forum/posts/', newPost);
            setNewPost({ title: '', content: '' });
            fetchPosts();
        } catch {
            setError(t('forum.error.post'));
        } finally {
            setPostSubmitting(false);
        }
    };

    const handleCommentSubmit = async (postId: number) => {
        if (!newComment[postId]?.trim()) return;
        setCommentSubmitting(postId);
        setError(null);
        try {
            await api.post('/forum/comments/', { post: postId, content: newComment[postId] });
            setNewComment(prev => ({ ...prev, [postId]: '' }));
            fetchPosts();
        } catch {
            setError(t('forum.error.comment'));
        } finally {
            setCommentSubmitting(null);
        }
    };

    const handleFlagPost = async (postId: number) => {
        const reason = flagReason[postId]?.trim();
        if (!reason) return;
        setFlagging(postId);
        try {
            await api.post(`/forum/posts/${postId}/flag/`, { reason });
            setFlagReason(prev => ({ ...prev, [postId]: '' }));
            setShowFlagForm(prev => ({ ...prev, [postId]: false }));
            fetchPosts();
        } catch {
            setError(t('forum.error.flag'));
        } finally {
            setFlagging(null);
        }
    };

    const toggleComments = (postId: number) => {
        setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
    };

    const toggleFlagForm = (postId: number) => {
        setShowFlagForm(prev => ({ ...prev, [postId]: !prev[postId] }));
    };

    if (loading) return <PageLoader message={t('forum.loading')} />;

    return (
        <div className="forum-page">
            <div className="forum-header">
                <h1>{t('forum.title')}</h1>
                <p className="forum-header-sub">Share cases, ask questions, and collaborate with colleagues</p>
            </div>

            {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}

            {/* Create topic */}
            <div className="forum-compose">
                <h3>{t('forum.create_topic')}</h3>
                <form onSubmit={handlePostSubmit}>
                    <div className="forum-compose-field">
                        <input
                            type="text"
                            placeholder={t('forum.post_title_placeholder')}
                            value={newPost.title}
                            onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="forum-compose-field">
                        <textarea
                            rows={3}
                            placeholder={t('forum.post_content_placeholder')}
                            value={newPost.content}
                            onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="forum-compose-actions">
                        <button type="submit" className="btn-publish" disabled={postSubmitting}>
                            {postSubmitting ? t('forum.publishing') : t('forum.publish')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Posts list */}
            <div className="forum-posts-list">
                {posts.length === 0 ? (
                    <div className="forum-empty"><p>{t('forum.no_posts')}</p></div>
                ) : (
                    posts.map(post => {
                        const commentsOpen = expandedComments[post.id] ?? false;
                        const flagFormOpen = showFlagForm[post.id] ?? false;
                        return (
                            <div key={post.id} className="forum-post-card">
                                {/* Post body */}
                                <div className="forum-post-body">
                                    <h2 className="forum-post-title">{post.title}</h2>
                                    <p className="forum-post-content">{post.content}</p>
                                    <div className="forum-post-meta">
                                        <div className="forum-author-avatar">
                                            {post.author_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="forum-author-name">Dr. {post.author_name}</span>
                                        {post.author_specialty && (
                                            <span>{post.author_specialty}</span>
                                        )}
                                        <span className="forum-post-date">
                                            {new Date(post.created_at).toLocaleDateString()}
                                        </span>
                                        {post.is_flagged && (
                                            <span className="forum-flagged-badge">Flagged</span>
                                        )}
                                    </div>
                                </div>

                                {/* Flag section */}
                                {!post.is_flagged && (
                                    <div className="forum-flag-section">
                                        <button
                                            type="button"
                                            className="forum-flag-toggle"
                                            onClick={() => toggleFlagForm(post.id)}
                                        >
                                            {flagFormOpen ? 'Cancel Report' : `⚑ ${t('forum.report')}`}
                                        </button>
                                        {flagFormOpen && (
                                            <div className="forum-flag-form">
                                                <input
                                                    type="text"
                                                    placeholder={t('forum.flag_reason_placeholder')}
                                                    value={flagReason[post.id] || ''}
                                                    onChange={e => setFlagReason(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-flag"
                                                    onClick={() => handleFlagPost(post.id)}
                                                    disabled={flagging === post.id || !flagReason[post.id]?.trim()}
                                                >
                                                    {flagging === post.id ? t('forum.flagging') : t('forum.flag_submit')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Comments section */}
                                <div className="forum-comments-section">
                                    <button
                                        type="button"
                                        className="forum-comments-toggle"
                                        onClick={() => toggleComments(post.id)}
                                    >
                                        <span>
                                            {t('forum.comments_title')}
                                            <span className="forum-comments-toggle-count" style={{ marginLeft: '8px' }}>
                                                {post.comments.length}
                                            </span>
                                        </span>
                                        <span className={`forum-comments-toggle-chevron${commentsOpen ? ' open' : ''}`}>▼</span>
                                    </button>

                                    {commentsOpen && (
                                        <>
                                            {post.comments.length > 0 && (
                                                <div className="forum-comments-list">
                                                    {post.comments.map(comment => (
                                                        <div key={comment.id} className="forum-comment-item">
                                                            <div className="forum-comment-avatar">
                                                                {comment.author_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="forum-comment-body">
                                                                <div className="forum-comment-author">
                                                                    Dr. {comment.author_name}
                                                                    {comment.author_specialty && ` · ${comment.author_specialty}`}
                                                                </div>
                                                                <p className="forum-comment-text">{comment.content}</p>
                                                                <div className="forum-comment-date">
                                                                    {new Date(comment.created_at).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="forum-comment-input-row">
                                                <textarea
                                                    className="forum-comment-input"
                                                    rows={1}
                                                    placeholder={t('forum.comment_placeholder')}
                                                    value={newComment[post.id] || ''}
                                                    onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleCommentSubmit(post.id);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-comment-submit"
                                                    onClick={() => handleCommentSubmit(post.id)}
                                                    disabled={commentSubmitting === post.id || !newComment[post.id]?.trim()}
                                                >
                                                    {commentSubmitting === post.id ? t('forum.commenting') : t('forum.comment_submit')}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default Forum;
