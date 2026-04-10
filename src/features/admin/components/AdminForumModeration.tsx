import { useEffect, useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import type { AdminForumPost, AdminForumComment } from '../../../shared/types';
import PageLoader from '../../../shared/components/PageLoader';
import '../styles/AdminForumModeration.css';

const AdminForumModeration = () => {
    const {
        forumPosts, totalForumPosts, currentForumPage, isLoading, error,
        fetchForumPosts, removeForumPost, removeForumComment,
        doctors, fetchDoctors,
        suspendForum, unsuspendForum,
    } = useAdmin();

    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AdminForumPost | null>(null);
    const [deleteCommentTarget, setDeleteCommentTarget] = useState<{ comment: AdminForumComment; postId: number } | null>(null);
    const [expandedPost, setExpandedPost] = useState<number | null>(null);
    const pageSize = 50;
    const totalPages = Math.ceil(totalForumPosts / pageSize);

    useEffect(() => {
        fetchForumPosts(1);
        if (doctors.length === 0) fetchDoctors(1);
    }, []);

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await removeForumPost(deleteTarget.id);
        showSuccess(`Post "${deleteTarget.title}" removed.`);
        setDeleteTarget(null);
    };

    const handleDeleteComment = async () => {
        if (!deleteCommentTarget) return;
        await removeForumComment(deleteCommentTarget.comment.id);
        showSuccess('Comment removed.');
        setDeleteCommentTarget(null);
        fetchForumPosts(currentForumPage);
    };

    const getDoctorForPost = (authorId: number) => doctors.find(d => d.id === authorId);

    if (isLoading && forumPosts.length === 0) return <PageLoader message="Loading Forum Posts" />;

    return (
        <div className="admin-forum">
            <div className="admin-forum__header">
                <h1>Forum Moderation</h1>
                <span className="count-badge">{totalForumPosts} posts</span>
            </div>

            <div className="admin-forum__info">
                <span>To suspend a doctor from the forum, go to</span>
                <a href="/admin/doctors" className="info-link">Doctor Management</a>
                <span>and use the "Suspend Forum" action.</span>
            </div>

            {successMsg && <div className="success-banner">{successMsg}</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="forum-posts-list">
                {forumPosts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state__icon">💬</div>
                        <div className="empty-state__title">No Forum Posts</div>
                        <div className="empty-state__text">No posts to moderate.</div>
                    </div>
                ) : forumPosts.map(post => {
                    const doctor = getDoctorForPost(post.author_id);
                    const isExpanded = expandedPost === post.id;
                    return (
                        <div key={post.id} className={`forum-post-card${doctor?.forum_suspended ? ' forum-post-card--suspended' : ''}`}>
                            <div className="forum-post-card__header">
                                <div className="forum-post-card__meta">
                                    <span className="forum-post-card__title">{post.title}</span>
                                    <div className="forum-post-card__author">
                                        <span className="author-name">by {post.author_name}</span>
                                        <span className="author-email">{post.author_email}</span>
                                        {doctor?.forum_suspended && (
                                            <span className="suspended-tag">Forum Suspended</span>
                                        )}
                                    </div>
                                    <div className="forum-post-card__info">
                                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                                        <span>{post.comment_count} comments</span>
                                    </div>
                                </div>
                                <div className="forum-post-card__actions">
                                    <button
                                        className="btn-sm btn-secondary"
                                        onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                                    >
                                        {isExpanded ? 'Hide' : 'Preview'}
                                    </button>
                                    {doctor && (
                                        doctor.forum_suspended ? (
                                            <button
                                                className="btn-sm btn-activate"
                                                onClick={async () => {
                                                    await unsuspendForum(post.author_id);
                                                    showSuccess(`${post.author_name}'s forum access restored.`);
                                                }}
                                            >
                                                Unsuspend Author
                                            </button>
                                        ) : (
                                            <button
                                                className="btn-sm btn-warning"
                                                onClick={async () => {
                                                    await suspendForum(post.author_id);
                                                    showSuccess(`${post.author_name} suspended from forum.`);
                                                }}
                                            >
                                                Suspend Author
                                            </button>
                                        )
                                    )}
                                    <button
                                        className="btn-sm btn-danger"
                                        onClick={() => setDeleteTarget(post)}
                                    >
                                        Remove Post
                                    </button>
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="forum-post-card__content">
                                    <p className="forum-post-card__body">{post.content}</p>
                                    {post.comments && post.comments.length > 0 && (
                                        <div className="forum-post-card__comments">
                                            <h4 className="forum-comments-heading">Comments ({post.comments.length})</h4>
                                            {post.comments.map(comment => (
                                                <div key={comment.id} className="forum-comment-item">
                                                    <div className="forum-comment-item__meta">
                                                        <span className="forum-comment-item__author">{comment.author_name}</span>
                                                        <span className="forum-comment-item__date">{new Date(comment.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="forum-comment-item__content">{comment.content}</p>
                                                    <button
                                                        className="btn-sm btn-danger"
                                                        onClick={() => setDeleteCommentTarget({ comment, postId: post.id })}
                                                    >
                                                        Remove Comment
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {post.comments && post.comments.length === 0 && (
                                        <p className="forum-no-comments">No comments yet.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {totalPages > 1 && (
                <div className="pagination">
                    <button className="pagination-btn" onClick={() => fetchForumPosts(currentForumPage - 1)} disabled={currentForumPage === 1}>
                        ← Previous
                    </button>
                    <span className="pagination-info">Page {currentForumPage} of {totalPages}</span>
                    <button className="pagination-btn" onClick={() => fetchForumPosts(currentForumPage + 1)} disabled={currentForumPage === totalPages}>
                        Next →
                    </button>
                </div>
            )}

            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h3>Remove Forum Post</h3>
                        <p>Remove the post <strong>"{deleteTarget.title}"</strong> by {deleteTarget.author_name}? This will also delete all its comments and cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleDelete}>Remove Post</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteCommentTarget && (
                <div className="modal-overlay" onClick={() => setDeleteCommentTarget(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h3>Remove Comment</h3>
                        <p>Remove this comment by <strong>{deleteCommentTarget.comment.author_name}</strong>? This cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setDeleteCommentTarget(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleDeleteComment}>Remove Comment</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminForumModeration;
