const express = require('express');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configure Multer for temporary file storage
const upload = multer({ dest: 'uploads/' });

// Serve static files (if needed for frontend integration)
app.use(express.static(path.join(__dirname, 'public')));

// Serve the index.html file as the default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Serve the index.html file explicitly
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Serve the transcripts.html file
app.get('/transcripts.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../transcripts.html'));
});

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).send('No file uploaded.');
    }

    // Notify frontend that processing has started
    io.emit('upload-progress', { status: 'Processing started' });

    // Simulate processing
    setTimeout(() => {
        io.emit('upload-progress', { status: 'Processing 50%' });
    }, 2000);

    setTimeout(() => {
        io.emit('upload-progress', { status: 'Processing complete', transcriptReady: true });
        res.status(200).send({ message: 'File uploaded and processed successfully.' });

        // Clean up the uploaded file
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
        });
    }, 5000);
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});