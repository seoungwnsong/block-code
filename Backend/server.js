const express = require('express');
const cors = require('cors');        // add this
const app = express();

app.use(cors());                     // add this
app.use(express.json());

app.post('/check-flow', (req, res) => {
    const blocks = req.body.blocks;
    console.log('Received blocks:', blocks);
    res.json({
        status: 'received',
        blockCount: blocks.length
    });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});