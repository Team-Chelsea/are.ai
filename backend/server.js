const express = require('express');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

// Explicitly specify the path to the .env file
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });

// Check if ASSEMBLYAI_API_KEY is defined
if (!process.env.ASSEMBLYAI_API_KEY) {
    console.error('Error: ASSEMBLYAI_API_KEY is not defined in the environment variables.');
    process.exit(1);
}

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
console.log('ASSEMBLYAI_API_KEY:', ASSEMBLYAI_API_KEY);
const TRANSCRIPTS_DIR = path.join(__dirname, 'transcripts');

// Ensure the transcripts directory exists
if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3001',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Allow CORS for requests from http://localhost:3001
app.use(cors({
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST'],
    credentials: true
}));

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
        console.error('Error details:', error);
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

// Ensure the summary is strictly one line and concise
app.get('/backend/transcripts/:id/summary', (req, res) => {
    const transcriptFilePath = path.join(TRANSCRIPTS_DIR, `${req.params.id}.json`);

    if (!fs.existsSync(transcriptFilePath)) {
        return res.status(404).send({ error: 'Transcript not found' });
    }

    try {
        const transcriptData = JSON.parse(fs.readFileSync(transcriptFilePath, 'utf-8'));

        console.log('Transcript Data:', transcriptData);

        // Generate a concise one-line summary based on the transcript content
        const utterances = transcriptData.utterances || [];
        let summary = '';

        if (utterances.length > 0) {
            const keyPoints = [];

            // Extract key points from the utterances
            utterances.forEach(utterance => {
                if (utterance.text.includes('test') || utterance.text.includes('audio')) {
                    keyPoints.push(utterance.text);
                }
            });

            // Combine key points into a single sentence, ensuring it is one line
            summary = keyPoints.length > 0
                ? `Key topics discussed include ${keyPoints.slice(0, 3).join(', ').replace(/\s+/g, ' ')}.`
                : 'No significant topics identified.';
        } else {
            summary = 'The transcript is empty or does not contain any utterances.';
        }

        // Trim and ensure the summary is concise
        summary = summary.replace(/\s+/g, ' ').trim();

        console.log('Generated Summary:', summary);
        res.send({ summary });
    } catch (error) {
        console.error('Error generating summary:', error);
        res.status(500).send({ error: 'Failed to generate summary' });
    }
});

// Preprocess transcript data
function preprocessTranscript(transcriptData) {
    // Ensure transcript has utterances
    if (!transcriptData.utterances || !Array.isArray(transcriptData.utterances)) {
        throw new Error('Invalid transcript format: Missing or invalid utterances');
    }

    // Clean and normalize text in each utterance
    transcriptData.utterances.forEach(utterance => {
        utterance.text = utterance.text
            .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
            .toLowerCase() // Normalize case
            .trim(); // Remove extra spaces
    });

    return transcriptData;
}

// Analyze transcript data
function analyzeTranscript(transcriptData) {
    // Summarize the transcript instead of extracting key topics
    const summary = transcriptData.utterances
        .map(utterance => utterance.text)
        .slice(0, 3) // Take the first 3 utterances as a simple summary
        .join(' ');

    // Replace keyTopics with the summary
    const keyTopics = summary;

    // Analyze speaker contribution metrics
    const speakerMetrics = {};
    transcriptData.utterances.forEach((utterance, index) => {
        const speaker = utterance.speaker;
        if (!speakerMetrics[speaker]) {
            speakerMetrics[speaker] = { wordCount: 0, turnCount: 0, interruptions: 0 };
        }
        speakerMetrics[speaker].wordCount += utterance.text.split(' ').length;
        speakerMetrics[speaker].turnCount += 1;

        // Check for interruptions
        if (index > 0 && transcriptData.utterances[index - 1].speaker !== speaker) {
            speakerMetrics[speaker].interruptions += 1;
        }
    });

    // Perform sentiment detection
    const sentimentAnalysis = transcriptData.utterances.map(utterance => {
        const text = utterance.text.toLowerCase();
        if (text.includes('good') || text.includes('great')) return 'Positive';
        if (text.includes('bad') || text.includes('poor')) return 'Negative';
        return 'Neutral';
    });
    const overallSentiment = sentimentAnalysis.reduce((acc, sentiment) => {
        acc[sentiment] = (acc[sentiment] || 0) + 1;
        return acc;
    }, {});

    // Clarity scoring
    const clarityMetrics = transcriptData.utterances.map(utterance => {
        const fillerWords = utterance.text.match(/\b(uh|um|like|you know)\b/gi) || [];
        const clarityScore = 100 - fillerWords.length * 5; // Deduct 5 points per filler word
        return {
            text: utterance.text,
            clarityScore: Math.max(clarityScore, 0),
            fillerWords: fillerWords.length,
        };
    });

    const confusingSegments = clarityMetrics.filter(segment => segment.clarityScore < 50);

    // Speaker distribution
    const totalWords = transcriptData.utterances.reduce((sum, utterance) => sum + utterance.text.split(' ').length, 0);
    const speakerDistribution = Object.entries(speakerMetrics).map(([speaker, metrics]) => {
        return {
            speaker,
            percentage: ((metrics.wordCount / totalWords) * 100).toFixed(2) + '%'
        };
    });

    // Sentiment trend
    const sentimentTrend = transcriptData.utterances.map((utterance, index) => {
        const text = utterance.text.toLowerCase();
        let sentiment = 'Neutral';
        if (text.includes('good') || text.includes('great')) sentiment = 'Positive';
        if (text.includes('bad') || text.includes('poor')) sentiment = 'Negative';
        return { index, sentiment };
    });

    // Conversation dynamics
    const conversationDynamics = {
        interruptions: Object.values(speakerMetrics).reduce((sum, metrics) => sum + metrics.interruptions, 0),
        turnTaking: transcriptData.utterances.length
    };

    // Action items
    const actionItems = transcriptData.utterances
        .filter(utterance => utterance.text.includes('should') || utterance.text.includes('need to'))
        .map(utterance => utterance.text);

    return {
        keyTopics,
        speakerMetrics,
        overallSentiment,
        clarityMetrics,
        confusingSegments,
        speakerDistribution,
        sentimentTrend,
        conversationDynamics,
        actionItems
    };
}

// Endpoint to analyze a transcript
app.get('/backend/transcripts/:id/analyze', (req, res) => {
    const transcriptFilePath = path.join(TRANSCRIPTS_DIR, `${req.params.id}.json`);

    console.log('Analyze endpoint hit with ID:', req.params.id);
    console.log('Constructed file path:', transcriptFilePath);

    if (!fs.existsSync(transcriptFilePath)) {
        return res.status(404).send({ error: 'Transcript not found' });
    }

    try {
        let transcriptData = JSON.parse(fs.readFileSync(transcriptFilePath, 'utf-8'));

        console.log('Transcript Data:', transcriptData);
        console.log('Transcript Utterances:', transcriptData.utterances);

        // Preprocess the transcript
        transcriptData = preprocessTranscript(transcriptData);

        console.log('Preprocessed Transcript Data:', transcriptData);

        // Extract user preferences from query parameters
        const selectedFeedback = req.query.feedback ? req.query.feedback.split(',') : [];

        // Analyze the transcript
        const analysisResults = analyzeTranscript(transcriptData);

        console.log('Analysis Results:', analysisResults);

        // Ensure speakerMetrics is defined and accessible
        const speakerMetrics = analysisResults.speakerMetrics;

        // Filter results based on user preferences
        const filteredResults = {};
        if (selectedFeedback.includes('keyTopics')) {
            filteredResults.keyTopics = analysisResults.keyTopics;
        }
        if (selectedFeedback.includes('speakerMetrics')) {
            filteredResults.speakerMetrics = analysisResults.speakerMetrics;
        }
        if (selectedFeedback.includes('sentiment')) {
            filteredResults.overallSentiment = analysisResults.overallSentiment;
        }
        if (selectedFeedback.includes('clarity')) {
            filteredResults.clarityMetrics = analysisResults.clarityMetrics;
            filteredResults.confusingSegments = analysisResults.confusingSegments;
        }

        // Ensure all metrics are included in the response
        filteredResults.speakerDistribution = analysisResults.speakerDistribution;
        filteredResults.sentimentTrend = analysisResults.sentimentTrend;
        filteredResults.keyTopics = analysisResults.keyTopics;
        filteredResults.conversationDynamics = analysisResults.conversationDynamics;
        filteredResults.actionItems = analysisResults.actionItems;

        // Meeting Performance Metrics
        try {
            const meetingDuration = transcriptData.utterances.reduce((total, utterance) => total + (utterance.end - utterance.start), 0);
            console.log('Raw Meeting Duration (ms):', meetingDuration);
            const formattedDuration = {
                hours: Math.floor(meetingDuration / 3600000),
                minutes: Math.floor((meetingDuration % 3600000) / 60000),
                seconds: Math.floor((meetingDuration % 60000) / 1000),
            };
            console.log('Formatted Meeting Duration:', formattedDuration);
            const participantEngagement = Object.entries(speakerMetrics).map(([speaker, metrics]) => {
                return {
                    speaker,
                    engagement: metrics.wordCount
                };
            });

            filteredResults.meetingPerformance = {
                duration: formattedDuration,
                engagement: participantEngagement,
            };
        } catch (error) {
            console.error('Error calculating meeting performance:', error);
        }

        // Extract main points for content summary
        const mainPoints = transcriptData.utterances
            ? transcriptData.utterances.map(utterance => utterance.text).slice(0, 3) // First 3 utterances as main points
            : [];

        // Add main points to the analysis results
        filteredResults.mainPoints = mainPoints;

        console.log('Final Analysis Results:', filteredResults);

        res.send(filteredResults);
    } catch (error) {
        console.error('Error analyzing transcript:', error);
        res.status(500).send({ error: 'Failed to analyze transcript' });
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

        // Debug log to verify the AssemblyAI API key
        console.log('ASSEMBLYAI_API_KEY:', ASSEMBLYAI_API_KEY);

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

// Enhanced error logging middleware
app.use((err, req, res, next) => {
    console.error('Error occurred during request:', {
        method: req.method,
        url: req.url,
        body: req.body,
        error: err.stack,
    });
    res.status(500).send({ error: 'Internal Server Error', details: err.message });
});

// Start the server
const PORT = process.env.PORT || 3000; // Changed default port to 3000
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});