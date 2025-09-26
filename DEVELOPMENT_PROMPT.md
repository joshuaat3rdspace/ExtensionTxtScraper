# Chrome Extension: LLM-Optimized Text Scraper

## Project Overview
Create a Chrome extension that extracts ALL text content from webpages (including embedded/dynamic content) and saves it as LLM-optimized .txt files. Primary use case: scraping paywalled API documentation that may have embedded content across multiple sections.

## Core Requirements

### 1. Text Extraction Capabilities
- **Comprehensive scraping**: Extract all visible text from the current webpage
- **Deep content detection**: Handle embedded iframes, dynamically loaded content, and hidden sections
- **Smart content filtering**: Remove navigation, ads, headers/footers, and other non-content elements
- **Preserve document structure**: Maintain headings, sections, and logical flow for LLM comprehension
- **Handle JavaScript-rendered content**: Wait for dynamic content to load before scraping

### 2. LLM Optimization Features
- **Clean text formatting**: Remove unnecessary HTML formatting while preserving semantic structure
- **Logical content organization**: Structure text with clear headings, sections, and hierarchy
- **Code block preservation**: Maintain formatting for code examples and API snippets
- **Link context**: Include relevant link text and URLs where contextually important
- **Metadata inclusion**: Add page title, URL, and scrape timestamp to the file header

### 3. User Experience
- **One-click activation**: Simple browser action button to start scraping
- **Progress indication**: Show scraping progress for complex pages
- **Automatic file naming**: Generate meaningful filenames based on page title/URL
- **Download management**: Automatically save files to Downloads folder
- **Error handling**: Graceful handling of permission issues, network errors, etc.

### 4. Technical Architecture

#### Extension Structure:
```
extension/
├── manifest.json (Manifest V3)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/
│   └── content.js
├── background/
│   └── background.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── utils/
    └── textProcessor.js
```

#### Key Technical Requirements:
- **Manifest V3 compliance**: Use latest Chrome extension standards
- **Content Script injection**: Access page DOM for text extraction
- **Background service worker**: Handle file downloads and cross-tab communication
- **Permissions**: activeTab, downloads, scripting
- **Cross-origin handling**: Work with embedded content from different domains
- **Performance optimization**: Handle large pages without freezing the browser

### 5. Content Processing Logic

#### Text Extraction Strategy:
1. **Primary content detection**: Identify main content areas using semantic HTML, common class names (content, main, article, etc.)
2. **Embedded content extraction**: Scan for and process iframes, embedded widgets
3. **Dynamic content handling**: Wait for lazy-loaded content, infinite scroll sections
4. **Text cleaning**: Remove scripts, styles, comments, and non-visible elements
5. **Structure preservation**: Convert HTML structure to readable text format with proper spacing and hierarchy

#### LLM-Friendly Formatting:
- Use markdown-style headers (# ## ###) for document structure
- Preserve code blocks with proper formatting
- Include clear section separators
- Maintain bullet points and numbered lists
- Add context for tables and images (alt text, captions)

### 6. Edge Cases to Handle
- **Infinite scroll pages**: Detect and handle auto-loading content
- **Password-protected content**: Work with authenticated/paywalled sites
- **JavaScript-heavy SPAs**: Wait for content rendering completion
- **Multi-language content**: Preserve character encoding
- **Large documents**: Handle memory efficiently for massive pages
- **Protected content**: Respect site policies while extracting available text

### 7. File Output Format
```
# [Page Title]
**URL:** [page_url]
**Scraped:** [timestamp]
**Word Count:** [approximate_count]

---

[Extracted and formatted content here]
```

## Implementation Priority
1. **Core extension setup**: Manifest, basic popup, permissions
2. **Basic text extraction**: Simple DOM traversal and text collection
3. **Content cleaning**: Remove unwanted elements and format for readability
4. **File download functionality**: Generate and save .txt files
5. **Advanced content detection**: Handle dynamic/embedded content
6. **UI/UX polish**: Progress indicators, error handling, better styling
7. **Performance optimization**: Handle large pages efficiently

## Success Criteria
- ✅ Extract complete text content from complex documentation sites
- ✅ Generate clean, LLM-readable .txt files
- ✅ Handle paywalled/authenticated content seamlessly
- ✅ Work reliably across different website structures
- ✅ Process pages efficiently without browser performance issues
- ✅ Provide clear user feedback and error handling

## Development Notes
- Start with a simple MVP and iterate
- Test extensively on real documentation sites
- Prioritize reliability over feature completeness initially
- Consider rate limiting for sites with many pages
- Ensure compliance with website terms of service
