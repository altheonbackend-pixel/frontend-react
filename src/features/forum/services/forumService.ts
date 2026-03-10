// src/features/forum/services/forumService.ts

import api from '../../../shared/services/api';

export const getForumPosts = () =>
    api.get('/forum/posts/');

export const createForumPost = (data: { title: string; content: string }) =>
    api.post('/forum/posts/', data);

export const deleteForumPost = (id: number) =>
    api.delete(`/forum/posts/${id}/`);

export const getForumComments = () =>
    api.get('/forum/comments/');

export const createForumComment = (data: { post: number; content: string; is_private: boolean }) =>
    api.post('/forum/comments/', data);

export const deleteForumComment = (id: number) =>
    api.delete(`/forum/comments/${id}/`);
