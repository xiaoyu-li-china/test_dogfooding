const API_BASE_URL = 'http://127.0.0.1:8000/api'

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  }

  const response = await fetch(url, config)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export const noteApi = {
  getAll: () => request('/notes/'),

  getById: (id) => request(`/notes/${id}/`),

  create: (note) =>
    request('/notes/', {
      method: 'POST',
      body: JSON.stringify(note),
    }),

  update: (id, note) =>
    request(`/notes/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(note),
    }),

  delete: (id) =>
    request(`/notes/${id}/`, {
      method: 'DELETE',
    }),

  getComments: (noteId) => request(`/notes/${noteId}/comments/`),

  addComment: (noteId, comment) =>
    request(`/notes/${noteId}/comments/`, {
      method: 'POST',
      body: JSON.stringify(comment),
    }),
}

export const commentApi = {
  getAll: (noteId) => {
    if (noteId) {
      return request(`/comments/?note_id=${noteId}`)
    }
    return request('/comments/')
  },

  getById: (id) => request(`/comments/${id}/`),

  create: (comment) =>
    request('/comments/', {
      method: 'POST',
      body: JSON.stringify(comment),
    }),

  update: (id, comment) =>
    request(`/comments/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(comment),
    }),

  delete: (id) =>
    request(`/comments/${id}/`, {
      method: 'DELETE',
    }),

  resolve: (id, resolved = true) =>
    request(`/comments/${id}/resolve/`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved }),
    }),
}
