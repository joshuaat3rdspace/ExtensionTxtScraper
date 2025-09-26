class ContentScraper {
  constructor() {
    this.options = {
      includeLinks: true,
      waitForDynamic: true,
      includeEmbedded: true
    };
    
    this.shouldStop = false;
    this.currentScrapeData = [];
    this.isProcessingSections = false;
    
    this.setupMessageListener();
    console.log('🤖 LLM Text Scraper - Content script initialized');
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'ping') {
        sendResponse({ ready: true });
        return false;
      } else if (message.action === 'startScraping') {
        this.handleScrapingRequest(message.options, sendResponse);
        return false; // Don't keep channel open - respond immediately
      } else if (message.action === 'startScrapingAll') {
        this.handleComprehensiveScrapingRequest(message.options, sendResponse);
        return false; // Don't keep channel open - respond immediately
      } else if (message.action === 'stopScraping') {
        this.handleStopRequest(sendResponse);
        return false;
      }
    });
  }
  
  async handleScrapingRequest(options, sendResponse) {
    // Respond immediately to prevent channel closure
    sendResponse({ success: true });
    
    try {
      this.options = { ...this.options, ...options };
      
      this.sendProgress(0, 'Starting extraction...');
      
      // Wait for dynamic content if requested
      if (this.options.waitForDynamic) {
        this.sendProgress(10, 'Waiting for dynamic content...');
        await this.waitForDynamicContent();
      }
      
      this.sendProgress(20, 'Analyzing page structure...');
      
      // Extract main content
      const extractedData = await this.extractPageContent();
      
      this.sendProgress(80, 'Processing extracted content...');
      
      // Send completion message
      chrome.runtime.sendMessage({
        type: 'scrapingComplete',
        data: extractedData
      });
      
    } catch (error) {
      console.error('Content scraping error:', error);
      chrome.runtime.sendMessage({
        type: 'scrapingError',
        error: error.message
      });
    }
  }
  
  handleStopRequest(sendResponse) {
    console.log('⏹️ Stop scraping requested');
    this.shouldStop = true;
    this.isProcessingSections = false; // Clear processing flag when stopping
    
    // Send any partial data we've collected
    if (this.currentScrapeData.length > 0) {
      console.log(`📦 Sending partial data: ${this.currentScrapeData.length} sections`);
      const partialData = this.combineAllContent(this.currentScrapeData);
      partialData.title = 'PARTIAL - ' + partialData.title;
      
      // Send completion message immediately without waiting for async
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'scrapingComplete',
          data: partialData
        });
      }, 100);
    }
    
    // Respond immediately to prevent channel closure
    sendResponse({ success: true, stopped: true });
  }
  
  async handleComprehensiveScrapingRequest(options, sendResponse) {
    // Respond immediately to prevent channel closure
    sendResponse({ success: true });
    
    try {
      console.log('🚀 Starting section-by-section documentation scraping...');
      console.log('Options:', options);
      
      this.options = { ...this.options, ...options };
      this.shouldStop = false;
      this.currentScrapeData = [];
      this.isProcessingSections = false; // Reset processing flag for new session
      
      this.sendProgress(0, 'Finding documentation sections...');
      
      // NEW STRATEGY: Section-by-section approach
      const allContent = await this.sectionBySectionScraping();
      
      if (this.shouldStop) {
        console.log('⏹️ Scraping was stopped by user');
        return;
      }
      
      console.log(`✅ Scraping complete: ${allContent.length} sections with content`);
      
      this.sendProgress(90, 'Combining all documentation...');
      
      // Combine all content
      const combinedData = this.combineAllContent(allContent);
      
      console.log(`📄 Final result: ${combinedData.wordCount} words across ${combinedData.sectionsCount} sections`);
      
      this.sendProgress(95, 'Finalizing comprehensive documentation...');
      
      // Send completion message with size check
      const dataSize = JSON.stringify(combinedData).length;
      console.log(`📊 Final data size: ${dataSize} characters`);
      
      if (dataSize > 50 * 1024 * 1024) { // 50MB limit
        console.warn('⚠️ Data too large, truncating...');
        combinedData.content = combinedData.content.substring(0, 50 * 1024 * 1024 - 10000) + '\n\n[Content truncated due to size]';
        combinedData.wordCount = this.estimateWordCount(combinedData.content);
      }
      
      chrome.runtime.sendMessage({
        type: 'scrapingComplete',
        data: combinedData
      });
      
    } catch (error) {
      console.error('❌ Comprehensive scraping error:', error);
      chrome.runtime.sendMessage({
        type: 'scrapingError',
        error: error.message
      });
    }
  }
  
  sendProgress(progress, status) {
    chrome.runtime.sendMessage({
      type: 'scrapingProgress',
      progress: progress,
      status: status
    });
  }
  
  sendDetailedProgress(data) {
    try {
      // Ensure data is serializable and not circular
      const safeData = JSON.parse(JSON.stringify(data));
      chrome.runtime.sendMessage({
        type: 'detailedProgress',
        data: safeData
      });
    } catch (error) {
      console.warn('Could not send detailed progress:', error);
      // Send minimal safe update
      chrome.runtime.sendMessage({
        type: 'detailedProgress',
        data: { action: 'Progress update failed', actionType: 'warning' }
      });
    }
  }
  
  sendContentUpdate(contentData) {
    try {
      // Create a safe, serializable version of the content data
      const safeContentData = {
        sectionTitle: String(contentData.sectionTitle || ''),
        content: String(contentData.content || '').substring(0, 500), // Limit preview size
        wordCount: Number(contentData.wordCount || 0)
      };
      
      chrome.runtime.sendMessage({
        type: 'contentUpdate',
        data: safeContentData
      });
    } catch (error) {
      console.warn('Could not send content update:', error);
    }
  }
  
  async waitForDynamicContent() {
    // Wait for potential dynamic content loading
    const maxWaitTime = 5000; // 5 seconds max
    const checkInterval = 500; // Check every 500ms
    let waitTime = 0;
    
    const initialHeight = document.body.scrollHeight;
    
    while (waitTime < maxWaitTime) {
      await this.sleep(checkInterval);
      waitTime += checkInterval;
      
      // Check if page height has changed (indicating new content)
      const currentHeight = document.body.scrollHeight;
      if (currentHeight > initialHeight) {
        // Give a bit more time for content to stabilize
        await this.sleep(1000);
        break;
      }
      
      // Also check for loading indicators
      const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [id*="loading"]');
      if (loadingElements.length === 0) {
        break;
      }
    }
    
    // Scroll to trigger any lazy loading
    await this.triggerLazyLoading();
  }
  
  async triggerLazyLoading() {
    const scrollStep = window.innerHeight / 2;
    const maxScroll = document.body.scrollHeight;
    let currentScroll = 0;
    
    while (currentScroll < maxScroll) {
      window.scrollTo(0, currentScroll);
      await this.sleep(100);
      currentScroll += scrollStep;
    }
    
    // Scroll back to top
    window.scrollTo(0, 0);
    await this.sleep(500);
  }
  
  async extractPageContent() {
    const data = {
      url: window.location.href,
      title: this.extractTitle(),
      content: '',
      wordCount: 0,
      sectionsCount: 0
    };
    
    // Find main content areas
    const contentAreas = this.findMainContentAreas();
    
    this.sendProgress(30, 'Extracting text content...');
    
    let allContent = [];
    let sectionCount = 0;
    
    for (const area of contentAreas) {
      const sectionContent = this.extractTextFromElement(area);
      if (sectionContent.trim()) {
        allContent.push(sectionContent);
        sectionCount++;
      }
    }
    
    this.sendProgress(50, 'Processing embedded content...');
    
    // Extract embedded content if requested
    if (this.options.includeEmbedded) {
      const embeddedContent = await this.extractEmbeddedContent();
      if (embeddedContent.trim()) {
        allContent.push('\n\n## Embedded Content\n\n' + embeddedContent);
        sectionCount++;
      }
    }
    
    this.sendProgress(70, 'Formatting content...');
    
    // Combine and format content safely
    data.content = allContent.join('\n\n');
    data.wordCount = this.estimateWordCount(data.content);
    data.sectionsCount = sectionCount;
    
    // Ensure all properties are primitives (no circular references)
    return {
      url: String(data.url),
      title: String(data.title),
      content: String(data.content),
      wordCount: Number(data.wordCount),
      sectionsCount: Number(data.sectionsCount)
    };
  }
  
  extractTitle() {
    // Try multiple methods to get the page title
    const titleElement = document.querySelector('title');
    const h1Element = document.querySelector('h1');
    const metaTitle = document.querySelector('meta[property="og:title"]');
    
    if (titleElement && titleElement.textContent.trim()) {
      return titleElement.textContent.trim();
    }
    
    if (h1Element && h1Element.textContent.trim()) {
      return h1Element.textContent.trim();
    }
    
    if (metaTitle && metaTitle.getAttribute('content')) {
      return metaTitle.getAttribute('content').trim();
    }
    
    return 'Untitled Page';
  }
  
  findMainContentAreas() {
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      'article',
      '.documentation',
      '.docs',
      '#content',
      '#main',
      '.container',
      '.wrapper'
    ];
    
    let contentAreas = [];
    
    // Try specific content selectors first
    for (const selector of contentSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (this.isContentElement(element)) {
          contentAreas.push(element);
        }
      }
    }
    
    // If no specific content areas found, fall back to body
    if (contentAreas.length === 0) {
      contentAreas = [document.body];
    }
    
    // Remove duplicates and nested elements
    return this.deduplicateElements(contentAreas);
  }
  
  isContentElement(element) {
    // Check if element contains substantial text content
    const textLength = element.textContent.trim().length;
    if (textLength < 100) return false;
    
    // Avoid navigation, header, footer elements
    const tagName = element.tagName.toLowerCase();
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();
    
    const skipPatterns = [
      'nav', 'header', 'footer', 'sidebar', 'menu', 
      'advertisement', 'ad', 'banner', 'popup'
    ];
    
    for (const pattern of skipPatterns) {
      if (tagName.includes(pattern) || className.includes(pattern) || id.includes(pattern)) {
        return false;
      }
    }
    
    return true;
  }
  
  deduplicateElements(elements) {
    const result = [];
    
    for (const element of elements) {
      let isNested = false;
      
      for (const existing of result) {
        if (existing.contains(element) || element.contains(existing)) {
          isNested = true;
          // Keep the more specific (smaller) element
          if (element.textContent.length < existing.textContent.length) {
            const index = result.indexOf(existing);
            result[index] = element;
          }
          break;
        }
      }
      
      if (!isNested) {
        result.push(element);
      }
    }
    
    return result;
  }
  
  extractTextFromElement(element) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            return NodeFilter.FILTER_ACCEPT;
          }
          
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            
            // Skip script, style, and other non-content elements
            if (['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            
            // Skip hidden elements
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
            
            return NodeFilter.FILTER_ACCEPT;
          }
          
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    let content = '';
    let currentNode;
    let lastTagName = '';
    
    while (currentNode = walker.nextNode()) {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        const text = currentNode.textContent.trim();
        if (text) {
          content += text + ' ';
        }
      } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const tagName = currentNode.tagName.toLowerCase();
        
        // Add formatting for structural elements
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          const level = parseInt(tagName.charAt(1));
          const prefix = '#'.repeat(level);
          content += '\n\n' + prefix + ' ';
        } else if (['p', 'div', 'section', 'article'].includes(tagName) && lastTagName !== tagName) {
          content += '\n\n';
        } else if (['br'].includes(tagName)) {
          content += '\n';
        } else if (['li'].includes(tagName)) {
          content += '\n- ';
        }
        
        // Handle links if requested
        if (tagName === 'a' && this.options.includeLinks) {
          const href = currentNode.getAttribute('href');
          if (href && href.startsWith('http')) {
            const linkText = currentNode.textContent.trim();
            if (linkText) {
              content += `[${linkText}](${href}) `;
            }
          }
        }
        
        lastTagName = tagName;
      }
    }
    
    // Clean up the content
    return this.cleanContent(content);
  }
  
  async extractEmbeddedContent() {
    const iframes = document.querySelectorAll('iframe');
    let embeddedContent = '';
    
    for (const iframe of iframes) {
      try {
        // Try to access iframe content (may fail due to CORS)
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc && iframeDoc.body) {
          const iframeText = this.extractTextFromElement(iframeDoc.body);
          if (iframeText.trim()) {
            embeddedContent += `\n\n### Embedded Frame: ${iframe.src || 'Unknown'}\n\n${iframeText}`;
          }
        }
      } catch (error) {
        // CORS error - can't access iframe content
        const src = iframe.src;
        if (src) {
          embeddedContent += `\n\n### Embedded Frame (Restricted Access): ${src}\n\n`;
        }
      }
    }
    
    return embeddedContent;
  }
  
  cleanContent(content) {
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s+/g, '\n') // Clean up line breaks
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks
      .trim();
  }
  
  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async expandAllSections() {
    console.log('🔄 Starting comprehensive two-level expansion...');
    this.sendDetailedProgress({
      currentAction: '🔄 Expanding navigation sections...',
      expandedCount: 0
    });
    
    let totalExpanded = 0;
    
    // Multiple rounds of expansion to handle deeply nested sections
    for (let round = 0; round < 5; round++) {
      console.log(`📂 Expansion round ${round + 1}/5...`);
      this.sendDetailedProgress({
        currentAction: `📂 Round ${round + 1}/5: Finding expandable sections...`
      });
      
      // Find and click all expandable sections in the sidebar
      const expandableSelectors = [
        '[data-testid="sidebar-item"] button',
        '.sidebar button',
        '[role="button"]',
        '.expandable',
        '.collapsible',
        'button[aria-expanded="false"]',
        // Additional selectors for common expand patterns
        '[class*="expand"]',
        '[class*="toggle"]',
        '[class*="collapse"]',
        'details summary',
        '.accordion-header',
        '.dropdown-toggle',
        // Nested navigation selectors
        'nav li button',
        'ul li button',
        '.nav-item button',
        '[class*="sidebar"] li [role="button"]'
      ];
      
      let expandedCount = 0;
      
      for (const selector of expandableSelectors) {
        const elements = document.querySelectorAll(selector);
        
        for (const element of elements) {
          try {
            // Check if it's an expandable element
            const ariaExpanded = element.getAttribute('aria-expanded');
            const isCollapsed = element.classList.contains('collapsed');
            const hasExpandIcon = element.innerHTML.includes('▶') || 
                                 element.innerHTML.includes('arrow') ||
                                 element.innerHTML.includes('chevron') ||
                                 element.innerHTML.includes('plus') ||
                                 element.innerHTML.includes('+');
            
            // Look for parent containers that might have children
            const parentLi = element.closest('li');
            const hasHiddenChildren = parentLi && (
              parentLi.querySelector('ul[style*="display: none"]') ||
              parentLi.querySelector('.hidden') ||
              parentLi.querySelector('[aria-hidden="true"]') ||
              parentLi.querySelector('ul:not([style*="display: block"])')
            );
            
            // Check if element appears to be a section header (like "Billing", "Accounts")
            const text = element.textContent.trim();
            const looksLikeSectionHeader = text.length > 3 && text.length < 30 && 
                                         /^[A-Z][a-zA-Z\s]+$/.test(text);
            
            if (ariaExpanded === 'false' || isCollapsed || hasExpandIcon || 
                hasHiddenChildren || looksLikeSectionHeader) {
              
              console.log(`📂 Expanding: "${text.substring(0, 30)}" (${element.tagName})`);
              
              // Send UI update
              this.sendDetailedProgress({
                action: `📂 Expanding: ${text.substring(0, 20)}`,
                actionType: 'info',
                currentAction: `📂 Expanding section: ${text.substring(0, 25)}...`
              });
              
              // Try different click methods for stubborn elements
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await this.sleep(200);
              
              element.click();
              expandedCount++;
              totalExpanded++;
              
              // Update stats
              this.sendDetailedProgress({
                expandedCount: totalExpanded
              });
              
              await this.sleep(400); // Wait for expansion animation
              
              // Also try triggering focus and enter for accessibility-driven navigation
              try {
                element.focus();
                const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
                element.dispatchEvent(enterEvent);
              } catch (e) { /* ignore */ }
              
              await this.sleep(200);
            }
          } catch (error) {
            // Skip elements that can't be clicked
            continue;
          }
        }
      }
      
      console.log(`📊 Round ${round + 1}: Expanded ${expandedCount} elements`);
      this.sendDetailedProgress({
        action: `Round ${round + 1}: Expanded ${expandedCount} elements`,
        actionType: expandedCount > 0 ? 'success' : 'warning'
      });
      
      // Longer wait between rounds for animations and lazy loading
      await this.sleep(1500);
      
      // If we didn't expand anything in this round, we might be done
      if (expandedCount === 0) {
        console.log('🏁 No more elements to expand, stopping early');
        this.sendDetailedProgress({
          action: '🏁 No more sections to expand',
          actionType: 'success',
          currentAction: '✅ Expansion complete - searching for links...'
        });
        break;
      }
    }
    
    // Extra wait for all nested content to fully render
    await this.sleep(3000);
    console.log('✅ Finished comprehensive expansion - all nested sections should be visible');
    this.sendDetailedProgress({
      currentAction: '✅ All sections expanded - discovering links...',
      expandedCount: totalExpanded
    });
  }
  
  async discoverAllDocumentationLinks() {
    const links = [];
    
    // First, expand all sections to reveal nested links
    await this.expandAllSections();
    
    // Wait for any dynamic content to load after expansion
    await this.sleep(3000);
    
    console.log('🔍 Discovering links after comprehensive expansion...');
    
    // Focus on finding the SECOND LEVEL links (actual API endpoints)
    const endpointSelectors = [
      // Standard link selectors
      'nav a[href]',
      '.sidebar a[href]',
      'aside a[href]',
      
      // Nested navigation - the key ones for second level
      'ul ul a[href]', // Links inside nested lists
      'li li a[href]', // Links inside nested list items
      '.sidebar ul li a[href]', // Sidebar nested links
      'nav ul li a[href]', // Navigation nested links
      
      // Look for expanded sections specifically
      '[aria-expanded="true"] + * a[href]', // Links that appear after expanded sections
      '[aria-expanded="true"] ~ * a[href]', // Links that are siblings of expanded sections
      
      // Common documentation patterns
      '.nav-item a[href]',
      '.docs-nav a[href]',
      '.menu-item a[href]',
      '[class*="sidebar"] a[href]',
      '[class*="nav"] a[href]',
      
      // Specific patterns for API docs
      '[class*="endpoint"] a[href]',
      '[class*="api"] a[href]',
      '[class*="method"] a[href]'
    ];
    
    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;
    
    // Track which level links come from
    const linksByLevel = { level1: [], level2: [], other: [] };
    
    for (const selector of endpointSelectors) {
      const navLinks = document.querySelectorAll(selector);
      console.log(`🔗 Found ${navLinks.length} links with selector: ${selector}`);
      
      for (const link of navLinks) {
        const href = link.getAttribute('href');
        const text = link.textContent.trim();
        
        if (href && text && this.isDocumentationLink(href, currentPath)) {
          const fullUrl = href.startsWith('/') ? baseUrl + href : href;
          
          // Check if this is a meaningful documentation link
          if (this.isMeaningfulDocLink(text, href)) {
            const linkData = {
              url: fullUrl,
              title: text,
              element: link,
              href: href,
              selector: selector
            };
            
            // Determine if this is a second-level link (what we want)
            const nestingLevel = this.determineLinkNestingLevel(link);
            if (nestingLevel === 2) {
              linksByLevel.level2.push(linkData);
            } else if (nestingLevel === 1) {
              linksByLevel.level1.push(linkData);
            } else {
              linksByLevel.other.push(linkData);
            }
            
            links.push(linkData);
          }
        }
      }
    }
    
    console.log(`📊 Link Analysis:`);
    console.log(`  - Level 1 (sections): ${linksByLevel.level1.length}`);
    console.log(`  - Level 2 (endpoints): ${linksByLevel.level2.length}`);
    console.log(`  - Other: ${linksByLevel.other.length}`);
    
    // Remove duplicates and prioritize second-level links
    const uniqueLinks = [];
    const seenUrls = new Set();
    
    // Add level 2 links first (these are what we want)
    for (const link of linksByLevel.level2) {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        uniqueLinks.push(link);
      }
    }
    
    // Add level 1 links only if we don't have many level 2 links
    if (linksByLevel.level2.length < 5) {
      for (const link of linksByLevel.level1) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          uniqueLinks.push(link);
        }
      }
    }
    
    console.log(`✅ Discovered ${uniqueLinks.length} unique documentation links`);
    console.log('🎯 Priority links (endpoints to scrape):');
    uniqueLinks.slice(0, 10).forEach((link, i) => 
      console.log(`  ${i + 1}. "${link.title}" → ${link.href}`)
    );
    
    // Send UI update
    this.sendDetailedProgress({
      foundLinks: uniqueLinks.length,
      currentAction: `🔗 Found ${uniqueLinks.length} documentation links`,
      action: `🔗 Discovered ${uniqueLinks.length} API endpoints`,
      actionType: uniqueLinks.length > 5 ? 'success' : 'warning'
    });
    
    return uniqueLinks;
  }
  
  isDocumentationLink(href, currentPath) {
    // Filter for documentation-related links
    if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return false;
    }
    
    // Check if it's a documentation path
    const docPatterns = [
      '/docs',
      '/api',
      '/reference',
      '/guide',
      '/tutorial'
    ];
    
    const isDocPath = docPatterns.some(pattern => 
      href.includes(pattern) || currentPath.includes(pattern)
    );
    
    // Also include relative links on documentation sites
    const isRelativeDocLink = href.startsWith('/') && currentPath.includes('/docs');
    
    return isDocPath || isRelativeDocLink;
  }
  
  isMeaningfulDocLink(text, href) {
    // Filter out navigation elements that aren't actual content pages
    const skipPatterns = [
      'home', 'search', 'login', 'signup', 'settings', 'profile',
      'logout', 'back', 'next', 'previous', 'edit', 'delete',
      'toggle', 'menu', 'close', 'open'
    ];
    
    const textLower = text.toLowerCase();
    
    // Skip if text matches skip patterns
    if (skipPatterns.some(pattern => textLower.includes(pattern))) {
      return false;
    }
    
    // Skip very short or empty text
    if (text.length < 2) {
      return false;
    }
    
    // Skip if it's just numbers or symbols
    if (/^[\d\s\-_.]+$/.test(text)) {
      return false;
    }
    
    // Prefer links that look like API endpoints or documentation sections
    const goodPatterns = [
      'api', 'endpoint', 'reference', 'guide', 'tutorial',
      'get', 'post', 'put', 'delete', 'patch',
      'create', 'update', 'fetch', 'list', 'retrieve'
    ];
    
    const hrefLower = href.toLowerCase();
    const hasGoodPattern = goodPatterns.some(pattern => 
      textLower.includes(pattern) || hrefLower.includes(pattern)
    );
    
    // If it's a reference page, it's probably good
    if (hrefLower.includes('/reference/') || hrefLower.includes('/api/')) {
      return true;
    }
    
    // If it has good patterns or is longer than 5 characters, include it
    return hasGoodPattern || text.length > 5;
  }
  
  determineLinkNestingLevel(linkElement) {
    // Determine how deeply nested this link is in the navigation structure
    let level = 0;
    let current = linkElement;
    
    // Count how many nested lists this link is inside
    while (current && current !== document.body) {
      if (current.tagName === 'UL' || current.tagName === 'OL') {
        level++;
      }
      current = current.parentElement;
    }
    
    // Also check for other nesting indicators
    const hasExpandedParent = linkElement.closest('[aria-expanded="true"]');
    const hasNestedClass = linkElement.closest('[class*="nested"], [class*="sub"], [class*="child"]');
    const isInNestedDiv = linkElement.closest('.sidebar > div > div > div');
    
    // If it's inside an expanded section or has nested indicators, it's likely level 2
    if (hasExpandedParent || hasNestedClass || isInNestedDiv) {
      level = Math.max(level, 2);
    }
    
    // Check text patterns that suggest it's an API endpoint (level 2)
    const text = linkElement.textContent.trim();
    const isAPIEndpoint = /^(Get|Post|Put|Delete|Create|Update|List|Fetch)\s/.test(text) ||
                         text.includes('API') ||
                         text.includes('endpoint') ||
                         /^[A-Z][a-z]+\s[a-z]/.test(text); // Pattern like "Get user info"
    
    if (isAPIEndpoint) {
      level = Math.max(level, 2);
    }
    
    // Level 1 indicators (section headers)
    const isSectionHeader = text.length < 20 && /^[A-Z][a-zA-Z\s]*$/.test(text) &&
                           ['Billing', 'Accounts', 'Reports', 'Users', 'Settings'].includes(text);
    
    if (isSectionHeader && level < 2) {
      level = 1;
    }
    
    return Math.min(level, 3); // Cap at level 3
  }
  
  async scrapeAllSections(links) {
    const allContent = [];
    const totalLinks = links.length;
    
    for (let i = 0; i < totalLinks; i++) {
      const link = links[i];
      
      this.sendProgress(
        20 + (i / totalLinks) * 60, 
        `Scraping: ${link.title} (${i + 1}/${totalLinks})`
      );
      
      try {
        // Click the link to navigate to the section
        if (link.element && link.element.isConnected) {
          console.log(`📍 Attempting to navigate to: ${link.title}`);
          
          // Store current content to detect changes
          const beforeContent = this.getCurrentMainContent();
          
          // Scroll the link into view first
          link.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await this.sleep(500);
          
          // Click the link
          link.element.click();
          console.log(`🖱️ Clicked: ${link.title}`);
          
          // Wait and check for content changes (SPA pattern)
          let contentChanged = false;
          for (let attempt = 0; attempt < 10; attempt++) {
            await this.sleep(500);
            const afterContent = this.getCurrentMainContent();
            
            if (afterContent !== beforeContent) {
              contentChanged = true;
              console.log(`✅ Content changed for: ${link.title}`);
              break;
            }
          }
          
          if (!contentChanged) {
            console.warn(`⚠️ No content change detected for: ${link.title}`);
            // Try alternative approaches
            await this.tryAlternativeNavigation(link);
          }
          
          // Additional wait for dynamic content
          if (this.options.waitForDynamic) {
            await this.waitForDynamicContent();
          }
          
          // Extract content from this section
          const sectionData = await this.extractPageContent();
          
          // Only add if we got meaningful content
          if (sectionData.content && sectionData.content.trim().length > 100) {
            sectionData.sectionTitle = link.title;
            sectionData.sectionUrl = link.url;
            allContent.push(sectionData);
            console.log(`✅ Successfully scraped: ${link.title} (${sectionData.wordCount} words)`);
            
            // Send live preview update
            this.sendContentUpdate(sectionData);
            
            // Update UI
            this.sendDetailedProgress({
              scrapedCount: allContent.length,
              action: `✅ Scraped: ${link.title} (${sectionData.wordCount} words)`,
              actionType: 'success',
              currentAction: `📄 Scraped ${allContent.length}/${totalLinks}: ${link.title}`
            });
          } else {
            console.warn(`❌ No meaningful content found for: ${link.title}`);
            this.sendDetailedProgress({
              action: `⚠️ No content: ${link.title}`,
              actionType: 'warning'
            });
          }
          
        } else {
          console.warn(`❌ Could not navigate to: ${link.title} - element not connected`);
        }
        
      } catch (error) {
        console.error(`❌ Error scraping section ${link.title}:`, error.message);
        // Continue with other sections
      }
    }
    
    return allContent;
  }
  
  combineAllContent(allContent) {
    const combinedData = {
      url: window.location.href,
      title: 'Complete Documentation - ' + this.extractTitle(),
      content: '',
      wordCount: 0,
      sectionsCount: allContent.length
    };
    
    // Use array for better memory efficiency with large content
    const contentParts = [];
    let totalWordCount = 0;
    
    for (let i = 0; i < allContent.length; i++) {
      const section = allContent[i];
      
      if (section && section.content && section.content.trim()) {
        // Add section header
        contentParts.push(`\n\n# ${section.sectionTitle || 'Section'}\n\n`);
        
        // Add section URL if available
        if (section.sectionUrl) {
          contentParts.push(`**Section URL:** ${section.sectionUrl}\n\n`);
        }
        
        // Add content (ensure it's a string and not circular)
        const sectionContent = String(section.content).trim();
        contentParts.push(sectionContent);
        contentParts.push('\n\n---\n');
        
        // Count words more efficiently
        totalWordCount += section.wordCount || this.estimateWordCount(sectionContent);
      }
    }
    
    // Join all parts at once instead of concatenating in loop
    combinedData.content = contentParts.join('');
    combinedData.wordCount = totalWordCount;
    
    return combinedData;
  }
  
  estimateWordCount(text) {
    if (!text || typeof text !== 'string') return 0;
    
    // Fast word count estimation
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  getCurrentMainContent() {
    // Get a snapshot of the main content to detect changes
    const mainSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.docs-content',
      '#content'
    ];
    
    for (const selector of mainSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }
    
    // Fallback to body content if no main element found
    return document.body.textContent.trim();
  }
  
  async tryAlternativeNavigation(link) {
    console.log(`🔄 Trying alternative navigation for: ${link.title}`);
    
    try {
      // Method 1: Try different event types
      const events = ['mousedown', 'mouseup', 'pointerdown', 'pointerup'];
      for (const eventType of events) {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true
        });
        link.element.dispatchEvent(event);
        await this.sleep(200);
      }
      
      // Method 2: Try keyboard navigation
      link.element.focus();
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true
      });
      link.element.dispatchEvent(enterEvent);
      await this.sleep(500);
      
      // Method 3: Try to find and trigger parent elements
      const parent = link.element.closest('li, .nav-item, [role="menuitem"]');
      if (parent && parent !== link.element) {
        console.log(`🎯 Trying parent element for: ${link.title}`);
        parent.click();
        await this.sleep(500);
      }
      
      // Method 4: Try direct URL navigation if href exists
      if (link.href && !link.href.startsWith('#')) {
        console.log(`🌐 Trying direct navigation to: ${link.href}`);
        window.history.pushState({}, '', link.href);
        // Trigger a popstate event to notify the SPA
        window.dispatchEvent(new PopStateEvent('popstate'));
        await this.sleep(1000);
      }
      
    } catch (error) {
      console.warn(`Alternative navigation failed for ${link.title}:`, error.message);
    }
  }
  
  isSinglePageApp() {
    // Detect if this is a single-page application
    const indicators = [
      () => window.history.pushState !== undefined,
      () => document.querySelector('[data-react-root], [data-reactroot], #root, #app'),
      () => window.React || window.Vue || window.Angular,
      () => document.querySelector('script[src*="react"], script[src*="vue"], script[src*="angular"]'),
      () => window.location.pathname.includes('/docs') && document.querySelectorAll('a[href^="#"]').length > 5
    ];
    
    const detectedIndicators = indicators.filter(test => test()).length;
    const isSPA = detectedIndicators >= 2;
    
    console.log(`SPA Detection: ${detectedIndicators}/5 indicators, SPA: ${isSPA}`);
    return isSPA;
  }
  
  async alternativeLinkDiscovery() {
    console.log('🔎 Starting alternative link discovery...');
    
    const alternativeLinks = [];
    
    // Look for text-based navigation that might not be proper links
    const textSelectors = [
      '[class*="nav"] [class*="item"]',
      '[class*="menu"] [class*="item"]',
      '[class*="sidebar"] div',
      'li',
      '[role="menuitem"]',
      '[data-testid*="nav"]'
    ];
    
    for (const selector of textSelectors) {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        const text = element.textContent.trim();
        
        // Look for API-like names
        if (text.length > 3 && text.length < 50 && 
            (text.includes('API') || text.includes('Get ') || text.includes('Create ') || 
             text.includes('Update ') || text.includes('Delete ') || text.includes('List ') ||
             /^[A-Z][a-zA-Z\s]+$/.test(text))) {
          
          alternativeLinks.push({
            url: window.location.href + '#' + text.toLowerCase().replace(/\s+/g, '-'),
            title: text,
            element: element,
            href: '#' + text.toLowerCase().replace(/\s+/g, '-')
          });
        }
      }
    }
    
    console.log(`🔍 Alternative discovery found ${alternativeLinks.length} additional links`);
    return alternativeLinks;
  }
  
  async scrapeSPASections(links) {
    console.log('🌐 Starting SPA-specific scraping strategy...');
    
    const allContent = [];
    const totalLinks = links.length;
    
    for (let i = 0; i < totalLinks; i++) {
      const link = links[i];
      
      this.sendProgress(
        20 + (i / totalLinks) * 60, 
        `SPA Scraping: ${link.title} (${i + 1}/${totalLinks})`
      );
      
      try {
        console.log(`🌐 SPA navigation attempt: ${link.title}`);
        
        // For SPAs, we often need to trigger navigation differently
        const beforeContent = this.getCurrentMainContent();
        
        // Try multiple SPA navigation methods
        let navigationSuccess = false;
        
        // Method 1: Standard click
        if (link.element && link.element.isConnected) {
          link.element.click();
          await this.sleep(1000);
          
          if (this.getCurrentMainContent() !== beforeContent) {
            navigationSuccess = true;
            console.log(`✅ Standard click worked for: ${link.title}`);
          }
        }
        
        // Method 2: If standard click didn't work, try triggering events manually
        if (!navigationSuccess && link.element) {
          console.log(`🔄 Trying manual event dispatch for: ${link.title}`);
          
          const events = [
            new MouseEvent('mousedown', { bubbles: true }),
            new MouseEvent('mouseup', { bubbles: true }),
            new MouseEvent('click', { bubbles: true })
          ];
          
          for (const event of events) {
            link.element.dispatchEvent(event);
            await this.sleep(300);
          }
          
          await this.sleep(1000);
          if (this.getCurrentMainContent() !== beforeContent) {
            navigationSuccess = true;
            console.log(`✅ Manual events worked for: ${link.title}`);
          }
        }
        
        // Method 3: Try URL-based navigation for SPAs
        if (!navigationSuccess && link.href) {
          console.log(`🔗 Trying URL navigation for: ${link.title}`);
          
          // Update the URL
          if (link.href.startsWith('#')) {
            window.location.hash = link.href.substring(1);
          } else if (link.href.startsWith('/')) {
            window.history.pushState({}, '', link.href);
          }
          
          // Trigger hashchange or popstate events
          window.dispatchEvent(new HashChangeEvent('hashchange'));
          window.dispatchEvent(new PopStateEvent('popstate'));
          
          await this.sleep(1500);
          if (this.getCurrentMainContent() !== beforeContent) {
            navigationSuccess = true;
            console.log(`✅ URL navigation worked for: ${link.title}`);
          }
        }
        
        if (navigationSuccess) {
          // Wait for content to fully load
          await this.waitForDynamicContent();
          
          // Extract the content
          const sectionData = await this.extractPageContent();
          
          if (sectionData.content && sectionData.content.trim().length > 100) {
            sectionData.sectionTitle = link.title;
            sectionData.sectionUrl = link.url;
            allContent.push(sectionData);
            
            // Send live preview update
            this.sendContentUpdate(sectionData);
            
            console.log(`✅ SPA scraped: ${link.title} (${sectionData.wordCount} words)`);
          }
        } else {
          console.warn(`❌ SPA navigation failed for: ${link.title}`);
        }
        
      } catch (error) {
        console.error(`❌ SPA scraping error for ${link.title}:`, error.message);
      }
    }
    
    return allContent;
  }
  
  async sectionBySectionScraping() {
    console.log('📑 Starting unique page discovery scraping strategy...');
    
    // Safeguard: Check if we're already processing to prevent double-execution
    if (this.isProcessingSections) {
      console.warn('⚠️ Section processing already in progress, preventing duplicate execution');
      return this.currentScrapeData;
    }
    
    this.isProcessingSections = true;
    
    // FIRST: Always capture the main page content before diving into sections
    this.sendDetailedProgress({
      currentAction: '📄 Capturing main page content...',
      expandedCount: 0
    });
    
    console.log('📄 Scraping main page content first...');
    const mainPageContent = await this.extractPageContent();
    if (mainPageContent && mainPageContent.content && mainPageContent.content.trim().length > 100) {
      mainPageContent.sectionTitle = 'Main Page Overview';
      mainPageContent.sectionUrl = window.location.href;
      this.currentScrapeData.push(mainPageContent);
      
      // Send live preview update for main page
      this.sendContentUpdate(mainPageContent);
      
      console.log(`✅ Main page content captured: ${mainPageContent.wordCount} words`);
      this.sendDetailedProgress({
        scrapedCount: this.currentScrapeData.length,
        action: `✅ Captured main page (${mainPageContent.wordCount} words)`,
        actionType: 'success'
      });
    } else {
      console.log('⚠️ Main page content was minimal or empty');
    }
    
    this.sendDetailedProgress({
      currentAction: '🔍 Discovering all unique pages...',
      expandedCount: 0
    });
    
    // NEW APPROACH: Discover ALL unique pages first, then scrape each one
    const allUniquePages = await this.discoverAllUniquePages();
    
    console.log(`📋 Found ${allUniquePages.length} unique pages to scrape`);
    this.sendDetailedProgress({
      currentAction: `📋 Found ${allUniquePages.length} unique pages to scrape`,
      action: `📋 Discovered ${allUniquePages.length} unique pages`,
      actionType: allUniquePages.length > 0 ? 'success' : 'warning'
    });
    
    // If no unique pages found, try the old comprehensive approach as fallback
    if (allUniquePages.length === 0) {
      console.log('⚠️ No unique pages found, falling back to comprehensive approach...');
      this.sendDetailedProgress({
        currentAction: '⚠️ No pages found - trying comprehensive approach...',
        action: '⚠️ Falling back to comprehensive scraping',
        actionType: 'warning'
      });
      
      // Fall back to the old method
      return await this.legacyComprehensiveScraping();
    }
    
    const scrapedUrls = new Set(); // Track which URLs we've scraped
    
    // Step 2: Scrape each unique page once with enhanced tracking
    console.log(`🔄 Starting to scrape ${allUniquePages.length} unique pages`);
    
    const scrapedTitles = new Set(); // Track by title too
    const scrapedContent = new Set(); // Track by content hash to avoid duplicates
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10; // Stop if too many failures in a row
    
    for (let i = 0; i < allUniquePages.length; i++) {
      if (this.shouldStop) {
        console.log('⏹️ Stopping at user request');
        break;
      }
      
      const page = allUniquePages[i];
      
      // Enhanced duplicate detection
      const pageId = page.url || page.href || page.title;
      const titleKey = page.title.toLowerCase().trim();
      
      if (scrapedUrls.has(pageId) || scrapedTitles.has(titleKey)) {
        console.log(`⏭️ Skipping duplicate: ${page.title}`);
        continue;
      }
      
      console.log(`📄 Scraping page ${i + 1}/${allUniquePages.length}: ${page.title}`);
      this.sendDetailedProgress({
        currentAction: `📄 Page ${i + 1}/${allUniquePages.length}: ${page.title}`,
        action: `📄 Scraping: ${page.title}`,
        actionType: 'info'
      });
      
      // Mark this page as being processed
      scrapedUrls.add(pageId);
      scrapedTitles.add(titleKey);
      
      const pageContent = await this.scrapeUniquePage(page);
      
      if (pageContent) {
        // Check for content duplicates by creating a simple hash
        const contentHash = this.createContentHash(pageContent.content);
        
        if (!scrapedContent.has(contentHash)) {
          this.currentScrapeData.push(pageContent);
          scrapedContent.add(contentHash);
          
          // Send live preview update
          this.sendContentUpdate(pageContent);
          
          this.sendDetailedProgress({
            scrapedCount: this.currentScrapeData.length,
            action: `✅ Scraped: ${page.title} (${pageContent.wordCount} words)`,
            actionType: 'success'
          });
          
          consecutiveFailures = 0; // Reset failure counter
        } else {
          console.log(`🔄 Skipping duplicate content for: ${page.title}`);
        }
      } else {
        consecutiveFailures++;
        console.warn(`❌ Failed to scrape: ${page.title} (${consecutiveFailures} consecutive failures)`);
        
        // If too many consecutive failures, something might be wrong
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.warn(`⚠️ Too many consecutive failures (${consecutiveFailures}), stopping to prevent infinite loops`);
          break;
        }
      }
      
      // Update progress
      const progressPercent = 20 + ((i + 1) / allUniquePages.length) * 60;
      this.sendProgress(progressPercent, `Scraped page ${i + 1}/${allUniquePages.length}`);
      
      // Add a small delay between pages to prevent overwhelming the site
      if (i < allUniquePages.length - 1) {
        await this.sleep(1000);
      }
    }
    
    console.log(`🏁 UNIQUE PAGE DISCOVERY COMPLETE - Processed ${allUniquePages.length} pages`);
    
    // Return the complete data (currentScrapeData already includes main page + all unique pages)
    console.log(`🎉 Unique page scraping complete! Total items: ${this.currentScrapeData.length}`);
    this.sendDetailedProgress({
      currentAction: '🎉 Scraping complete! Preparing download...',
      action: `🎉 Completed: ${this.currentScrapeData.length} total items scraped`,
      actionType: 'success'
    });
    
    // Clear the processing flag
    this.isProcessingSections = false;
    
    return this.currentScrapeData;
  }
  
  async discoverAllUniquePages() {
    console.log('🔍 Starting comprehensive unique page discovery...');
    
    const uniquePages = [];
    const seenUrls = new Set();
    const seenTitles = new Set();
    
    // UNIVERSAL SITE ANALYSIS - Automatically understand any site's structure
    console.log('🧠 Analyzing site structure and navigation patterns...');
    const siteAnalysis = await this.analyzeSiteStructure();
    
    console.log('📊 Site Analysis Results:', siteAnalysis);
    this.sendDetailedProgress({
      currentAction: `🧠 Analyzed: ${siteAnalysis.siteType} site with ${siteAnalysis.navigationStyle}`,
      action: `🧠 Site Type: ${siteAnalysis.siteType}, Navigation: ${siteAnalysis.navigationStyle}`,
      actionType: 'info'
    });
    
    // Use the adaptive strategy based on what we discovered
    return await this.adaptivePageDiscovery(siteAnalysis);
    
    // Step 1: First expand everything to reveal all hidden content
    console.log('🔧 Expanding all expandable sections...');
    this.sendDetailedProgress({
      currentAction: '🔧 Expanding all sections to reveal pages...',
      action: '🔧 Expanding all sections',
      actionType: 'info'
    });
    
    await this.expandAllPossibleSections();
    
    // Step 2: Find all meaningful links across the entire page
    console.log('🔗 Discovering all unique page links...');
    this.sendDetailedProgress({
      currentAction: '🔗 Discovering all unique pages...',
      action: '🔗 Scanning for unique pages',
      actionType: 'info'
    });
    
    // Comprehensive link discovery with multiple strategies
    const linkSelectors = [
      // Documentation-specific patterns
      'a[href*="/reference/"]',
      'a[href*="/api/"]', 
      'a[href*="/docs/"]',
      'a[href*="/guide"]',
      
      // Navigation areas
      'nav a',
      '.sidebar a',
      '.navigation a',
      '.docs-nav a',
      '.menu a',
      
      // List-based navigation (common in docs)
      'ul li a',
      'ol li a',
      
      // Any internal links
      'a[href^="/"]',
      'a[href^="#"]',
      
      // Links that might have been revealed after expansion
      'a'
    ];
    
    for (const selector of linkSelectors) {
      const links = document.querySelectorAll(selector);
      console.log(`🔍 Found ${links.length} links with selector: ${selector}`);
      
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent.trim();
        
        // Create a unique identifier for this page
        const pageUrl = href.startsWith('/') ? window.location.origin + href : 
                       href.startsWith('#') ? window.location.href.split('#')[0] + href :
                       href;
        
        // Skip if we've already found this URL or title
        if (seenUrls.has(pageUrl) || seenTitles.has(text)) {
          continue;
        }
        
        // Filter for meaningful documentation pages
        const isMeaningfulPage = this.isMeaningfulDocumentationPage(text, href);
        
        if (isMeaningfulPage && text.length > 2 && text.length < 100) {
          console.log(`✅ Adding unique page: "${text}" → ${href}`);
          
          uniquePages.push({
            title: text,
            url: pageUrl,
            href: href,
            element: link
          });
          
          seenUrls.add(pageUrl);
          seenTitles.add(text);
        } else {
          console.log(`❌ Skipping: "${text}" (meaningful: ${isMeaningfulPage}, href: ${href})`);
        }
      }
    }
    
    // Sort by likely importance (API endpoints first, then guides, etc.)
    uniquePages.sort((a, b) => {
      const aScore = this.getPageImportanceScore(a);
      const bScore = this.getPageImportanceScore(b);
      return bScore - aScore; // Higher scores first
    });
    
    console.log(`📊 Total unique pages discovered: ${uniquePages.length}`);
    uniquePages.slice(0, 10).forEach((page, i) => {
      console.log(`  ${i + 1}. "${page.title}" → ${page.href}`);
    });
    if (uniquePages.length > 10) {
      console.log(`  ... and ${uniquePages.length - 10} more pages`);
    }
    
    return uniquePages;
  }
  
  createContentHash(content) {
    // Create a simple hash of the content to detect duplicates
    if (!content) return '';
    
    // Normalize content for comparison
    const normalized = content.trim()
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .toLowerCase()
      .substring(0, 500); // Use first 500 chars for hash
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }
  
  async analyzeSiteStructure() {
    console.log('🧠 Starting universal site structure analysis...');
    
    const analysis = {
      siteType: 'unknown',
      navigationStyle: 'unknown',
      contentPattern: 'unknown',
      expandableElements: [],
      navigationAreas: [],
      linkPatterns: [],
      specialSelectors: {},
      confidence: 0
    };
    
    // Step 1: Identify the site type and navigation pattern
    analysis.siteType = this.detectSiteType();
    analysis.navigationStyle = this.detectNavigationStyle();
    analysis.contentPattern = this.detectContentPattern();
    
    // Step 2: Find navigation areas
    analysis.navigationAreas = this.findNavigationAreas();
    
    // Step 3: Analyze expandable elements
    analysis.expandableElements = this.findExpandableElements();
    
    // Step 4: Analyze link patterns
    analysis.linkPatterns = this.analyzeLinkPatterns();
    
    // Step 5: Find special selectors for this site
    analysis.specialSelectors = this.findSpecialSelectors();
    
    // Step 6: Calculate confidence in our analysis
    analysis.confidence = this.calculateAnalysisConfidence(analysis);
    
    console.log('🧠 Site structure analysis complete:', analysis);
    
    return analysis;
  }
  
  detectSiteType() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyClasses = document.body.className.toLowerCase();
    
    // Known patterns for different site types
    const patterns = {
      'gitbook': hostname.includes('gitbook') || bodyClasses.includes('gitbook'),
      'notion': hostname.includes('notion') || bodyClasses.includes('notion'),
      'confluence': hostname.includes('confluence') || bodyClasses.includes('confluence'),
      'gitiles': hostname.includes('gitiles') || pathname.includes('gitiles'),
      'sphinx': bodyClasses.includes('sphinx') || document.querySelector('.sphinxsidebar'),
      'mkdocs': bodyClasses.includes('mkdocs') || document.querySelector('.md-nav'),
      'docusaurus': bodyClasses.includes('docusaurus') || document.querySelector('[data-theme]'),
      'readme': hostname.includes('readme.') || bodyClasses.includes('readme'),
      'intercom': hostname.includes('intercom') || bodyClasses.includes('intercom'),
      'zendesk': hostname.includes('zendesk') || bodyClasses.includes('zendesk'),
      'slate': bodyClasses.includes('slate') || document.querySelector('.slate'),
      'swagger': title.includes('swagger') || document.querySelector('.swagger-ui'),
      'redoc': bodyClasses.includes('redoc') || document.querySelector('redoc'),
      'postman': hostname.includes('postman') || bodyClasses.includes('postman'),
      'custom-docs': pathname.includes('/docs') || pathname.includes('/reference') || pathname.includes('/api'),
      'subskribe': hostname.includes('subskribe'), // Keep our optimization
    };
    
    // Find the best match
    for (const [type, matches] of Object.entries(patterns)) {
      if (matches) {
        console.log(`🎯 Detected site type: ${type}`);
        return type;
      }
    }
    
    // If no specific pattern, classify as generic docs
    if (title.includes('docs') || title.includes('documentation') || title.includes('api')) {
      return 'generic-docs';
    }
    
    return 'unknown';
  }
  
  detectNavigationStyle() {
    // Look for different navigation patterns
    const patterns = {
      'sidebar-expandable': document.querySelectorAll('.sidebar [aria-expanded], nav [aria-expanded]').length > 3,
      'sidebar-static': document.querySelectorAll('.sidebar ul li, nav ul li').length > 10,
      'top-nav-dropdown': document.querySelectorAll('header .dropdown, .top-nav .dropdown').length > 2,
      'accordion': document.querySelectorAll('details, .accordion, [data-accordion]').length > 3,
      'tree-nav': document.querySelectorAll('.tree, [role="tree"], .nav-tree').length > 0,
      'tabbed': document.querySelectorAll('[role="tab"], .tabs, .tab-nav').length > 3,
      'mega-menu': document.querySelectorAll('.mega-menu, .large-nav').length > 0,
      'simple-list': document.querySelectorAll('nav ul, .nav ul').length > 0
    };
    
    // Find the most likely pattern
    for (const [style, hasPattern] of Object.entries(patterns)) {
      if (hasPattern) {
        console.log(`📊 Detected navigation style: ${style}`);
        return style;
      }
    }
    
    return 'unknown';
  }
  
  detectContentPattern() {
    // Analyze how content is organized
    const patterns = {
      'single-page-app': this.isSinglePageApp(),
      'multi-page-static': document.querySelectorAll('a[href^="/"], a[href*="html"]').length > 10,
      'hash-routing': document.querySelectorAll('a[href^="#"]').length > 5,
      'api-reference': document.querySelectorAll('a[href*="/reference/"], a[href*="/api/"]').length > 5,
      'guide-based': document.querySelectorAll('a[href*="/guide"], a[href*="/tutorial"]').length > 3,
      'wiki-style': document.querySelectorAll('a[href*="/wiki/"], .wiki').length > 0
    };
    
    for (const [pattern, matches] of Object.entries(patterns)) {
      if (matches) {
        console.log(`📄 Detected content pattern: ${pattern}`);
        return pattern;
      }
    }
    
    return 'unknown';
  }
  
  findNavigationAreas() {
    const areas = [];
    
    // Common navigation area selectors
    const navSelectors = [
      'nav', '.navigation', '.nav', '.sidebar', '.side-nav',
      '.docs-nav', '.menu', '.toc', '.table-of-contents',
      'aside', '.aside', '[role="navigation"]', '.nav-menu'
    ];
    
    for (const selector of navSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Only consider elements with meaningful navigation content
        const linkCount = element.querySelectorAll('a').length;
        if (linkCount > 3) {
          areas.push({
            selector: selector,
            element: element,
            linkCount: linkCount,
            expandableCount: element.querySelectorAll('[aria-expanded], details, .expandable').length
          });
        }
      }
    }
    
    // Sort by link count (most comprehensive navigation first)
    areas.sort((a, b) => b.linkCount - a.linkCount);
    
    console.log(`🗺️ Found ${areas.length} navigation areas`);
    return areas;
  }
  
  findExpandableElements() {
    const expandables = [];
    
    // Look for various types of expandable elements
    const expandableSelectors = [
      'details',
      '[aria-expanded="false"]',
      '.expandable',
      '.collapsible',
      '.accordion-item',
      'button[aria-expanded]',
      '.dropdown-toggle',
      '.nav-toggle'
    ];
    
    for (const selector of expandableSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.trim();
        if (text.length > 0 && text.length < 100) {
          expandables.push({
            selector: selector,
            element: element,
            text: text,
            hasChildren: element.querySelector('ul, ol, .submenu') !== null
          });
        }
      }
    }
    
    console.log(`🔧 Found ${expandables.length} expandable elements`);
    return expandables;
  }
  
  analyzeLinkPatterns() {
    const patterns = [];
    const allLinks = document.querySelectorAll('a[href]');
    
    // Analyze URL patterns
    const urlPatterns = {};
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();
      
      if (href && text.length > 0) {
        // Extract URL pattern
        const pattern = href.replace(/\/[^\/]*$/, '/').replace(/\d+/g, 'ID');
        
        if (!urlPatterns[pattern]) {
          urlPatterns[pattern] = [];
        }
        urlPatterns[pattern].push({ href, text });
      }
    }
    
    // Find the most common patterns
    for (const [pattern, links] of Object.entries(urlPatterns)) {
      if (links.length > 2) {
        patterns.push({
          pattern: pattern,
          count: links.length,
          examples: links.slice(0, 3)
        });
      }
    }
    
    // Sort by frequency
    patterns.sort((a, b) => b.count - a.count);
    
    console.log(`🔗 Found ${patterns.length} link patterns`);
    return patterns;
  }
  
  findSpecialSelectors() {
    const selectors = {};
    
    // Try to find the best selectors for this specific site
    const selectorTests = {
      mainNavigation: ['nav', '.sidebar', '.navigation', '.docs-nav', '.menu'],
      sectionHeaders: ['h1', 'h2', '.section-header', '.nav-header', '.category-header'],
      apiEndpoints: ['a[href*="/api/"]', 'a[href*="/reference/"]', '.endpoint', '.api-method'],
      contentArea: ['main', '.content', '.main-content', '.docs-content', '[role="main"]'],
      expandButtons: ['[aria-expanded]', 'details summary', '.expand-btn', '.toggle']
    };
    
    for (const [type, candidates] of Object.entries(selectorTests)) {
      let bestSelector = null;
      let bestCount = 0;
      
      for (const selector of candidates) {
        const count = document.querySelectorAll(selector).length;
        if (count > bestCount) {
          bestCount = count;
          bestSelector = selector;
        }
      }
      
      if (bestSelector && bestCount > 0) {
        selectors[type] = {
          selector: bestSelector,
          count: bestCount
        };
      }
    }
    
    console.log('🎯 Special selectors found:', selectors);
    return selectors;
  }
  
  calculateAnalysisConfidence(analysis) {
    let confidence = 0;
    
    // Add confidence based on what we were able to detect
    if (analysis.siteType !== 'unknown') confidence += 25;
    if (analysis.navigationStyle !== 'unknown') confidence += 25;
    if (analysis.contentPattern !== 'unknown') confidence += 20;
    if (analysis.navigationAreas.length > 0) confidence += 15;
    if (analysis.expandableElements.length > 0) confidence += 10;
    if (analysis.linkPatterns.length > 0) confidence += 5;
    
    console.log(`🎯 Analysis confidence: ${confidence}%`);
    return confidence;
  }
  
  async adaptivePageDiscovery(siteAnalysis) {
    console.log('🎯 Using adaptive discovery strategy based on site analysis...');
    
    // Choose the best strategy based on our analysis
    if (siteAnalysis.siteType === 'subskribe') {
      console.log('🎯 Using optimized Subskribe strategy');
      return await this.discoverSubskribePages();
    }
    
    if (siteAnalysis.navigationStyle === 'sidebar-expandable') {
      console.log('🎯 Using expandable sidebar strategy');
      return await this.expandableSidebarStrategy(siteAnalysis);
    }
    
    if (siteAnalysis.contentPattern === 'api-reference') {
      console.log('🎯 Using API reference strategy');
      return await this.apiReferenceStrategy(siteAnalysis);
    }
    
    if (siteAnalysis.contentPattern === 'single-page-app') {
      console.log('🎯 Using SPA strategy');
      return await this.spaStrategy(siteAnalysis);
    }
    
    // Default comprehensive strategy with site-specific optimizations
    console.log('🎯 Using comprehensive strategy with site optimizations');
    return await this.comprehensiveStrategy(siteAnalysis);
  }
  
  async expandableSidebarStrategy(siteAnalysis) {
    console.log('🔧 Using expandable sidebar strategy...');
    
    const uniquePages = [];
    const seenUrls = new Set();
    
    // Use the best navigation area we found
    const primaryNav = siteAnalysis.navigationAreas[0];
    if (!primaryNav) {
      console.warn('No primary navigation found, falling back to comprehensive');
      return await this.comprehensiveStrategy(siteAnalysis);
    }
    
    // Expand all expandable elements in the navigation
    console.log('🔧 Expanding all navigation elements...');
    for (const expandable of siteAnalysis.expandableElements) {
      try {
        expandable.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(200);
        expandable.element.click();
        await this.sleep(500);
      } catch (error) {
        console.warn('Could not expand element:', error);
      }
    }
    
    // Wait for all expansions to complete
    await this.sleep(2000);
    
    // Find all links in the expanded navigation
    const navLinks = primaryNav.element.querySelectorAll('a[href]');
    
    for (const link of navLinks) {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();
      
      if (this.isValidDocumentationLink(href, text)) {
        const url = href.startsWith('/') ? window.location.origin + href : href;
        
        if (!seenUrls.has(url)) {
          uniquePages.push({
            title: text,
            url: url,
            href: href,
            element: link
          });
          seenUrls.add(url);
        }
      }
    }
    
    console.log(`🎯 Expandable sidebar strategy found ${uniquePages.length} pages`);
    return uniquePages;
  }
  
  async apiReferenceStrategy(siteAnalysis) {
    console.log('🔗 Using API reference strategy...');
    
    const uniquePages = [];
    const seenUrls = new Set();
    
    // Focus on API-specific link patterns
    const apiSelectors = [
      'a[href*="/api/"]',
      'a[href*="/reference/"]',
      'a[href*="/endpoint"]',
      '.api-method a',
      '.endpoint a'
    ];
    
    // Also expand any collapsible sections first
    await this.expandAllPossibleSections();
    
    for (const selector of apiSelectors) {
      const links = document.querySelectorAll(selector);
      
      for (const link of links) {
        const href = link.getAttribute('href');
        const text = link.textContent.trim();
        
        if (href && text.length > 0) {
          const url = href.startsWith('/') ? window.location.origin + href : href;
          
          if (!seenUrls.has(url)) {
            uniquePages.push({
              title: text,
              url: url,
              href: href,
              element: link
            });
            seenUrls.add(url);
          }
        }
      }
    }
    
    console.log(`🔗 API reference strategy found ${uniquePages.length} pages`);
    return uniquePages;
  }
  
  async spaStrategy(siteAnalysis) {
    console.log('🌐 Using SPA strategy...');
    
    // For SPAs, we need to be more careful about navigation
    // Use our existing SPA detection and handling logic
    await this.expandAllPossibleSections();
    const allLinks = await this.discoverAllDocumentationLinks();
    return await this.scrapeSPASections(allLinks);
  }
  
  async comprehensiveStrategy(siteAnalysis) {
    console.log('🔍 Using comprehensive strategy with site optimizations...');
    
    // Use our existing comprehensive approach but with site-specific optimizations
    await this.expandAllPossibleSections();
    
    const uniquePages = [];
    const seenUrls = new Set();
    const seenTitles = new Set();
    
    // Use the best selectors we found for this site
    const linkSelectors = ['a'];
    if (siteAnalysis.specialSelectors.apiEndpoints) {
      linkSelectors.unshift(siteAnalysis.specialSelectors.apiEndpoints.selector);
    }
    
    for (const selector of linkSelectors) {
      const links = document.querySelectorAll(selector);
      
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent.trim();
        
        if (this.isValidDocumentationLink(href, text) && !seenTitles.has(text)) {
          const pageUrl = href.startsWith('/') ? window.location.origin + href : href;
          
          if (!seenUrls.has(pageUrl)) {
            uniquePages.push({
              title: text,
              url: pageUrl,
              href: href,
              element: link
            });
            seenUrls.add(pageUrl);
            seenTitles.add(text);
          }
        }
      }
    }
    
    console.log(`🔍 Comprehensive strategy found ${uniquePages.length} pages`);
    return uniquePages;
  }
  
  isValidDocumentationLink(href, text) {
    // Universal validation for documentation links
    if (!href || !text || text.length < 3 || text.length > 200) return false;
    
    // Skip common non-content patterns
    const skipPatterns = [
      'login', 'logout', 'sign in', 'sign up', 'register',
      'home', 'back', 'next', 'previous', 'search',
      'github', 'twitter', 'discord', 'contact', 'support',
      'privacy', 'terms', 'legal', 'about'
    ];
    
    const textLower = text.toLowerCase();
    const hrefLower = href.toLowerCase();
    
    if (skipPatterns.some(pattern => textLower.includes(pattern) || hrefLower.includes(pattern))) {
      return false;
    }
    
    // Skip external links (unless they're subdomains)
    if (href.startsWith('http') && !href.includes(window.location.hostname)) {
      return false;
    }
    
    // Prefer internal links and documentation patterns
    return href.startsWith('/') || href.startsWith('#') || 
           href.includes('/docs') || href.includes('/api') || href.includes('/reference');
  }
  
  async discoverSubskribePages() {
    console.log('🎯 Starting Subskribe-optimized page discovery...');
    
    const uniquePages = [];
    const seenUrls = new Set();
    const seenTitles = new Set();
    
    this.sendDetailedProgress({
      currentAction: '🎯 Subskribe-optimized discovery starting...',
      action: '🎯 Using Subskribe-specific strategy',
      actionType: 'info'
    });
    
    // SIMPLIFIED APPROACH: Just find all reference links after expanding everything
    console.log('🔧 Expanding all Subskribe navigation...');
    await this.expandAllSubskribeNavigation();
    
    console.log('🔗 Finding all API reference links...');
    const allLinks = document.querySelectorAll('a[href*="/reference/"]');
    
    console.log(`🔗 Found ${allLinks.length} potential API reference links`);
    
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();
      
      if (!href || !text) continue;
      
      const fullUrl = href.startsWith('/') ? window.location.origin + href : href;
      const titleKey = text.toLowerCase().trim();
      
      // Skip if we've already found this URL or title
      if (seenUrls.has(fullUrl) || seenTitles.has(titleKey)) {
        continue;
      }
      
      // Filter for actual API endpoints
      if (this.isValidSubskribeEndpoint(text, href)) {
        console.log(`✅ Adding Subskribe endpoint: "${text}" → ${href}`);
        
        uniquePages.push({
          title: text,
          url: fullUrl,
          href: href,
          element: link
        });
        
        seenUrls.add(fullUrl);
        seenTitles.add(titleKey);
      }
    }
    
    console.log(`🎉 Subskribe discovery complete: ${uniquePages.length} unique pages found`);
    this.sendDetailedProgress({
      currentAction: `🎉 Discovery complete: ${uniquePages.length} pages`,
      action: `🎉 Found ${uniquePages.length} total pages`,
      actionType: 'success'
    });
    
    return uniquePages;
  }
  
  async expandAllSubskribeNavigation() {
    console.log('🔧 Expanding all Subskribe navigation elements...');
    
    // Find and expand all navigation sections
    const expandableSelectors = [
      'button[aria-expanded="false"]',
      '[aria-expanded="false"]',
      'details:not([open])',
      '.sidebar button',
      'nav button'
    ];
    
    let totalExpanded = 0;
    
    for (const selector of expandableSelectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`🔧 Found ${elements.length} expandable elements with selector: ${selector}`);
      
      for (const element of elements) {
        try {
          const text = element.textContent.trim();
          if (text.length > 0 && text.length < 50) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.sleep(200);
            element.click();
            totalExpanded++;
            await this.sleep(300);
          }
        } catch (error) {
          // Ignore individual expansion errors
        }
      }
    }
    
    console.log(`🔧 Expanded ${totalExpanded} navigation elements, waiting for content to load...`);
    await this.sleep(3000); // Wait longer for all content to load
  }
  
  isValidSubskribeEndpoint(text, href) {
    // Must be an API reference link
    if (!href.includes('/reference/')) return false;
    
    // Skip very short or very long titles
    if (text.length < 5 || text.length > 100) return false;
    
    // Skip generic navigation
    const skipPatterns = [
      'api reference', 'documentation', 'overview', 'introduction',
      'getting started', 'authentication', 'guides', 'home'
    ];
    
    const textLower = text.toLowerCase();
    if (skipPatterns.some(pattern => textLower === pattern)) {
      return false;
    }
    
    // Must look like an API endpoint (should have an action or method)
    const hasAction = (
      text.includes('get') || text.includes('post') || text.includes('put') || text.includes('delete') ||
      text.includes('Get ') || text.includes('Create ') || text.includes('Update ') || text.includes('Delete ') ||
      text.includes('Add ') || text.includes('Remove ') || text.includes('Set ') || text.includes('Fetch ') ||
      text.includes('Generate ') || text.includes('Send ') || text.includes('Mark ') || text.includes('Apply ') ||
      /^[A-Z][a-z]+ .+/.test(text) // "Something something" pattern
    );
    
    return hasAction;
  }
  
  async findSubskribeMainSections() {
    console.log('📋 Looking for Subskribe main sections...');
    
    const sections = [];
    
    // Subskribe uses a specific sidebar structure - look for the main navigation
    const sidebarSelectors = [
      // Main navigation area
      'nav ul li',
      '.sidebar ul li', 
      '[role="navigation"] ul li',
      
      // Specific to docs sites
      '.docs-nav ul li',
      '.documentation-nav ul li'
    ];
    
    for (const selector of sidebarSelectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`📋 Checking selector "${selector}": ${elements.length} elements`);
      
      for (const element of elements) {
        // Look for section headers (like "Billing", "Accounts", etc.)
        const titleElement = element.querySelector('button, a, span');
        if (!titleElement) continue;
        
        const title = titleElement.textContent.trim();
        
        // Filter for main section names (not individual API endpoints)
        if (this.isSubskribeMainSection(title, element)) {
          console.log(`✅ Found main section: "${title}"`);
          sections.push({
            title: title,
            element: titleElement,
            container: element
          });
        }
      }
      
      // If we found sections with this selector, prioritize it
      if (sections.length > 5) break;
    }
    
    console.log(`📋 Total main sections found: ${sections.length}`);
    sections.forEach((section, i) => console.log(`  ${i + 1}. ${section.title}`));
    
    return sections;
  }
  
  isSubskribeMainSection(title, element) {
    // Known Subskribe main sections from the documentation
    const knownSections = [
      'Authentication', 'Billing', 'Accounts', 'Intelligent Sales Room',
      'Accounting', 'AI Agent', 'Experimental', 'AI Summary', 'Integrations',
      'Approvals', 'Catalog', 'Reports', 'Revenue Recognition', 'Subscriptions',
      'Users', 'Payments', 'Settings', 'Customization', 'Discounts',
      'Documents', 'Email', 'Entities', 'ERP', 'Import', 'MetricsReporting',
      'Notifications', 'Opportunity', 'Refunds', 'Revenue Enablement',
      'TemplateScript', 'Jobs', 'Foreign Exchange', 'RateCard'
    ];
    
    // Check if this matches a known section
    if (knownSections.includes(title)) {
      return true;
    }
    
    // Or if it looks like a main section (short, capitalized, not an HTTP method)
    const isMainSection = (
      title.length > 2 && 
      title.length < 30 &&
      /^[A-Z]/.test(title) && // Starts with capital
      !title.match(/^(get|post|put|delete|patch)/i) && // Not an HTTP method
      !title.includes('(') && // Not a function call
      !title.includes('/') && // Not a URL path
      title !== 'Documentation' && // Not generic
      title !== 'API Reference'
    );
    
    // Also check if this element has child elements (indicating it's expandable)
    const hasChildren = element.querySelector('ul, ol') || 
                       element.getAttribute('aria-expanded') !== null ||
                       element.innerHTML.includes('▶') ||
                       element.innerHTML.includes('chevron');
    
    return isMainSection && (hasChildren || knownSections.includes(title));
  }
  
  async expandSubskribeSection(section) {
    console.log(`🔧 Expanding Subskribe section: ${section.title}`);
    
    try {
      // Scroll into view
      section.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(500);
      
      // Try clicking the section to expand it
      section.element.click();
      await this.sleep(1000);
      
      // Sometimes we need to click a parent element or a specific expand button
      const expandButton = section.container.querySelector('[aria-expanded="false"], button[aria-expanded="false"]');
      if (expandButton) {
        console.log(`🔧 Clicking expand button for: ${section.title}`);
        expandButton.click();
        await this.sleep(1000);
      }
      
      // Wait for any animations or dynamic loading
      await this.sleep(1500);
      
      console.log(`✅ Expanded section: ${section.title}`);
      
    } catch (error) {
      console.warn(`Could not expand section ${section.title}:`, error);
    }
  }
  
  async findSubskribeEndpoints(section) {
    console.log(`🔗 Finding endpoints in section: ${section.title}`);
    
    const endpoints = [];
    
    // Look for API endpoints that appeared after expanding this section
    const searchAreas = [
      // Direct children that appeared
      section.container,
      section.container.nextElementSibling,
      
      // Nested lists that might contain the endpoints
      section.container.querySelector('ul'),
      section.container.querySelector('ol'),
      
      // Broader search in the sidebar for newly visible items
      document.querySelector('nav'),
      document.querySelector('.sidebar'),
      document.querySelector('[role="navigation"]')
    ].filter(Boolean);
    
    for (const area of searchAreas) {
      // Look specifically for links that look like API endpoints
      const apiLinks = area.querySelectorAll('a[href*="/reference/"], a[href*="/api/"]');
      
      for (const link of apiLinks) {
        const text = link.textContent.trim();
        const href = link.getAttribute('href');
        
        // Filter for actual API endpoints (not section headers)
        if (this.isSubskribeAPIEndpoint(text, href, section.title)) {
          console.log(`🔗 Found API endpoint: "${text}" → ${href}`);
          
          endpoints.push({
            title: `${section.title} > ${text}`,
            url: href.startsWith('/') ? window.location.origin + href : href,
            href: href,
            element: link,
            section: section.title
          });
        }
      }
    }
    
    console.log(`📊 Found ${endpoints.length} endpoints in ${section.title}`);
    return endpoints;
  }
  
  isSubskribeAPIEndpoint(text, href, sectionTitle) {
    // Skip if it's the section title itself
    if (text === sectionTitle) return false;
    
    // Must have an href that looks like an API endpoint
    if (!href || !href.includes('/reference/')) return false;
    
    // Skip very generic titles
    if (text.length < 3 || text.includes('Overview') || text.includes('Introduction')) {
      return false;
    }
    
    // Must look like an API endpoint description
    const looksLikeEndpoint = (
      text.includes('get') || text.includes('post') || text.includes('put') || text.includes('delete') ||
      text.includes('Get ') || text.includes('Create ') || text.includes('Update ') || text.includes('Delete ') ||
      text.includes('Add ') || text.includes('Remove ') || text.includes('Set ') || text.includes('Fetch ') ||
      text.match(/^[A-Z][a-z]+ .+/) || // "Get something", "Create something"
      href.includes('/reference/') // Direct API reference link
    );
    
    return looksLikeEndpoint && text.length < 150; // Reasonable length limit
  }
  
  isMeaningfulDocumentationPage(text, href) {
    // Skip common non-content navigation
    const skipPatterns = [
      'home', 'login', 'sign up', 'sign in', 'logout', 'register',
      'search', 'menu', 'toggle', 'close', 'open', 'back', 'next', 'previous',
      'github', 'twitter', 'discord', 'slack', 'contact', 'support',
      'privacy', 'terms', 'legal', 'about', 'company'
    ];
    
    const textLower = text.toLowerCase();
    const hrefLower = href.toLowerCase();
    
    // Skip if matches common non-content patterns
    if (skipPatterns.some(pattern => textLower.includes(pattern) || hrefLower.includes(pattern))) {
      return false;
    }
    
    // Skip external links
    if (href.startsWith('http') && !href.includes(window.location.hostname)) {
      return false;
    }
    
    // Skip empty or very generic links
    if (!text || text === 'Link' || text === 'Click here' || text.length < 3) {
      return false;
    }
    
    // Prefer documentation-specific URLs
    const isDocumentationUrl = href.includes('/reference/') || 
                              href.includes('/api/') || 
                              href.includes('/docs/') ||
                              href.includes('/guide');
    
    // Or meaningful content indicators
    const hasContentIndicators = /^(get|post|put|delete|create|update|list|fetch|retrieve)\s/i.test(text) ||
                                 text.includes('API') ||
                                 text.includes('endpoint') ||
                                 /^[A-Z][a-z]+(\s[a-z]+)*$/.test(text); // Title case patterns
    
    return isDocumentationUrl || hasContentIndicators || (href.startsWith('/') && text.length > 3);
  }
  
  getPageImportanceScore(page) {
    let score = 0;
    
    const text = page.title.toLowerCase();
    const href = page.href.toLowerCase();
    
    // API endpoints get highest priority
    if (href.includes('/reference/') || href.includes('/api/')) score += 100;
    if (/^(get|post|put|delete|create|update|list)\s/i.test(page.title)) score += 50;
    
    // Documentation sections get medium priority  
    if (href.includes('/docs/') || href.includes('/guide')) score += 30;
    
    // Specific API-related terms
    if (text.includes('api') || text.includes('endpoint')) score += 20;
    
    // Meaningful action words
    if (/^[a-z]+\s[a-z]/.test(text)) score += 10; // "action something" pattern
    
    return score;
  }
  
  async expandAllPossibleSections() {
    console.log('🔧 Starting comprehensive section expansion...');
    
    // Multiple rounds of expansion to handle nested structures
    const maxRounds = 5;
    
    for (let round = 1; round <= maxRounds; round++) {
      console.log(`🔧 Expansion round ${round}/${maxRounds}...`);
      
      const expandableSelectors = [
        // Common expandable elements
        'button[aria-expanded="false"]',
        '[aria-expanded="false"]',
        'details:not([open])',
        
        // Navigation-specific expandables
        '.sidebar button',
        '.navigation button', 
        '.docs-nav button',
        '.menu button',
        
        // List items that might be expandable
        'li > button',
        'li > a[href="#"]',
        
        // Elements with expand/collapse indicators
        '[class*="expand"]',
        '[class*="collapse"]',
        '[class*="toggle"]',
        
        // Elements with arrow indicators (common in navigation)
        'button:has(svg)',
        'a:has(svg)',
        
        // Generic clickable elements in navigation areas
        'nav [role="button"]',
        '.sidebar [role="button"]'
      ];
      
      let expandedThisRound = 0;
      
      for (const selector of expandableSelectors) {
        const elements = document.querySelectorAll(selector);
        
        for (const element of elements) {
          try {
            // Check if this element might reveal additional content
            const text = element.textContent.trim();
            
            if (text.length > 0 && text.length < 50) {
              console.log(`🔧 Expanding: "${text}"`);
              
              // Scroll into view and click
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await this.sleep(200);
              
              element.click();
              expandedThisRound++;
              
              await this.sleep(300); // Wait for expansion animation
            }
          } catch (error) {
            // Ignore individual expansion errors
            console.warn(`Could not expand element:`, error.message);
          }
        }
      }
      
      console.log(`🔧 Round ${round} complete: expanded ${expandedThisRound} elements`);
      
      // If we didn't expand anything this round, we're probably done
      if (expandedThisRound === 0) {
        console.log(`🔧 No more elements to expand, stopping after round ${round}`);
        break;
      }
      
      // Wait between rounds for dynamic content to load
      await this.sleep(1000);
    }
    
    console.log('🔧 Comprehensive expansion complete');
  }
  
  async scrapeUniquePage(page) {
    try {
      console.log(`📄 Attempting to scrape page: ${page.title}`);
      
      // If this is the current page (same URL), just extract content directly
      const currentUrl = window.location.href.split('#')[0];
      const pageUrl = page.url ? page.url.split('#')[0] : '';
      
      if (pageUrl === currentUrl || !page.href || page.href === '#' || page.href === window.location.pathname) {
        console.log(`📄 Current page content for: ${page.title}`);
        const content = await this.extractPageContent();
        content.sectionTitle = page.title;
        content.sectionUrl = page.url || window.location.href;
        return content;
      }
      
      // Navigate to the page
      console.log(`🌐 Navigating to: ${page.title} → ${page.href}`);
      
      // Store current URL and content to detect changes
      const beforeUrl = window.location.href;
      const beforeContent = this.getCurrentMainContent();
      
      // Scroll element into view and click
      page.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(500);
      
      page.element.click();
      console.log(`🖱️ Clicked: ${page.title}`);
      
      // Wait for navigation and content change with better detection
      let navigationSuccess = false;
      let contentChanged = false;
      
      for (let attempt = 0; attempt < 10; attempt++) {
        await this.sleep(800); // Longer wait between checks
        
        const afterUrl = window.location.href;
        const afterContent = this.getCurrentMainContent();
        
        // Check if URL changed (SPA navigation)
        if (afterUrl !== beforeUrl) {
          navigationSuccess = true;
          console.log(`✅ URL changed for: ${page.title} (${beforeUrl} → ${afterUrl})`);
        }
        
        // Check if content changed meaningfully
        if (afterContent !== beforeContent && afterContent.length > 100) {
          contentChanged = true;
          console.log(`✅ Content changed for: ${page.title}`);
        }
        
        // If we have either URL or content change, we're good
        if (navigationSuccess || contentChanged) {
          break;
        }
      }
      
      if (!navigationSuccess && !contentChanged) {
        console.warn(`⚠️ No navigation or content change detected for: ${page.title}`);
        return null;
      }
      
      // Wait for any dynamic content to finish loading
      await this.sleep(1500); // Give more time for content to load
      
      if (this.options.waitForDynamic) {
        await this.waitForDynamicContent();
      }
      
      // Extract the content
      const contentData = await this.extractPageContent();
      
      if (contentData.content && contentData.content.trim().length > 100) {
        contentData.sectionTitle = page.title;
        contentData.sectionUrl = page.url || window.location.href;
        
        console.log(`✅ Successfully scraped: ${page.title} (${contentData.wordCount} words)`);
        return contentData;
      } else {
        console.warn(`❌ No meaningful content found for: ${page.title}`);
        return null;
      }
      
    } catch (error) {
      console.error(`❌ Error scraping page ${page.title}:`, error);
      return null;
    }
  }
  
  async findTopLevelSections() {
    console.log('🔍 Starting top-level section discovery...');
    
    // Look for top-level navigation sections with priority order
    const sectionSelectors = [
      '.sidebar > ul > li', // Direct children of sidebar (highest priority)
      'nav > ul > li', // Direct children of nav
      '[data-testid="sidebar"] > ul > li',
      '.docs-nav > ul > li',
      '.navigation > ul > li'
      // Remove broader selectors that could cause duplicates
    ];
    
    const sections = [];
    const seenTitles = new Set(); // Track titles immediately to prevent duplicates
    const seenElements = new Set(); // Track DOM elements to prevent duplicates
    
    for (const selector of sectionSelectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`🔍 Selector "${selector}" found ${elements.length} elements`);
      
      for (const element of elements) {
        // Skip if we've already processed this exact element
        if (seenElements.has(element)) {
          continue;
        }
        
        const button = element.querySelector('button, a, [role="button"]');
        const directButton = element.tagName === 'BUTTON' ? element : null;
        const targetElement = button || directButton;
        
        if (targetElement) {
          const text = targetElement.textContent.trim();
          console.log(`📝 Checking element: "${text}"`);
          
          // Skip if we've already found this title
          if (seenTitles.has(text)) {
            console.log(`⏭️ Skipping duplicate title: "${text}"`);
            continue;
          }
          
          // More selective section detection to avoid noise
          if (text.length > 3 && text.length < 30 && 
              !text.includes('Search') && !text.includes('Home') &&
              !text.includes('Login') && !text.includes('Sign') &&
              !text.includes('Menu') && !text.includes('Toggle') &&
              // Must be meaningful section names (usually start with capital letter)
              /^[A-Z]/.test(text)) {
            
            console.log(`✅ Adding section: "${text}"`);
            sections.push({
              title: text,
              element: targetElement,
              container: element
            });
            seenTitles.add(text);
            seenElements.add(element);
            
            // Stop searching broader selectors once we find sections with specific selectors
            if (sections.length >= 3 && selector.includes('>')) {
              console.log(`🎯 Found ${sections.length} sections with specific selector, stopping broad search`);
              break;
            }
          } else {
            console.log(`❌ Rejected: "${text}" (length: ${text.length} or doesn't start with capital)`);
          }
        }
      }
      
      // If we found good sections with a specific selector, don't use broader ones
      if (sections.length >= 3 && selector.includes('>')) {
        console.log(`🎯 Found sufficient sections (${sections.length}) with specific selector, skipping broader selectors`);
        break;
      }
    }
    
    console.log(`📋 Final sections found: ${sections.length}`);
    sections.forEach((section, i) => 
      console.log(`  ${i + 1}. "${section.title}"`)
    );
    
    // Only use fallback if we found very few sections AND haven't found any good ones
    if (sections.length === 0) {
      console.log('🔄 No sections found, trying fallback discovery...');
      const fallbackSections = await this.fallbackSectionDiscovery();
      console.log(`🔄 Fallback found ${fallbackSections.length} sections`);
      
      // Apply same deduplication to fallback sections
      for (const fallbackSection of fallbackSections) {
        if (!seenTitles.has(fallbackSection.title)) {
          sections.push(fallbackSection);
          seenTitles.add(fallbackSection.title);
        }
      }
    }
    
    return sections;
  }
  
  async fallbackSectionDiscovery() {
    console.log('🔄 Starting fallback section discovery...');
    
    const fallbackSections = [];
    
    // Look for any clickable elements that might be sections
    const allClickables = document.querySelectorAll('button, [role="button"], a[href="#"], .nav-item, .sidebar-item');
    
    console.log(`🔄 Found ${allClickables.length} clickable elements to check`);
    
    for (const element of allClickables) {
      const text = element.textContent.trim();
      
      // Look for text that seems like section names
      if (text.length > 3 && text.length < 30 &&
          /^[A-Z]/.test(text) && // Starts with capital
          !text.includes('http') &&
          !text.includes('www') &&
          !text.includes('@')) {
        
        // Check if clicking it might reveal sub-items
        const parent = element.closest('li, .nav-item, .sidebar-item');
        const hasArrow = element.innerHTML.includes('▶') || 
                        element.innerHTML.includes('arrow') ||
                        element.innerHTML.includes('chevron');
        
        if (parent || hasArrow || element.getAttribute('aria-expanded') !== null) {
          console.log(`🔄 Adding fallback section: "${text}"`);
          fallbackSections.push({
            title: text,
            element: element,
            container: parent || element
          });
        }
      }
    }
    
    return fallbackSections;
  }
  
  async legacyComprehensiveScraping() {
    console.log('🔄 Starting legacy comprehensive scraping...');
    
    // Use the old approach as fallback
    this.sendProgress(10, 'Expanding all sections (legacy mode)...');
    await this.expandAllSections();
    
    this.sendProgress(30, 'Discovering all links (legacy mode)...');
    const allLinks = await this.discoverAllDocumentationLinks();
    
    this.sendProgress(50, `Scraping ${allLinks.length} discovered links...`);
    
    if (this.isSinglePageApp()) {
      return await this.scrapeSPASections(allLinks);
    } else {
      return await this.scrapeAllSections(allLinks);
    }
  }
  
  async processSingleSection(section, sectionIndex, totalSections) {
    console.log(`🔧 Processing section: ${section.title}`);
    
    const sectionContent = [];
    
    try {
      // Step 1: Expand this section
      this.sendDetailedProgress({
        currentAction: `📂 Expanding: ${section.title}...`,
        action: `📂 Expanding: ${section.title}`,
        actionType: 'info'
      });
      
      await this.expandSingleSection(section);
      
      // Step 2: Find all sub-items in this section
      const subItems = await this.findSubItemsInSection(section);
      
      console.log(`🔗 Found ${subItems.length} sub-items in ${section.title}`);
      this.sendDetailedProgress({
        foundLinks: this.currentScrapeData.length + subItems.length,
        action: `🔗 Found ${subItems.length} items in ${section.title}`,
        actionType: subItems.length > 0 ? 'success' : 'warning'
      });
      
      // Step 3: Scrape each sub-item immediately
      for (let j = 0; j < subItems.length; j++) {
        if (this.shouldStop) break;
        
        const subItem = subItems[j];
        
        this.sendDetailedProgress({
          currentAction: `📄 ${sectionIndex}/${totalSections}.${j + 1}: ${subItem.title}`,
          action: `📄 Scraping: ${subItem.title}`,
          actionType: 'info'
        });
        
        const content = await this.scrapeSubItem(subItem, section.title);
        
        if (content) {
          sectionContent.push(content);
          this.currentScrapeData.push(content); // Add to current data for tracking
          
          // Send live preview update
          this.sendContentUpdate(content);
          
          this.sendDetailedProgress({
            scrapedCount: this.currentScrapeData.length,
            action: `✅ Scraped: ${subItem.title} (${content.wordCount} words)`,
            actionType: 'success'
          });
        }
      }
      
    } catch (error) {
      console.error(`❌ Error processing section ${section.title}:`, error);
      this.sendDetailedProgress({
        action: `❌ Error in section: ${section.title}`,
        actionType: 'error'
      });
    }
    
    return sectionContent;
  }
  
  async expandSingleSection(section) {
    try {
      console.log(`🔧 Attempting to expand section: ${section.title}`);
      
      // Scroll into view first
      section.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(500);
      
      // Try multiple expansion methods
      const expansionMethods = [
        // Method 1: Direct click
        () => {
          console.log(`🖱️ Trying direct click on: ${section.title}`);
          section.element.click();
        },
        
        // Method 2: Click on parent container if it has expandable indicators
        () => {
          const parent = section.element.closest('li, .nav-item');
          if (parent && (parent.innerHTML.includes('▶') || parent.innerHTML.includes('chevron') || parent.querySelector('[aria-expanded]'))) {
            console.log(`🖱️ Trying parent click for: ${section.title}`);
            parent.click();
          }
        },
        
        // Method 3: Look for specific expand buttons
        () => {
          const expandBtn = section.container.querySelector('button[aria-expanded], .expand-button, [role="button"]');
          if (expandBtn) {
            console.log(`🖱️ Trying expand button for: ${section.title}`);
            expandBtn.click();
          }
        },
        
        // Method 4: Keyboard activation
        () => {
          console.log(`⌨️ Trying keyboard activation for: ${section.title}`);
          section.element.focus();
          section.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          section.element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        }
      ];
      
      // Try each method with pauses
      for (let i = 0; i < expansionMethods.length; i++) {
        try {
          expansionMethods[i]();
          await this.sleep(800); // Wait longer between attempts
          
          // Check if expansion worked by looking for new elements
          const potentialSubItems = section.container.parentElement?.querySelectorAll('a[href*="/reference/"], li li a');
          if (potentialSubItems && potentialSubItems.length > 0) {
            console.log(`✅ Expansion method ${i + 1} worked for ${section.title}, found ${potentialSubItems.length} potential sub-items`);
            break;
          }
        } catch (methodError) {
          console.warn(`Method ${i + 1} failed:`, methodError);
        }
      }
      
      // Wait longer for any animations or dynamic loading
      await this.sleep(1500);
      
      this.sendDetailedProgress({
        expandedCount: (this.stats?.expandedCount || 0) + 1,
        action: `🔧 Expanded: ${section.title}`,
        actionType: 'info'
      });
      
    } catch (error) {
      console.warn(`Could not expand section: ${section.title}`, error);
    }
  }
  
  async findSubItemsInSection(section) {
    // Look for sub-items that appeared after expanding this section
    await this.sleep(2000); // Wait even longer for expansion animation
    
    const subItems = [];
    const processedTitles = new Set(); // Prevent duplicates
    
    console.log(`🔍 Looking for sub-items in section: ${section.title}`);
    
    // SUBSKRIBE-SPECIFIC: Try to detect if this is Subskribe and use specific patterns
    const isSubskribe = window.location.hostname.includes('subskribe');
    
    let searchAreas = [];
    
    if (isSubskribe) {
      console.log('🎯 Detected Subskribe - using specialized search patterns');
      
      // For Subskribe, look for the specific pattern where clicking a section reveals sub-items
      searchAreas = [
        // After clicking, sub-items might appear in various places
        section.container.nextElementSibling,
        section.container.nextElementSibling?.nextElementSibling,
        section.container.nextElementSibling?.nextElementSibling?.nextElementSibling,
        
        // Look for nested content that appears after expansion
        document.querySelector('.sidebar ul ul'), // Common pattern for nested sidebar items
        document.querySelector('nav ul ul'),
        
        // Search in the entire sidebar for items that might have appeared
        document.querySelector('.sidebar'),
        document.querySelector('nav'),
        
        // Look for any new links that appeared anywhere on the page
        document.body
      ].filter(Boolean);
      
      console.log(`🔍 Subskribe-specific search in ${searchAreas.length} areas`);
    } else {
      // Generic search strategy for other sites
      searchAreas = [
        // Direct descendants of the section
        section.container,
        section.container.nextElementSibling,
        section.container.nextElementSibling?.nextElementSibling,
        
        // Nested lists (common in documentation)
        section.container.querySelector('ul'),
        section.container.querySelector('ol'),
        section.container.querySelector('.submenu'),
        section.container.querySelector('.sub-navigation'),
        
        // Parent-level nested searches
        section.container.parentElement?.querySelector('ul ul'),
        section.container.parentElement?.querySelector('ul ol'),
        
        // Look for expanded content in broader area
        document.querySelector(`[data-section="${section.title}"] ul`),
        document.querySelector(`.expanded ul`),
        
        // All siblings that might contain expanded content
        ...Array.from(section.container.parentElement?.children || [])
          .filter(child => child !== section.container)
          .slice(0, 5) // Check more siblings
      ].filter(Boolean);
      
      console.log(`🔍 Generic search in ${searchAreas.length} areas for sub-items`);
    }
    
    for (const area of searchAreas) {
      // Look for links that are likely API endpoints
      const linkSelectors = [
        'a[href*="/reference/"]', // Direct reference links
        'a[href*="/api/"]',       // API links
        'a[href^="/"]',           // Relative links
        'li li a',                // Nested list links
        'a[title*="endpoint"]',   // Links with endpoint in title
        'a[title*="API"]',        // Links with API in title
        '[role="link"]'           // ARIA links
      ];
      
      for (const selector of linkSelectors) {
        const links = area.querySelectorAll(selector);
        console.log(`🔗 Found ${links.length} links with selector "${selector}" in area`);
        
        for (const link of links) {
          const text = link.textContent.trim();
          const href = link.getAttribute('href') || '';
          
          // Skip if we've already found this item
          if (processedTitles.has(text)) {
            continue;
          }
          
          // Enhanced filtering for API endpoints
          const isApiEndpoint = (
            href.includes('/reference/') ||
            href.includes('/api/') ||
            text.match(/^(Get|Post|Put|Delete|Create|Update|List|Fetch|Retrieve)\s/i) ||
            text.match(/\b(endpoint|API|method)\b/i) ||
            (text.length > 5 && text.length < 80 && href.startsWith('/'))
          );
          
          const isNotGeneral = (
            !text.toLowerCase().includes(section.title.toLowerCase()) && // Don't include the section title itself
            !text.includes('Overview') && // Skip overview pages
            !text.includes('Introduction') &&
            !text.includes('Getting Started') &&
            !text.includes('Guide') &&
            text !== 'Documentation' &&
            text !== 'API Reference'
          );
          
          if (isApiEndpoint && isNotGeneral && text.length > 3) {
            console.log(`✅ Adding API endpoint: "${text}" (${href})`);
            subItems.push({
              title: text,
              element: link,
              href: href
            });
            processedTitles.add(text);
          } else {
            console.log(`❌ Skipping: "${text}" (API: ${isApiEndpoint}, NotGeneral: ${isNotGeneral}, href: ${href})`);
          }
        }
      }
    }
    
    console.log(`📊 Found ${subItems.length} unique sub-items in ${section.title}`);
    
    // If we didn't find many sub-items, log the available content for debugging
    if (subItems.length < 2) {
      console.log(`🔍 Debugging: Available content in ${section.title}:`);
      for (const area of searchAreas.slice(0, 3)) {
        const allLinks = area.querySelectorAll('a');
        console.log(`Area has ${allLinks.length} total links:`);
        allLinks.forEach(link => {
          const text = link.textContent.trim().substring(0, 50);
          const href = link.getAttribute('href') || '';
          console.log(`  - "${text}" → ${href}`);
        });
      }
    }
    
    return subItems;
  }
  
  async scrapeSubItem(subItem, sectionTitle) {
    try {
      // Navigate to the sub-item
      subItem.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(300);
      
      const beforeContent = this.getCurrentMainContent();
      subItem.element.click();
      await this.sleep(1500);
      
      // Check if content changed
      const afterContent = this.getCurrentMainContent();
      if (afterContent === beforeContent) {
        console.warn(`No content change for: ${subItem.title}`);
        return null;
      }
      
      // Wait for dynamic content
      if (this.options.waitForDynamic) {
        await this.waitForDynamicContent();
      }
      
      // Extract the content
      const contentData = await this.extractPageContent();
      
      if (contentData.content && contentData.content.trim().length > 100) {
        contentData.sectionTitle = `${sectionTitle} > ${subItem.title}`;
        contentData.sectionUrl = subItem.href;
        return contentData;
      }
      
      return null;
      
    } catch (error) {
      console.error(`Error scraping sub-item ${subItem.title}:`, error);
      return null;
    }
  }
}

// Initialize the content scraper
new ContentScraper();
