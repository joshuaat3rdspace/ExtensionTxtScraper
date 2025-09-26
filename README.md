# LLM Text Scraper Chrome Extension

A Chrome extension that extracts and saves webpage text content optimized for Large Language Model (LLM) consumption. Perfect for scraping paywalled API documentation, articles, and other web content while preserving structure and readability.

## Features

- 🤖 **LLM-Optimized Output**: Clean, structured text format perfect for AI consumption
- 📄 **Comprehensive Extraction**: Captures all visible text including embedded content
- 🔒 **Paywall Compatible**: Works with authenticated/logged-in content
- 🎯 **Smart Content Detection**: Automatically identifies main content areas
- ⚡ **Dynamic Content Handling**: Waits for JavaScript-rendered content
- 💾 **Auto-Save**: Downloads files directly to your Downloads folder
- 🎨 **Modern UI**: Clean, intuitive interface with progress tracking

## Installation

### From Source (Development)

1. **Clone this repository**:
   ```bash
   git clone <repository-url>
   cd ExtensionTxtScraper
   ```

2. **Open Chrome Extensions page**:
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

3. **Load the extension**:
   - Click "Load unpacked"
   - Select the `ExtensionTxtScraper` folder
   - The extension should appear in your extensions list

4. **Pin the extension** (optional):
   - Click the extensions icon in Chrome toolbar
   - Pin "LLM Text Scraper" for easy access

## Usage

### Basic Usage

1. **Navigate to any webpage** you want to scrape
2. **Click the extension icon** in your Chrome toolbar
3. **Click "Scrape Page Text"** button
4. **Wait for extraction** to complete (progress bar will show status)
5. **File automatically downloads** to your Downloads folder

### Options

- **Include link URLs**: Preserves hyperlinks in markdown format
- **Wait for dynamic content**: Allows time for JavaScript-rendered content to load
- **Extract embedded content**: Attempts to extract text from iframes and embedded elements

### Output Format

The extension generates `.txt` files with the following structure:

```
# Page Title
**URL:** https://example.com/page
**Scraped:** 2024-01-15T10:30:00.000Z
**Word Count:** ~1,250
**Sections Found:** 5

---

[Clean, structured content here with proper headings and formatting]
```

## Use Cases

- **API Documentation**: Extract complete documentation from paywalled services
- **Research Articles**: Save academic papers and articles for LLM analysis
- **Technical Blogs**: Capture tutorials and guides with preserved formatting
- **News Articles**: Archive articles with clean, readable formatting
- **Legal Documents**: Extract text while maintaining document structure

## Technical Details

### Architecture

- **Manifest V3**: Uses latest Chrome extension standards
- **Content Script**: Handles DOM traversal and text extraction
- **Background Service Worker**: Manages file downloads
- **Popup Interface**: Provides user controls and status updates

### Content Processing

- Intelligently identifies main content areas
- Removes navigation, ads, and non-content elements
- Preserves document structure (headings, lists, paragraphs)
- Handles dynamic and lazy-loaded content
- Processes embedded iframes when possible
- Maintains code block formatting

### Browser Permissions

- `activeTab`: Access current tab content
- `downloads`: Save files to Downloads folder
- `scripting`: Inject content scripts

## Troubleshooting

### Extension Not Working

1. **Check permissions**: Ensure the extension has necessary permissions
2. **Reload extension**: Go to `chrome://extensions/` and reload the extension
3. **Refresh page**: Reload the webpage and try again
4. **Check console**: Open Developer Tools (F12) and check for errors

### Poor Text Extraction

1. **Enable dynamic content waiting**: Check the "Wait for dynamic content" option
2. **Try scrolling**: Manually scroll the page to trigger lazy loading
3. **Wait for page load**: Ensure the page is fully loaded before scraping

### Download Issues

1. **Check Downloads folder**: Verify files aren't being blocked
2. **Clear browser cache**: Sometimes helps with download issues
3. **Disable popup blockers**: Ensure downloads aren't being blocked

## Development

### Project Structure

```
ExtensionTxtScraper/
├── manifest.json              # Extension configuration
├── popup/                     # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/                   # Content script
│   └── content.js
├── background/                # Background service worker
│   └── background.js
├── utils/                     # Utility functions
│   └── textProcessor.js
└── icons/                     # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Adding Features

The extension is modular and extensible. Key areas for enhancement:

- **Text Processing**: Enhance `utils/textProcessor.js` for better content cleaning
- **Content Detection**: Improve content area detection in `content/content.js`
- **Export Formats**: Add support for Markdown, JSON, or other formats
- **Batch Processing**: Add support for scraping multiple pages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Privacy

This extension:
- Only processes data locally in your browser
- Does not send any data to external servers
- Only accesses webpage content when you explicitly trigger scraping
- Downloads files directly to your local Downloads folder

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check the troubleshooting section above
- Review Chrome extension documentation for advanced usage
