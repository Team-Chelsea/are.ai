// TeamSync - Meeting Dynamics Analyzer
// Main Application JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Navigation
    initNavigation();
    
    // Upload functionality
    initUpload();
    
    // Chart initializations
    initCharts();
    
    // Settings
    initSettings();
    
    // Welcome modal - Show on first visit
    if (!localStorage.getItem('teamSyncFirstVisit')) {
        setTimeout(showWelcomeMessage, 1000);
        localStorage.setItem('teamSyncFirstVisit', 'true');
    }
});

// Navigation functionality
function initNavigation() {
    const navItems = document.querySelectorAll('.main-nav a');
    const sections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the target section id from the href
            const targetId = this.getAttribute('href').substring(1);
            
            // Hide all sections
            sections.forEach(section => {
                section.classList.remove('active');
            });
            
            // Show the target section
            document.getElementById(targetId).classList.add('active');
            
            // Update active nav item
            navItems.forEach(navItem => {
                navItem.parentElement.classList.remove('active');
            });
            this.parentElement.classList.add('active');
        });
    });
    
    // Handle the upload button on dashboard
    document.getElementById('upload-btn').addEventListener('click', function() {
        // Trigger click on the upload nav item
        const uploadNavItem = document.querySelector('.main-nav a[href="#upload"]');
        uploadNavItem.click();
    });
}

// Upload functionality
function initUpload() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const startAnalysisBtn = document.getElementById('start-analysis');
    
    // File drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('drag-over');
    }
    
    function unhighlight() {
        dropArea.classList.remove('drag-over');
    }
    
    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    // Handle file input change
    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });
    
    // Click on drop area to trigger file input
    dropArea.addEventListener('click', function() {
        fileInput.click();
    });
    
    // Handle the selected files
    function handleFiles(files) {
        if (files.length > 0) {
            startAnalysisBtn.disabled = false;
            
            // Clear previous file list
            fileList.innerHTML = '';
            
            // Display selected files
            Array.from(files).forEach(file => {
                const listItem = document.createElement('li');
                
                // Determine file type icon
                let fileIcon = '📄';
                if (file.type.startsWith('video/')) fileIcon = '🎥';
                else if (file.type.startsWith('audio/')) fileIcon = '🎵';
                else if (file.name.endsWith('.txt') || file.name.endsWith('.vtt') || file.name.endsWith('.srt')) fileIcon = '📝';
                
                listItem.innerHTML = `
                    <div>
                        <span>${fileIcon} ${file.name}</span>
                        <span style="color: var(--text-muted); font-size: 12px; margin-left: 10px;">
                            ${formatFileSize(file.size)}
                        </span>
                    </div>
                    <button class="remove-file" data-name="${file.name}">✕</button>
                `;
                fileList.appendChild(listItem);
            });
            
            // Add event listeners to remove buttons
            document.querySelectorAll('.remove-file').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    this.parentElement.remove();
                    
                    // If no files left, disable analysis button
                    if (fileList.children.length === 0) {
                        startAnalysisBtn.disabled = true;
                    }
                });
            });
        }
    }
    
    // Format file size to human-readable format
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        else return (bytes / 1073741824).toFixed(1) + ' GB';
    }
    
    // Start analysis button
    startAnalysisBtn.addEventListener('click', function() {
        // Show analysis modal
        const modal = document.getElementById('analysis-modal');
        modal.classList.add('active');
        
        // Simulate analysis progress
        simulateAnalysisProgress();
    });
}

// Simulate analysis progress
function simulateAnalysisProgress() {
    const progressFill = document.querySelector('.progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const steps = document.querySelectorAll('.analysis-steps .step');
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 1;
        progressFill.style.width = `${progress}%`;
        progressPercent.textContent = `${progress}%`;
        
        // Update steps
        if (progress >= 25) {
            steps[0].classList.add('completed');
            steps[1].classList.add('active');
        }
        if (progress >= 50) {
            steps[1].classList.add('completed');
            steps[2].classList.add('active');
        }
        if (progress >= 75) {
            steps[2].classList.add('completed');
            steps[3].classList.add('active');
        }
        
        // When complete
        if (progress >= 100) {
            clearInterval(interval);
            steps[3].classList.add('completed');
            
            // After a short delay, close modal and show results
            setTimeout(() => {
                document.getElementById('analysis-modal').classList.remove('active');
                showAnalysisResults();
            }, 1000);
        }
    }, 50);
}

// Show analysis results
function showAnalysisResults() {
    // Navigate to analytics section
    document.querySelector('.main-nav a[href="#analytics"]').click();
    
    // Add a sample meeting to the select dropdown
    const meetingSelect = document.getElementById('meeting-select');
    const currentDate = new Date();
    const meetingOption = document.createElement('option');
    meetingOption.value = 'meeting-1';
    meetingOption.textContent = `Team Meeting - ${currentDate.toLocaleDateString()}`;
    meetingSelect.appendChild(meetingOption);
    meetingSelect.value = 'meeting-1';
    
    // Update charts with sample data
    updateSampleCharts();
    
    // Update dashboard stats
    updateDashboardStats();
    
    // Generate insights
    generateInsights();
}

// Update sample charts with realistic-looking data
function updateSampleCharts() {
    // Get chart contexts
    const speakingTimeCtx = document.getElementById('speaking-time-chart').getContext('2d');
    const engagementCtx = document.getElementById('engagement-chart').getContext('2d');
    const sentimentCtx = document.getElementById('sentiment-chart').getContext('2d');
    const interactionCtx = document.getElementById('interaction-chart').getContext('2d');
    
    // Sample team members
    const teamMembers = ['Alex', 'Taylor', 'Jordan', 'Morgan', 'Casey'];
    
    // Speaking time distribution
    new Chart(speakingTimeCtx, {
        type: 'pie',
        data: {
            labels: teamMembers,
            datasets: [{
                data: [35, 25, 15, 15, 10],
                backgroundColor: [
                    'rgba(74, 108, 250, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw}% of total speaking time`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Speaking Time Distribution'
                }
            }
        }
    });
    
    // Engagement over time
    const timeLabels = Array.from({length: 12}, (_, i) => `${i*5} min`);
    
    new Chart(engagementCtx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: teamMembers.map((member, index) => {
                // Generate slightly different but realistic engagement patterns for each member
                const colors = [
                    'rgba(74, 108, 250, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)'
                ];
                
                // Create realistic engagement patterns with some variation
                const baseEngagement = Array.from({length: 12}, () => Math.floor(Math.random() * 20) + 60);
                // Add some trends
                if (index === 0) { // Higher engagement at beginning
                    baseEngagement[0] += 20;
                    baseEngagement[1] += 15;
                } else if (index === 1) { // Higher engagement at end
                    baseEngagement[10] += 20;
                    baseEngagement[11] += 15;
                } else if (index === 2) { // Dip in middle
                    baseEngagement[5] -= 15;
                    baseEngagement[6] -= 10;
                }
                
                return {
                    label: member,
                    data: baseEngagement,
                    borderColor: colors[index % colors.length],
                    backgroundColor: colors[index % colors.length].replace('1)', '0.1)'),
                    borderWidth: 2,
                    tension: 0.4
                };
            })
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Engagement Level (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Meeting Timeline'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Engagement Level Over Time'
                }
            }
        }
    });
    
    // Sentiment analysis
    new Chart(sentimentCtx, {
        type: 'bar',
        data: {
            labels: teamMembers,
            datasets: [
                {
                    label: 'Positive',
                    data: [65, 45, 72, 58, 80],
                    backgroundColor: 'rgba(40, 167, 69, 0.8)'
                },
                {
                    label: 'Neutral',
                    data: [25, 35, 18, 32, 15],
                    backgroundColor: 'rgba(108, 117, 125, 0.8)'
                },
                {
                    label: 'Negative',
                    data: [10, 20, 10, 10, 5],
                    backgroundColor: 'rgba(220, 53, 69, 0.8)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Percentage (%)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Sentiment Analysis by Team Member'
                }
            }
        }
    });
    
    // Interaction patterns (bubble chart)
    new Chart(interactionCtx, {
        type: 'bubble',
        data: {
            datasets: [
                {
                    label: 'Alex → Taylor',
                    data: [{x: 1, y: 35, r: 15}],
                    backgroundColor: 'rgba(74, 108, 250, 0.7)'
                },
                {
                    label: 'Taylor → Alex',
                    data: [{x: 2, y: 28, r: 12}],
                    backgroundColor: 'rgba(54, 162, 235, 0.7)'
                },
                {
                    label: 'Alex → Jordan',
                    data: [{x: 3, y: 22, r: 10}],
                    backgroundColor: 'rgba(255, 99, 132, 0.7)'
                },
                {
                    label: 'Jordan → Alex',
                    data: [{x: 4, y: 18, r: 8}],
                    backgroundColor: 'rgba(255, 206, 86, 0.7)'
                },
                {
                    label: 'Taylor → Morgan',
                    data: [{x: 5, y: 15, r: 7}],
                    backgroundColor: 'rgba(75, 192, 192, 0.7)'
                },
                {
                    label: 'Morgan → Casey',
                    data: [{x: 6, y: 12, r: 6}],
                    backgroundColor: 'rgba(153, 102, 255, 0.7)'
                },
                {
                    label: 'Casey → Alex',
                    data: [{x: 7, y: 10, r: 5}],
                    backgroundColor: 'rgba(255, 159, 64, 0.7)'
                },
                {
                    label: 'Other Interactions',
                    data: [{x: 8, y: 8, r: 4}],
                    backgroundColor: 'rgba(201, 203, 207, 0.7)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Number of Interactions'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'right'
                },
                title: {
                    display: true,
                    text: 'Interaction Patterns Between Team Members'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw.y} interactions`;
                        }
                    }
                }
            }
        }
    });
}

// Update dashboard stats with sample data
function updateDashboardStats() {
    // Remove empty state message
    document.querySelector('.metrics-card .empty-state').remove();
    document.getElementById('upload-btn').remove();
    
    // Add recent meeting info
    const metricsCard = document.querySelector('.metrics-card');
    const currentDate = new Date();
    
    metricsCard.innerHTML += `
        <div class="recent-meeting">
            <h4>Team Meeting - ${currentDate.toLocaleDateString()}</h4>
            <p>Duration: 55 minutes</p>
            <p>5 participants</p>
            <a href="#analytics" class="view-details">View details</a>
        </div>
    `;
    
    // Update team health chart
    const teamHealthContainer = document.querySelector('.placeholder-chart');
    teamHealthContainer.innerHTML = '<canvas id="team-health-chart"></canvas>';
    
    const teamHealthCtx = document.getElementById('team-health-chart').getContext('2d');
    new Chart(teamHealthCtx, {
        type: 'radar',
        data: {
            labels: [
                'Engagement',
                'Balanced Participation',
                'Positive Sentiment',
                'Constructive Feedback',
                'Clear Communication',
                'Decision Making'
            ],
            datasets: [{
                label: 'Current Meeting',
                data: [72, 65, 85, 70, 80, 75],
                backgroundColor: 'rgba(74, 108, 250, 0.2)',
                borderColor: 'rgba(74, 108, 250, 1)',
                pointBackgroundColor: 'rgba(74, 108, 250, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(74, 108, 250, 1)'
            }, {
                label: 'Team Average',
                data: [65, 60, 70, 65, 75, 68],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        }
    });
    
    // Update quick stats
    document.querySelectorAll('.stat-card .stat').forEach((stat, index) => {
        switch(index) {
            case 0: // Engagement Score
                stat.textContent = '75/100';
                break;
            case 1: // Participation Balance
                stat.textContent = '68%';
                break;
            case 2: // Sentiment Index
                stat.textContent = '85/100';
                break;
            case 3: // Meeting Efficiency
                stat.textContent = '72%';
                break;
        }
    });
    
    // Add event listener to the view details link
    document.querySelector('.view-details').addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector('.main-nav a[href="#analytics"]').click();
    });
}

// Generate insights from the analysis
function generateInsights() {
    const insightsContainer = document.querySelector('.insights-container');
    
    // Remove empty state
    insightsContainer.innerHTML = '';
    
    // Add insights cards
    const insights = [
        {
            title: 'Participation Balance',
            icon: '⚖️',
            text: 'Alex dominated the conversation at 35% of speaking time. Consider encouraging more participation from Casey who only spoke for 10% of the meeting.',
            recommendation: 'Try round-robin techniques where each team member gets dedicated time to share their thoughts.'
        },
        {
            title: 'Engagement Patterns',
            icon: '📈',
            text: 'Team engagement dropped noticeably around the middle of the meeting. This often indicates topic fatigue or loss of focus.',
            recommendation: 'For longer meetings, plan a short break or energizing activity at the 30-minute mark to maintain attention.'
        },
        {
            title: 'Positive Collaboration',
            icon: '🤝',
            text: 'Casey showed the highest positive sentiment (80%) and used constructive language throughout the meeting.',
            recommendation: 'Acknowledge Casey\'s positive communication style in your next team check-in.'
        },
        {
            title: 'Action Items',
            icon: '✅',
            text: 'Several action items were discussed but not clearly assigned or scheduled.',
            recommendation: 'End meetings with a clear review of action items, owners, and deadlines.'
        }
    ];
    
    insights.forEach(insight => {
        const insightCard = document.createElement('div');
        insightCard.className = 'insights-card';
        insightCard.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 24px; margin-right: 15px;">${insight.icon}</span>
                <h3>${insight.title}</h3>
            </div>
            <p>${insight.text}</p>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                <h4 style="margin-bottom: 10px; color: var(--primary-color);">Recommendation</h4>
                <p>${insight.recommendation}</p>
            </div>
        `;
        insightsContainer.appendChild(insightCard);
    });
}

// Initialize charts with empty state
function initCharts() {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded');
        return;
    }
    
    // Set default font for all charts
    Chart.defaults.font.family = 'var(--font-main)';
    Chart.defaults.color = '#666';
}

// Initialize settings
function initSettings() {
    const saveSettingsBtn = document.getElementById('save-settings');
    
    saveSettingsBtn.addEventListener('click', function() {
        // Show save confirmation
        const userName = document.getElementById('user-name').value;
        
        // Create and show a notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div style="background-color: var(--success-color); color: white; padding: 15px 20px; border-radius: var(--border-radius); box-shadow: var(--box-shadow); position: fixed; bottom: 20px; right: 20px; z-index: 1000; display: flex; align-items: center;">
                <span style="margin-right: 10px;">✓</span>
                <span>Settings saved successfully!</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Update user name in the top bar
        document.querySelector('.user-name').textContent = `Welcome, ${userName}`;
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    });
}

// Show welcome message
function showWelcomeMessage() {
    // Create welcome modal dynamically
    const welcomeModal = document.createElement('div');
    welcomeModal.className = 'modal active';
    welcomeModal.id = 'welcome-modal';
    
    welcomeModal.innerHTML = `
        <div class="modal-content" style="text-align: center;">
            <h2 style="color: var(--primary-color); margin-bottom: 20px;">Welcome to TeamSync!</h2>
            <p style="margin-bottom: 15px;">Your AI-powered assistant for better team meetings and collaboration.</p>
            
            <div style="margin: 30px 0;">
                <img src="/api/placeholder/300/200" alt="TeamSync illustration" style="max-width: 100%;">
            </div>
            
            <p style="margin-bottom: 25px;">TeamSync analyzes your meeting recordings to provide actionable insights about team dynamics, participation balance, and engagement patterns.</p>
            
            <div style="display: flex; justify-content: center;">
                <button id="welcome-continue" class="primary-btn">Get Started</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(welcomeModal);
    
    // Add event listener to close welcome modal
    document.getElementById('welcome-continue').addEventListener('click', function() {
        welcomeModal.remove();
    });
}

// Add event listener for modal close buttons
document.querySelectorAll('.close-modal').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
        this.closest('.modal').classList.remove('active');
    });
});