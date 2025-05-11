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
    const file = req.file;

    if (!file) {
        return res.status(400).send('No file uploaded.');
    }

    // Notify frontend that processing has started
    io.emit('upload-progress', { status: 'Processing started' });

    try {
        // Transcribe the uploaded audio file
        const transcriptData = await transcribeAudio(file.path);

        // Notify frontend that processing is complete
        io.emit('upload-progress', { status: 'Processing complete', transcriptReady: true });
        res.status(200).send({ message: 'File uploaded and processed successfully.', transcript: transcriptData });
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

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Function to send audio file to AssemblyAI for transcription
async function transcribeAudio(filePath) {
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
        while (true) {
            console.log('Polling for transcription status...');
            const pollingResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: {
                    'authorization': ASSEMBLYAI_API_KEY,
                },
            });

            transcriptData = pollingResponse.data;
            console.log('Current transcription status:', transcriptData.status);

            if (transcriptData.status === 'completed') {
                console.log('Transcription completed.');
                break;
            } else if (transcriptData.status === 'failed') {
                console.error('Transcription failed:', transcriptData);
                throw new Error('Transcription failed');
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        const transcriptFilePath = path.join(TRANSCRIPTS_DIR, `${transcriptId}.json`);
        fs.writeFileSync(transcriptFilePath, JSON.stringify(transcriptData, null, 2));
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