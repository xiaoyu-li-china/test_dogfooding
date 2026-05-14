const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static('public'));

function generateData() {
  const categories = ['A', 'B', 'C', 'D', 'E'];
  const data = [];
  for (let i = 0; i < 100; i++) {
    data.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      category: categories[Math.floor(Math.random() * categories.length)],
      value: Math.floor(Math.random() * 50) + 10
    });
  }
  return data;
}

app.get('/api/data', (req, res) => {
  res.json(generateData());
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
