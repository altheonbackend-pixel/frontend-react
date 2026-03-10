// src/features/notes/services/noteService.ts

import api from '../../../shared/services/api';

export const getNotes = () =>
    api.get('/notes/');

export const createNote = (data: { title: string; content: string; patient?: string }) =>
    api.post('/notes/', data);

export const updateNote = (id: number, data: { title: string; content: string; patient?: string }) =>
    api.patch(`/notes/${id}/`, data);

export const deleteNote = (id: number) =>
    api.delete(`/notes/${id}/`);
