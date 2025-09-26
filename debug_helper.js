/**
 * DEBUG HELPER SCRIPT
 * 
 * Paste this into the browser console (F12) on the documentation page
 * to manually inspect what the extension can see
 */

console.log('🔍 LLM Text Scraper - Debug Helper');

// Function to manually check expandable elements
function debugExpandableElements() {
  console.log('\n📋 CHECKING EXPANDABLE ELEMENTS:');
  
  const selectors = [
    '[data-testid="sidebar-item"] button',
    '.sidebar button',
    '[role="button"]',
    'button[aria-expanded="false"]',
    '[class*="expand"]',
    '[class*="toggle"]',
    '[class*="collapse"]'
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements`);
    
    elements.forEach((el, i) => {
      if (i < 3) { // Show first 3 examples
        console.log(`  - "${el.textContent.trim().substring(0, 30)}"`, el);
      }
    });
  });
}

// Function to manually check documentation links
function debugDocumentationLinks() {
  console.log('\n🔗 CHECKING DOCUMENTATION LINKS:');
  
  const selectors = [
    'nav a[href]',
    '.sidebar a[href]',
    'ul li a[href]',
    '[class*="sidebar"] a[href]'
  ];
  
  const allLinks = [];
  
  selectors.forEach(selector => {
    const links = document.querySelectorAll(selector);
    console.log(`${selector}: ${links.length} links`);
    
    links.forEach((link, i) => {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();
      
      if (href && text && (href.includes('/reference/') || href.includes('/api/') || href.includes('/docs/'))) {
        allLinks.push({ text, href, element: link });
        
        if (i < 5) { // Show first 5 examples
          console.log(`  - "${text}" → ${href}`);
        }
      }
    });
  });
  
  console.log(`\n📊 TOTAL DOCUMENTATION LINKS FOUND: ${allLinks.length}`);
  return allLinks;
}

// Function to check current page structure
function debugPageStructure() {
  console.log('\n🏗️ PAGE STRUCTURE ANALYSIS:');
  
  const sidebar = document.querySelector('.sidebar, [class*="sidebar"], nav, aside');
  console.log('Sidebar element:', sidebar);
  
  const mainContent = document.querySelector('main, .main, .content, [role="main"]');
  console.log('Main content element:', mainContent);
  
  const navItems = document.querySelectorAll('nav li, .sidebar li, [class*="nav-item"]');
  console.log(`Navigation items found: ${navItems.length}`);
  
  // Check for common documentation site patterns
  const docPatterns = [
    'ReadMe',
    'GitBook', 
    'Notion',
    'Confluence',
    'Docusaurus',
    'Swagger',
    'Redoc'
  ];
  
  docPatterns.forEach(pattern => {
    const found = document.querySelector(`[class*="${pattern.toLowerCase()}"], [data-*="${pattern.toLowerCase()}"]`);
    if (found) {
      console.log(`Detected ${pattern} documentation platform`);
    }
  });
}

// Function to simulate expansion
function debugExpansion() {
  console.log('\n🔄 SIMULATING EXPANSION:');
  
  const expandableElements = document.querySelectorAll(`
    button[aria-expanded="false"],
    .collapsed,
    [class*="expand"],
    details:not([open])
  `);
  
  console.log(`Found ${expandableElements.length} potentially expandable elements`);
  
  expandableElements.forEach((el, i) => {
    if (i < 3) {
      console.log(`Element ${i + 1}:`, el.textContent.trim().substring(0, 50), el);
      
      // Try to expand (for testing only)
      try {
        el.click();
        console.log(`  ✅ Clicked successfully`);
      } catch (error) {
        console.log(`  ❌ Click failed:`, error.message);
      }
    }
  });
}

// Run all debug functions
console.log('🚀 Running debug analysis...\n');

debugPageStructure();
debugExpandableElements();
debugDocumentationLinks();

console.log('\n🛠️ DEBUG FUNCTIONS AVAILABLE:');
console.log('- debugPageStructure() - Analyze page layout');
console.log('- debugExpandableElements() - Find expandable items');  
console.log('- debugDocumentationLinks() - Find documentation links');
console.log('- debugExpansion() - Test expanding elements');

console.log('\n💡 TIP: Run debugExpansion() to test expanding sections manually');
