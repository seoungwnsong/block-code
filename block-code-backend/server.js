//Handle https:

const express = require('express');
const cors = require('cors');
const { runBlocks } = require('./interpreter');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/check-flow', (req, res) => {
    const blocks = req.body.blocks;
    const output = runBlocks(blocks);
    res.json({ status: 'done', ...output });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));