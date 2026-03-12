import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import '../../../shared/styles/DetailStyles.css';
import '../../../shared/styles/TextStyles.css';
import api from '../../../shared/services/api';

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
}

const Forum = () => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newPost, setNewPost] = useState({ title: '', content: '' });
    const [newComment, setNewComment] = useState<{ [key: number]: string }>({});

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
        } catch (err) {
            console.error("Erreur lors du chargement des posts :", err);
            setError(t('forum.error.load'));
        } finally {
            setLoading(false);
        }
    };

    const handlePostChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewPost(prevData => ({ ...prevData, [name]: value }));
    };

    const handleCommentChange = (postId: number, content: string) => {
        setNewComment(prev => ({ ...prev, [postId]: content }));
    };

    const handlePostSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/forum/posts/', newPost);
            setNewPost({ title: '', content: '' });
            fetchPosts();
        } catch (err) {
            console.error("Erreur lors de la création du post :", err);
            setError(t('forum.error.post'));
        }
    };

    const handleCommentSubmit = async (postId: number) => {
        if (!newComment[postId]) return;
        try {
            await api.post('/forum/comments/', {
                post: postId,
                content: newComment[postId],
            });
            setNewComment(prev => ({ ...prev, [postId]: '' }));
            fetchPosts();
        } catch (err) {
            console.error("Erreur lors de l'ajout du commentaire :", err);
            setError(t('forum.error.comment'));
        }
    };

    if (loading) {
        return <div className="text-page-container loading-message">{t('forum.loading')}</div>;
    }

    if (error) {
        return <div className="text-page-container error-message">{error}</div>;
    }

    return (
        <div className="text-page-container">
            <div className="page-header">
                <h1>{t('forum.title')}</h1>
            </div>

            {/* Formulaire pour créer un nouveau post */}
            <div className="new-post-form detail-info-group">
                <h3>{t('forum.create_topic')}</h3>
                <form onSubmit={handlePostSubmit}>
                    <div className="form-group">
                        <input
                            type="text"
                            name="title"
                            placeholder={t('forum.post_title_placeholder')}
                            value={newPost.title}
                            onChange={handlePostChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <textarea
                            name="content"
                            placeholder={t('forum.post_content_placeholder')}
                            value={newPost.content}
                            onChange={handlePostChange}
                            required
                        />
                    </div>
                    <button type="submit" className="action-button content-button">{t('forum.publish')}</button>
                </form>
            </div>

            {/* Liste des posts du forum */}
            <div className="posts-list">
                {posts.length > 0 ? (
                    posts.map(post => (
                        <div key={post.id} className="forum-post content-section">
                            <div className="post-header">
                                <h2>{post.title}</h2>
                                <div className="section-footer">
                                    <span className="author">Dr. {post.author_name} ({post.author_specialty})</span>
                                    <span className="date">{t('forum.date_prefix')} {new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <p className="post-content">{post.content}</p>

                            {/* Section des commentaires */}
                            <div className="comments-section">
                                <div className="separator"></div>
                                <h4>{t('forum.comments_title')} ({post.comments.length})</h4>
                                <div className="comments-list detail-list">
                                    {post.comments.map(comment => (
                                        <div key={comment.id} className="comment-item detail-list-item">
                                            <p>{comment.content}</p>
                                            <div className="section-footer">
                                                <span className="author">Dr. {comment.author_name}</span>
                                                <span className="date">{t('forum.date_prefix')} {new Date(comment.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Formulaire pour ajouter un commentaire */}
                                <form onSubmit={(e) => { e.preventDefault(); handleCommentSubmit(post.id); }} className="comment-form">
                                    <div className="form-group">
                                        <textarea
                                            placeholder={t('forum.comment_placeholder')}
                                            value={newComment[post.id] || ''}
                                            onChange={(e) => handleCommentChange(post.id, e.target.value)}
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="action-button content-button">{t('forum.comment_submit')}</button>
                                </form>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="no-data-message">{t('forum.no_posts')}</p>
                )}
            </div>
        </div>
    );
};

export default Forum;