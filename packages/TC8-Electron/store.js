const fs = require('fs');
const path = require('path');

const { app } = require('electron');

let userDataPath = null;
let notesFilePath = null;
let notes = [];

function init() {
  userDataPath = app.getPath('userData');
  notesFilePath = path.join(userDataPath, 'notes.json');
  
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  loadNotes();
}

function loadNotes() {
  try {
    if (fs.existsSync(notesFilePath)) {
      const data = fs.readFileSync(notesFilePath, 'utf-8');
      notes = JSON.parse(data);
    } else {
      notes = [];
      saveNotes();
    }
  } catch (error) {
    console.error('加载便签数据失败:', error);
    notes = [];
  }
}

function saveNotes() {
  try {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf-8');
  } catch (error) {
    console.error('保存便签数据失败:', error);
  }
}

function getAllNotes() {
  return notes;
}

function getNoteById(noteId) {
  return notes.find(n => n.id === noteId) || null;
}

function createNote(noteData = {}) {
  const now = Date.now();
  const defaultPosition = getDefaultPosition();
  
  const note = {
    id: `note_${now}`,
    title: noteData.title || '',
    content: noteData.content || '',
    color: noteData.color || '#FFFEF0',
    x: noteData.x !== undefined ? noteData.x : defaultPosition.x,
    y: noteData.y !== undefined ? noteData.y : defaultPosition.y,
    width: noteData.width || 400,
    height: noteData.height || 300,
    createdAt: now,
    updatedAt: now
  };
  
  notes.push(note);
  saveNotes();
  return note;
}

function updateNote(noteId, noteData) {
  const index = notes.findIndex(n => n.id === noteId);
  if (index === -1) return null;
  
  notes[index] = {
    ...notes[index],
    ...noteData,
    updatedAt: Date.now()
  };
  
  saveNotes();
  return notes[index];
}

function deleteNote(noteId) {
  const index = notes.findIndex(n => n.id === noteId);
  if (index !== -1) {
    notes.splice(index, 1);
    saveNotes();
    return true;
  }
  return false;
}

function getDefaultPosition() {
  const offset = 50;
  const positions = notes.map(n => ({ x: n.x, y: n.y }));
  
  let x = 100;
  let y = 100;
  
  while (positions.some(p => Math.abs(p.x - x) < 30 && Math.abs(p.y - y) < 30)) {
    x += offset;
    y += offset;
  }
  
  return { x, y };
}

module.exports = {
  init,
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote
};
