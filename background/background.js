class BackgroundService {
  constructor() {
    this.setupMessageListener();
    this.setupContextMenu();
    
    // Session state management
    this.activeSessions = new Map(); // tabId -> session info
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'downloadFile') {
        this.handleDownloadRequest(message, sendResponse);
        return true; // Keep the message channel open for async response
      } else if (message.action === 'registerSession') {
        this.registerSession(message, sender, sendResponse);
        return true;
      } else if (message.action === 'getSessionStatus') {
        this.getSessionStatus(message, sender, sendResponse);
        return true;
      } else if (message.action === 'clearSession') {
        this.clearSession(message, sender, sendResponse);
        return true;
      }
    });
  }
  
  setupContextMenu() {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: 'scrapePage',
        title: 'Scrape page text for LLM',
        contexts: ['page']
      });
    });
    
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'scrapePage') {
        // Open the popup or trigger scraping directly
        chrome.action.openPopup();
      }
    });
  }
  
  async handleDownloadRequest(message, sendResponse) {
    try {
      const { content, filename } = message;
      
      if (!content || !filename) {
        throw new Error('Missing content or filename');
      }
      
      console.log(`📁 Processing download request: ${filename} (${content.length} characters)`);
      
      // Convert content to base64 data URL for service worker compatibility
      // Use chunked approach for large files to avoid stack overflow
      let base64;
      try {
        if (content.length > 100000) { // For large files > 100KB
          console.log('🔄 Using chunked base64 encoding for large file...');
          base64 = await this.encodeBase64Chunked(content);
        } else {
          console.log('🔄 Using standard base64 encoding...');
          const encoder = new TextEncoder();
          const data = encoder.encode(content);
          base64 = this.arrayBufferToBase64(data);
        }
      } catch (encodingError) {
        console.error('❌ Base64 encoding failed:', encodingError);
        throw new Error(`Encoding failed: ${encodingError.message}`);
      }
      
      const dataUrl = `data:text/plain;charset=utf-8;base64,${base64}`;
      
      console.log(`📥 Starting download: ${filename} (data URL length: ${dataUrl.length})`);
      
      // Start the download
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: false // Auto-save to downloads folder
      });
      
      console.log(`✅ Download started successfully with ID: ${downloadId}`);
      
      // Monitor download completion
      const downloadCompletePromise = new Promise((resolve, reject) => {
        const listener = (downloadDelta) => {
          if (downloadDelta.id === downloadId) {
            console.log(`📥 Download ${downloadId} status update:`, downloadDelta);
            
            if (downloadDelta.state && downloadDelta.state.current === 'complete') {
              console.log(`✅ Download ${downloadId} completed successfully`);
              chrome.downloads.onChanged.removeListener(listener);
              resolve(downloadId);
            } else if (downloadDelta.error) {
              console.error(`❌ Download ${downloadId} failed:`, downloadDelta.error);
              chrome.downloads.onChanged.removeListener(listener);
              reject(new Error(downloadDelta.error.current));
            }
          }
        };
        
        chrome.downloads.onChanged.addListener(listener);
        
        // Timeout after 60 seconds (increased for large files)
        setTimeout(() => {
          console.warn(`⏰ Download ${downloadId} timed out after 60 seconds`);
          chrome.downloads.onChanged.removeListener(listener);
          reject(new Error('Download timeout after 60 seconds'));
        }, 60000);
      });
      
      await downloadCompletePromise;
      
      sendResponse({ 
        success: true, 
        downloadId: downloadId,
        filename: filename 
      });
      
    } catch (error) {
      console.error('Download error:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }
  
  // Handle extension icon click
  handleActionClick(tab) {
    // This is handled by the popup, but we could add direct scraping logic here
    chrome.action.openPopup();
  }
  
  // Session management methods
  registerSession(message, sender, sendResponse) {
    const tabId = sender.tab?.id || message.tabId;
    if (tabId) {
      this.activeSessions.set(tabId, {
        tabId: tabId,
        status: message.status || 'active',
        startTime: Date.now(),
        currentAction: message.currentAction || 'Starting...',
        stats: message.stats || { expandedCount: 0, foundLinks: 0, scrapedCount: 0 },
        isComprehensive: message.isComprehensive || false,
        url: sender.tab?.url || message.url
      });
      
      console.log(`📝 Registered session for tab ${tabId}`);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No tab ID' });
    }
  }
  
  getSessionStatus(message, sender, sendResponse) {
    const tabId = sender.tab?.id || message.tabId;
    const session = this.activeSessions.get(tabId);
    
    if (session) {
      console.log(`📊 Found active session for tab ${tabId}`);
      sendResponse({ 
        success: true, 
        hasActiveSession: true,
        session: session 
      });
    } else {
      console.log(`❌ No active session for tab ${tabId}`);
      sendResponse({ 
        success: true, 
        hasActiveSession: false 
      });
    }
  }
  
  clearSession(message, sender, sendResponse) {
    const tabId = sender.tab?.id || message.tabId;
    if (this.activeSessions.has(tabId)) {
      this.activeSessions.delete(tabId);
      console.log(`🗑️ Cleared session for tab ${tabId}`);
    }
    sendResponse({ success: true });
  }
  
  updateSession(tabId, updates) {
    const session = this.activeSessions.get(tabId);
    if (session) {
      Object.assign(session, updates);
    }
  }
  
  // Efficient base64 encoding methods to avoid stack overflow
  arrayBufferToBase64(buffer) {
    // For smaller files, use the standard approach
    if (buffer.length < 50000) {
      return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }
    
    // For larger files, process in chunks
    const chunks = [];
    const chunkSize = 8192; // 8KB chunks
    const uint8Array = new Uint8Array(buffer);
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      chunks.push(String.fromCharCode(...chunk));
    }
    
    return btoa(chunks.join(''));
  }
  
  async encodeBase64Chunked(content) {
    return new Promise((resolve, reject) => {
      try {
        // Process very large content in smaller chunks
        const encoder = new TextEncoder();
        const chunkSize = 50000; // 50KB text chunks
        const chunks = [];
        
        console.log(`🔄 Processing ${Math.ceil(content.length / chunkSize)} chunks...`);
        
        // Process content in chunks to avoid overwhelming the encoder
        for (let i = 0; i < content.length; i += chunkSize) {
          const textChunk = content.slice(i, i + chunkSize);
          const encodedChunk = encoder.encode(textChunk);
          chunks.push(encodedChunk);
        }
        
        // Combine all chunks into one array buffer
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Convert to base64 using chunked approach
        const base64 = this.arrayBufferToBase64(combined.buffer);
        console.log(`✅ Successfully encoded ${content.length} characters to base64`);
        resolve(base64);
        
      } catch (error) {
        console.error('❌ Chunked encoding failed:', error);
        reject(error);
      }
    });
  }
}

// Initialize the background service
new BackgroundService();
