const express = require('express');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const TRANSCRIPTS_DIR = path.join(__dirname, 'transcripts');

// Ensure the transcripts directory exists
if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR);
}

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
app.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Upload endpoint hit');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);

    const file = req.file;

    console.log('File received:', file);

    if (!file) {
        console.error('No file uploaded.');
        return res.status(400).send('No file uploaded.');
    }

    // Notify frontend that upload has started
    io.emit('upload-progress', { status: 'Upload started', filename: file.originalname });

    try {
        // Notify frontend that processing has started
        io.emit('upload-progress', { status: 'Processing started', filename: file.originalname });

        // Transcribe the uploaded audio file
        const transcriptData = await transcribeAudio(file.path, file);

        // Add metadata
        const metadata = {
            filename: file.originalname,
            uploadTime: new Date().toISOString(),
            transcriptId: transcriptData.id,
        };

        // Notify frontend that processing is complete
        io.emit('upload-progress', { status: 'Processing complete', transcriptReady: true, metadata });

        res.status(200).send({ message: 'File uploaded and processed successfully.', metadata });
    } catch (error) {
        console.error('Error during transcription:', error);
        res.status(500).send({ message: 'Error during transcription.', error: error.message });
    } finally {
        // Clean up the uploaded file
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
        });
    }
});

// Serve transcript files dynamically
app.get('/backend/transcripts/:id', (req, res) => {
    const transcriptFilePath = req.params.id.endsWith('.json')
        ? path.join(TRANSCRIPTS_DIR, req.params.id)
        : path.join(TRANSCRIPTS_DIR, `${req.params.id}.json`);

    console.log('Transcript request received for ID:', req.params.id);
    console.log('Looking for file at path:', transcriptFilePath);

    if (fs.existsSync(transcriptFilePath)) {
        res.sendFile(transcriptFilePath);
    } else {
        res.status(404).send({ error: 'Transcript not found' });
    }
});

// Endpoint to list all transcripts
app.get('/backend/transcripts', (req, res) => {
    fs.readdir(TRANSCRIPTS_DIR, (err, files) => {
        if (err) {
            console.error('Error reading transcripts directory:', err);
            return res.status(500).send({ error: 'Failed to retrieve transcripts' });
        }

        const transcripts = files.map(file => {
            const filePath = path.join(TRANSCRIPTS_DIR, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            return {
                id: path.basename(file, '.json'),
                filename: content.filename || 'Unknown Filename',
                uploadTime: content.uploadTime || 'Unknown Time',
                preview: content.text ? content.text.slice(0, 100) + '...' : 'No preview available',
            };
        });

        // Sort transcripts by uploadTime
        transcripts.sort((a, b) => new Date(a.uploadTime) - new Date(b.uploadTime));

        // Assign sequential names
        transcripts.forEach((transcript, index) => {
            transcript.displayName = `Transcript ${index + 1}`;
        });

        res.send(transcripts);
    });
});

// Endpoint to rename a transcript
app.post('/backend/transcripts/:id/rename', (req, res) => {
    const transcriptFilePath = path.join(TRANSCRIPTS_DIR, `${req.params.id}.json`);

    if (!fs.existsSync(transcriptFilePath)) {
        return res.status(404).send({ error: 'Transcript not found' });
    }

    const { newName } = req.body;
    if (!newName) {
        return res.status(400).send({ error: 'New name is required' });
    }

    try {
        const transcriptData = JSON.parse(fs.readFileSync(transcriptFilePath, 'utf-8'));
        transcriptData.displayName = newName;
        fs.writeFileSync(transcriptFilePath, JSON.stringify(transcriptData, null, 2));
        res.status(200).send({ message: 'Transcript name updated successfully' });
    } catch (error) {
        console.error('Error updating transcript name:', error);
        res.status(500).send({ error: 'Failed to update transcript name' });
    }
});

// Endpoint to update speaker names in a transcript
app.post('/backend/transcripts/:id/update-speaker', (req, res) => {
    const transcriptFilePath = path.join(TRANSCRIPTS_DIR, `${req.params.id}.json`);

    if (!fs.existsSync(transcriptFilePath)) {
        return res.status(404).send({ error: 'Transcript not found' });
    }

    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
        return res.status(400).send({ error: 'Both old and new speaker names are required' });
    }

    try {
        const transcriptData = JSON.parse(fs.readFileSync(transcriptFilePath, 'utf-8'));

        // Update speaker names in utterances
        if (transcriptData.utterances) {
            transcriptData.utterances.forEach(utterance => {
                if (utterance.speaker === oldName) {
                    utterance.speaker = newName;
                }
            });
        }

        fs.writeFileSync(transcriptFilePath, JSON.stringify(transcriptData, null, 2));
        res.status(200).send({ message: 'Speaker name updated successfully' });
    } catch (error) {
        console.error('Error updating speaker name:', error);
        res.status(500).send({ error: 'Failed to update speaker name' });
    }
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Function to send audio file to AssemblyAI for transcription
async function transcribeAudio(filePath, file) {
    try {
        console.log('Reading file:', filePath);
        const fileData = fs.readFileSync(filePath);

        console.log('Uploading file to AssemblyAI...');
        const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', fileData, {
            headers: {
                'authorization': ASSEMBLYAI_API_KEY,
                'content-type': 'application/octet-stream',
            },
        });

        const audioUrl = uploadResponse.data.upload_url;
        console.log('File uploaded successfully. Audio URL:', audioUrl);

        console.log('Requesting transcription...');
        const transcriptResponse = await axios.post('https://api.assemblyai.com/v2/transcript', {
            audio_url: audioUrl,
            speaker_labels: true,
        }, {
            headers: {
                'authorization': ASSEMBLYAI_API_KEY,
                'content-type': 'application/json',
            },
        });

        const transcriptId = transcriptResponse.data.id;
        console.log('Transcription requested. Transcript ID:', transcriptId);

        let transcriptData;
        let progress = 20; // Start progress at 20% after upload
        while (true) {
            const pollingResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: {
                    'authorization': ASSEMBLYAI_API_KEY,
                },
            });

            transcriptData = pollingResponse.data;

            if (transcriptData.status === 'completed') {
                progress = 100; // Set progress to 100% on completion
                io.emit('upload-progress', { status: 'Processing complete', progress });
                break;
            } else if (transcriptData.status === 'failed') {
                throw new Error('Transcription failed');
            } else {
                progress += Math.random() * 10; // Increment progress randomly to simulate activity
                if (progress > 99) progress = 99; // Cap progress at 99% until completion
                io.emit('upload-progress', { status: 'Processing transcription...', progress });
            }

            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before polling again
        }

        const transcriptFilePath = path.join(TRANSCRIPTS_DIR, `${transcriptId}.json`);
        const transcriptToSave = {
            ...transcriptData,
            filename: file.originalname,
            uploadTime: new Date().toISOString(),
        };
        fs.writeFileSync(transcriptFilePath, JSON.stringify(transcriptToSave, null, 2));
        console.log(`Transcript saved to ${transcriptFilePath}`);

        return transcriptData;
    } catch (error) {
        console.error('Error during transcription:', error);
        throw error;
    }
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});