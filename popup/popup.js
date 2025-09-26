class PopupController {
  constructor() {
    this.elements = {
      scrapeBtn: document.getElementById('scrapeBtn'),
      scrapeAllBtn: document.getElementById('scrapeAllBtn'),
      stopBtn: document.getElementById('stopBtn'),
      urlDisplay: document.getElementById('urlDisplay'),
      progressSection: document.getElementById('progressSection'),
      progressFill: document.getElementById('progressFill'),
      progressText: document.getElementById('progressText'),
      statusSection: document.getElementById('statusSection'),
      statusMessage: document.getElementById('statusMessage'),
      wordCount: document.getElementById('wordCount'),
      fileSize: document.getElementById('fileSize'),
      includeLinks: document.getElementById('includeLinks'),
      waitForDynamic: document.getElementById('waitForDynamic'),
      includeEmbedded: document.getElementById('includeEmbedded'),
      // Detailed progress elements
      currentAction: document.getElementById('currentAction'),
      expandedCount: document.getElementById('expandedCount'),
      foundLinks: document.getElementById('foundLinks'),
      scrapedCount: document.getElementById('scrapedCount'),
      actionsList: document.getElementById('actionsList'),
      // Preview elements
      contentPreview: document.getElementById('contentPreview'),
      previewContent: document.getElementById('previewContent'),
      togglePreview: document.getElementById('togglePreview'),
      // Session elements
      reconnectionBanner: document.getElementById('reconnectionBanner')
    };
    
    this.currentTab = null;
    this.isScrapingInProgress = false;
    this.isComprehensiveMode = false;
    
    // Progress tracking
    this.stats = {
      expandedCount: 0,
      foundLinks: 0,
      scrapedCount: 0
    };
    
    // Live preview data
    this.previewData = [];
    this.previewVisible = false;
    
    this.init();
  }
  
  async init() {
    await this.loadCurrentTab();
    this.setupEventListeners();
    await this.checkForActiveSession();
    this.updateUI();
  }
  
  async loadCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tabs[0];
      
      if (this.currentTab) {
        this.elements.urlDisplay.textContent = this.truncateUrl(this.currentTab.url);
      }
    } catch (error) {
      console.error('Error loading current tab:', error);
      this.showStatus('Error loading current tab', 'error');
    }
  }
  
  setupEventListeners() {
    this.elements.scrapeBtn.addEventListener('click', () => this.handleScrapeClick());
    this.elements.scrapeAllBtn.addEventListener('click', () => this.handleScrapeAllClick());
    this.elements.stopBtn.addEventListener('click', () => this.handleStopClick());
    this.elements.togglePreview.addEventListener('click', () => this.togglePreviewVisibility());
    
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });
  }
  
  async handleScrapeClick() {
    if (this.isScrapingInProgress) {
      return;
    }
    
    if (!this.currentTab) {
      this.showStatus('No active tab found', 'error');
      return;
    }
    
    // Check if the URL is scrapeable
    if (!this.isValidUrl(this.currentTab.url)) {
      this.showStatus('Cannot scrape this page type', 'error');
      return;
    }
    
    try {
      this.isComprehensiveMode = false;
      this.startScraping();
      
      // First, ensure content script is injected and ready
      await this.ensureContentScriptReady();
      
      const options = {
        includeLinks: this.elements.includeLinks.checked,
        waitForDynamic: this.elements.waitForDynamic.checked,
        includeEmbedded: this.elements.includeEmbedded.checked
      };
      
      // Send message to content script to start scraping
      try {
        const response = await Promise.race([
          chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'startScraping',
            options: options
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Message timeout')), 5000)
          )
        ]);
        
        if (response && response.success) {
          // Content script will send progress updates
        } else {
          throw new Error(response?.error || 'Failed to start scraping');
        }
      } catch (error) {
        if (error.message === 'Message timeout') {
          // Assume scraping started even without response
          console.log('Message timeout, but scraping may have started');
        } else {
          throw error;
        }
      }
      
    } catch (error) {
      console.error('Scraping error:', error);
      
      if (error.message.includes('Could not establish connection')) {
        this.showStatus('Please refresh the page and try again', 'error');
      } else {
        this.showStatus(`Error: ${error.message}`, 'error');
      }
      
      this.stopScraping();
    }
  }
  
  async handleScrapeAllClick() {
    if (this.isScrapingInProgress) {
      return;
    }
    
    if (!this.currentTab) {
      this.showStatus('No active tab found', 'error');
      return;
    }
    
    // Check if the URL is scrapeable
    if (!this.isValidUrl(this.currentTab.url)) {
      this.showStatus('Cannot scrape this page type', 'error');
      return;
    }
    
    try {
      this.isComprehensiveMode = true;
      this.startScraping();
      
      // First, ensure content script is injected and ready
      await this.ensureContentScriptReady();
      
      const options = {
        includeLinks: this.elements.includeLinks.checked,
        waitForDynamic: this.elements.waitForDynamic.checked,
        includeEmbedded: this.elements.includeEmbedded.checked,
        scrapeAll: true
      };
      
      // Send message to content script to start comprehensive scraping
      try {
        const response = await Promise.race([
          chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'startScrapingAll',
            options: options
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Message timeout')), 5000)
          )
        ]);
        
        if (response && response.success) {
          // Content script will send progress updates
        } else {
          throw new Error(response?.error || 'Failed to start comprehensive scraping');
        }
      } catch (error) {
        if (error.message === 'Message timeout') {
          // Assume comprehensive scraping started even without response
          console.log('Message timeout, but comprehensive scraping may have started');
        } else {
          throw error;
        }
      }
      
    } catch (error) {
      console.error('Comprehensive scraping error:', error);
      
      if (error.message.includes('Could not establish connection')) {
        this.showStatus('Please refresh the page and try again', 'error');
      } else {
        this.showStatus(`Error: ${error.message}`, 'error');
      }
      
      this.stopScraping();
    }
  }
  
  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'scrapingProgress':
        this.updateProgress(message.progress, message.status);
        if (message.currentAction) {
          this.updateCurrentAction(message.currentAction);
        }
        break;
        
      case 'detailedProgress':
        this.updateDetailedProgress(message.data);
        break;
        
      case 'contentUpdate':
        this.updatePreviewContent(message.data);
        break;
        
      case 'scrapingComplete':
        this.handleScrapingComplete(message.data);
        break;
        
      case 'scrapingError':
        this.showStatus(`Error: ${message.error}`, 'error');
        this.stopScraping();
        break;
    }
  }
  
  startScraping() {
    this.isScrapingInProgress = true;
    this.elements.scrapeBtn.disabled = true;
    this.elements.scrapeAllBtn.disabled = true;
    this.elements.stopBtn.classList.remove('hidden');
    this.elements.scrapeBtn.querySelector('.button-text').textContent = 'Scraping';
    this.elements.scrapeBtn.classList.add('scraping');
    this.elements.progressSection.classList.remove('hidden');
    this.elements.statusMessage.textContent = '';
    
    // Reset stats
    this.stats = { expandedCount: 0, foundLinks: 0, scrapedCount: 0 };
    this.updateStatsDisplay();
    
    // Clear actions list and preview
    this.elements.actionsList.innerHTML = '';
    this.previewData = [];
    this.elements.previewContent.textContent = '';
    
    // Show preview area during comprehensive scraping
    if (this.isComprehensiveMode) {
      this.elements.contentPreview.classList.remove('hidden');
      this.previewVisible = true;
    }
    
    // Add comprehensive mode styling
    if (this.isComprehensiveMode) {
      document.body.classList.add('comprehensive-mode');
    }
    
    this.updateProgress(0, 'Initializing...');
    this.updateCurrentAction('🚀 Starting comprehensive scraping...');
    
    // Register active session
    this.registerActiveSession();
  }
  
  async handleStopClick() {
    if (!this.isScrapingInProgress) {
      return;
    }
    
    this.showStatus('Stopping and saving partial results...', 'info');
    this.addRecentAction('⏹️ Stopping and saving partial data...', 'warning');
    
    // Send stop message to content script
    try {
      // Don't wait for response from stop message to prevent channel errors
      chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'stopScraping'
      }).catch(error => {
        console.log('Stop message delivery failed (this is often normal):', error);
      });
      
      // Give it a moment to process the stop, then check for results
      setTimeout(() => {
        this.showStatus('Stop signal sent, waiting for partial results...', 'info');
      }, 1000);
      
    } catch (error) {
      console.log('Could not send stop message:', error);
      this.showStatus('Could not stop scraping cleanly', 'error');
      this.stopScraping();
    }
  }
  
  stopScraping() {
    this.isScrapingInProgress = false;
    this.isComprehensiveMode = false;
    this.elements.scrapeBtn.disabled = false;
    this.elements.scrapeAllBtn.disabled = false;
    this.elements.stopBtn.classList.add('hidden');
    this.elements.scrapeBtn.querySelector('.button-text').textContent = 'Scrape Current Page';
    this.elements.scrapeBtn.classList.remove('scraping');
    this.elements.progressSection.classList.add('hidden');
    this.elements.contentPreview.classList.add('hidden');
    
    // Remove comprehensive mode styling
    document.body.classList.remove('comprehensive-mode');
    document.body.classList.remove('session-reconnected');
    
    // Hide reconnection banner
    this.elements.reconnectionBanner.classList.add('hidden');
    
    // Clear active session
    this.clearActiveSession();
  }
  
  updateProgress(progress, status) {
    this.elements.progressFill.style.width = `${progress}%`;
    this.elements.progressText.textContent = status;
  }
  
  updateCurrentAction(action) {
    this.elements.currentAction.textContent = action;
  }
  
  updateDetailedProgress(data) {
    if (data.expandedCount !== undefined) {
      this.stats.expandedCount = data.expandedCount;
    }
    if (data.foundLinks !== undefined) {
      this.stats.foundLinks = data.foundLinks;
    }
    if (data.scrapedCount !== undefined) {
      this.stats.scrapedCount = data.scrapedCount;
    }
    
    this.updateStatsDisplay();
    
    if (data.action) {
      this.addRecentAction(data.action, data.actionType || 'info');
    }
    
    if (data.currentAction) {
      this.updateCurrentAction(data.currentAction);
    }
  }
  
  updateStatsDisplay() {
    this.elements.expandedCount.textContent = `Expanded: ${this.stats.expandedCount}`;
    this.elements.foundLinks.textContent = `Found: ${this.stats.foundLinks}`;
    this.elements.scrapedCount.textContent = `Scraped: ${this.stats.scrapedCount}`;
  }
  
  addRecentAction(action, type = 'info') {
    const actionItem = document.createElement('div');
    actionItem.className = `action-item ${type}`;
    actionItem.textContent = action;
    
    // Add to top of list
    this.elements.actionsList.insertBefore(actionItem, this.elements.actionsList.firstChild);
    
    // Keep only last 8 actions
    while (this.elements.actionsList.children.length > 8) {
      this.elements.actionsList.removeChild(this.elements.actionsList.lastChild);
    }
    
    // Auto-scroll to show latest
    this.elements.actionsList.scrollTop = 0;
  }
  
  togglePreviewVisibility() {
    this.previewVisible = !this.previewVisible;
    
    if (this.previewVisible) {
      this.elements.contentPreview.classList.remove('hidden');
      this.elements.togglePreview.textContent = '📄';
    } else {
      this.elements.contentPreview.classList.add('hidden');
      this.elements.togglePreview.textContent = '👁️';
    }
  }
  
  updatePreviewContent(contentData) {
    if (!contentData) return;
    
    // Add this content to our preview data
    this.previewData.push(contentData);
    
    // Generate preview text
    const previewText = this.generatePreviewText();
    
    // Update preview display
    this.elements.previewContent.textContent = previewText;
    
    // Auto-scroll to bottom to show latest content
    this.elements.previewContent.scrollTop = this.elements.previewContent.scrollHeight;
  }
  
  generatePreviewText() {
    let preview = '';
    
    for (const item of this.previewData) {
      if (item.sectionTitle) {
        preview += `\n# ${item.sectionTitle}\n`;
      }
      if (item.content) {
        // Add a snippet of the content (first 200 chars)
        const snippet = item.content.substring(0, 200);
        preview += snippet;
        if (item.content.length > 200) {
          preview += '...\n';
        }
        preview += '\n---\n';
      }
    }
    
    return preview.trim();
  }
  
  async handleScrapingComplete(data) {
    try {
      this.updateProgress(90, 'Generating file...');
      
      // Create the text content
      const textContent = this.formatContentForLLM(data);
      
      // Generate filename
      const isComprehensive = data.title && data.title.includes('Complete Documentation');
      const isPartial = data.title && data.title.includes('PARTIAL');
      const filename = this.generateFilename(data.title || 'webpage', isComprehensive, isPartial);
      
      // Request download through background script
      const downloadResponse = await chrome.runtime.sendMessage({
        action: 'downloadFile',
        content: textContent,
        filename: filename
      });
      
      if (downloadResponse.success) {
        this.updateProgress(100, 'Complete!');
        this.showStatus(`Successfully saved: ${filename}`, 'success');
        this.updateStats(data.wordCount, textContent.length);
        
        setTimeout(() => {
          this.stopScraping();
        }, 2000);
      } else {
        throw new Error(downloadResponse.error || 'Download failed');
      }
      
    } catch (error) {
      console.error('Error handling scraping completion:', error);
      this.showStatus(`Error saving file: ${error.message}`, 'error');
      this.stopScraping();
    }
  }
  
  formatContentForLLM(data) {
    const timestamp = new Date().toISOString();
    const wordCount = data.wordCount || this.estimateWordCount(data.content);
    
    let content = `# ${data.title || 'Webpage Content'}\n\n`;
    content += `**URL:** ${data.url}\n`;
    content += `**Scraped:** ${timestamp}\n`;
    content += `**Word Count:** ~${wordCount}\n`;
    content += `**Sections Found:** ${data.sectionsCount || 'N/A'}\n\n`;
    content += `---\n\n`;
    content += data.content;
    
    return content;
  }
  
  generateFilename(title, isComprehensive = false, isPartial = false) {
    // Clean the title for use as filename
    const cleanTitle = title
      .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/^PARTIAL[-_\s]*/, '') // Remove PARTIAL prefix if present
      .substring(0, 50); // Limit length
    
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    
    let prefix = '';
    if (isPartial) {
      prefix = 'PARTIAL_';
    } else if (isComprehensive) {
      prefix = 'COMPLETE_DOCS_';
    }
    
    return `${prefix}${cleanTitle}_${timestamp}.txt`;
  }
  
  estimateWordCount(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  updateStats(wordCount, fileSize) {
    this.elements.wordCount.textContent = `Words: ${wordCount || '--'}`;
    this.elements.fileSize.textContent = `Size: ${this.formatFileSize(fileSize)}`;
  }
  
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  showStatus(message, type = 'info') {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.className = `status-message ${type}`;
  }
  
  isValidUrl(url) {
    // Check if the URL is scrapeable (not chrome:// or extension pages)
    return url && (url.startsWith('http://') || url.startsWith('https://'));
  }
  
  truncateUrl(url, maxLength = 40) {
    if (url.length <= maxLength) {
      return url;
    }
    return url.substring(0, maxLength) + '...';
  }
  
  async checkForActiveSession() {
    if (!this.currentTab) return;
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSessionStatus',
        tabId: this.currentTab.id
      });
      
      if (response.success && response.hasActiveSession) {
        console.log('🔄 Found active scraping session, reconnecting...');
        this.reconnectToActiveSession(response.session);
      }
    } catch (error) {
      console.log('No active session found:', error);
    }
  }
  
  reconnectToActiveSession(session) {
    // Restore UI state
    this.isScrapingInProgress = true;
    this.isComprehensiveMode = session.isComprehensive;
    
    // Update UI to show active session
    this.showActiveSessionUI(session);
    
    // Try to reconnect to content script for live updates
    this.attemptContentScriptReconnection();
  }
  
  showActiveSessionUI(session) {
    // Show reconnection banner
    this.elements.reconnectionBanner.classList.remove('hidden');
    document.body.classList.add('session-reconnected');
    
    // Update button states
    this.elements.scrapeBtn.disabled = true;
    this.elements.scrapeAllBtn.disabled = true;
    this.elements.stopBtn.classList.remove('hidden');
    
    // Show progress section
    this.elements.progressSection.classList.remove('hidden');
    this.elements.contentPreview.classList.remove('hidden');
    
    // Update status
    const timeRunning = Math.floor((Date.now() - session.startTime) / 1000);
    this.showStatus(`Reconnected to active session (running ${timeRunning}s)`, 'info');
    
    // Update current action
    this.updateCurrentAction(session.currentAction || '🔄 Session in progress...');
    
    // Update stats if available
    if (session.stats) {
      this.stats = session.stats;
      this.updateStatsDisplay();
    }
    
    // Add comprehensive mode styling if needed
    if (session.isComprehensive) {
      document.body.classList.add('comprehensive-mode');
      this.elements.contentPreview.classList.remove('hidden');
      this.previewVisible = true;
    }
    
    // Add reconnection notice
    this.addRecentAction('🔄 Reconnected to active session', 'info');
    this.addRecentAction(`⏰ Session running for ${Math.floor((Date.now() - session.startTime) / 1000)}s`, 'info');
    
    // Hide banner after 5 seconds
    setTimeout(() => {
      this.elements.reconnectionBanner.classList.add('hidden');
    }, 5000);
  }
  
  async attemptContentScriptReconnection() {
    try {
      // Try to ping the content script to resume updates
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'ping'
      });
      
      if (response && response.ready) {
        console.log('✅ Successfully reconnected to content script');
        this.addRecentAction('✅ Live updates reconnected', 'success');
      }
    } catch (error) {
      console.log('⚠️ Could not reconnect to content script:', error);
      this.addRecentAction('⚠️ Live updates unavailable (session still active)', 'warning');
    }
  }
  
  async registerActiveSession() {
    if (!this.currentTab) return;
    
    try {
      await chrome.runtime.sendMessage({
        action: 'registerSession',
        tabId: this.currentTab.id,
        status: 'active',
        currentAction: this.elements.currentAction.textContent,
        stats: this.stats,
        isComprehensive: this.isComprehensiveMode,
        url: this.currentTab.url
      });
      console.log('📝 Registered active session');
    } catch (error) {
      console.log('Failed to register session:', error);
    }
  }
  
  async clearActiveSession() {
    if (!this.currentTab) return;
    
    try {
      await chrome.runtime.sendMessage({
        action: 'clearSession',
        tabId: this.currentTab.id
      });
      console.log('🗑️ Cleared active session');
    } catch (error) {
      console.log('Failed to clear session:', error);
    }
  }
  
  updateUI() {
    // Any additional UI updates can go here
  }
  
  async ensureContentScriptReady() {
    try {
      // Try to ping the content script first
      const pingResponse = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'ping'
      });
      
      if (pingResponse && pingResponse.ready) {
        return; // Content script is ready
      }
    } catch (error) {
      // Content script not responding, need to inject it
    }
    
    // Inject the content script manually
    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        files: ['content/content.js']
      });
      
      // Wait a moment for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify it's now ready
      const verifyResponse = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'ping'
      });
      
      if (!verifyResponse || !verifyResponse.ready) {
        throw new Error('Content script failed to initialize');
      }
      
    } catch (error) {
      throw new Error('Failed to inject content script: ' + error.message);
    }
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
