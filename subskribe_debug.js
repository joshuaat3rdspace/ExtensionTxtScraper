// Subskribe-specific debug helper
// Run this in the console on docs.subskribe.com to understand the structure

console.log('🔍 SUBSKRIBE STRUCTURE ANALYSIS');

// 1. Find all navigation sections
console.log('\n📋 NAVIGATION SECTIONS:');
const navSections = document.querySelectorAll('.sidebar > ul > li, nav > ul > li, [class*="sidebar"] li');
console.log(`Found ${navSections.length} potential sections`);

navSections.forEach((section, i) => {
  const text = section.textContent.trim().split('\n')[0]; // First line only
  const hasButton = section.querySelector('button, [role="button"], a');
  const hasArrow = section.innerHTML.includes('▶') || section.innerHTML.includes('chevron');
  const isExpandable = section.querySelector('[aria-expanded]') || hasArrow;
  
  console.log(`${i + 1}. "${text.substring(0, 30)}" - Button: ${!!hasButton}, Expandable: ${isExpandable}`);
  
  if (text.includes('Billing') || text.includes('Accounts')) {
    console.log(`   🎯 BILLING/ACCOUNTS SECTION FOUND:`, section);
    console.log(`   🔍 HTML:`, section.outerHTML.substring(0, 200));
  }
});

// 2. Try to find and expand billing section specifically
console.log('\n🔧 TRYING TO EXPAND BILLING SECTION:');
const billingElements = Array.from(document.querySelectorAll('*')).filter(el => 
  el.textContent.trim().startsWith('Billing') && el.textContent.trim().length < 20
);

console.log(`Found ${billingElements.length} elements containing "Billing"`);
billingElements.forEach((el, i) => {
  console.log(`${i + 1}. Tag: ${el.tagName}, Text: "${el.textContent.trim()}", Parent: ${el.parentElement?.tagName}`);
  
  if (i === 0) {
    console.log(`🖱️ Attempting to click first billing element...`);
    el.click();
    
    setTimeout(() => {
      console.log('\n📊 AFTER CLICKING BILLING:');
      
      // Look for newly appeared links
      const newLinks = document.querySelectorAll('a[href*="/reference/"], a[href*="billing"], li li a');
      console.log(`Found ${newLinks.length} potential API links after expansion`);
      
      newLinks.forEach((link, j) => {
        if (j < 10) { // Show first 10
          const text = link.textContent.trim();
          const href = link.getAttribute('href');
          console.log(`  ${j + 1}. "${text.substring(0, 40)}" → ${href}`);
        }
      });
      
      // Check for nested lists
      const nestedLists = document.querySelectorAll('ul ul, ol ul, ul ol');
      console.log(`\nFound ${nestedLists.length} nested lists`);
      
      nestedLists.forEach((list, k) => {
        if (k < 3) {
          const listLinks = list.querySelectorAll('a');
          console.log(`  Nested list ${k + 1}: ${listLinks.length} links`);
          listLinks.forEach((link, l) => {
            if (l < 5) {
              console.log(`    - "${link.textContent.trim().substring(0, 30)}" → ${link.getAttribute('href')}`);
            }
          });
        }
      });
      
    }, 2000);
  }
});

// 3. Check current page structure
console.log('\n🏗️ CURRENT PAGE STRUCTURE:');
const mainContent = document.querySelector('main, .main-content, .content, .docs-content');
if (mainContent) {
  console.log('Main content area found:', mainContent.tagName, mainContent.className);
} else {
  console.log('No main content area found');
}

// 4. Look for all links on the page
const allLinks = document.querySelectorAll('a[href]');
const referenceLinks = Array.from(allLinks).filter(link => 
  link.getAttribute('href')?.includes('/reference/') || 
  link.textContent.includes('API') ||
  link.textContent.match(/^(Get|Post|Put|Delete|Create|Update|List|Fetch)\s/i)
);

console.log(`\n🔗 REFERENCE/API LINKS (${referenceLinks.length} total):`);
referenceLinks.slice(0, 20).forEach((link, i) => {
  const text = link.textContent.trim();
  const href = link.getAttribute('href');
  console.log(`${i + 1}. "${text.substring(0, 40)}" → ${href}`);
});

// 5. Check for dynamic content loading
console.log('\n⚡ DYNAMIC CONTENT CHECK:');
const scripts = document.querySelectorAll('script[src]');
const hasReact = Array.from(scripts).some(s => s.src.includes('react'));
const hasVue = Array.from(scripts).some(s => s.src.includes('vue'));
const hasAngular = Array.from(scripts).some(s => s.src.includes('angular'));

console.log(`React: ${hasReact}, Vue: ${hasVue}, Angular: ${hasAngular}`);
console.log(`SPA indicators: ${window.history.pushState !== undefined}, ${!!document.querySelector('#root, #app')}`);

console.log('\n✅ Analysis complete! Check the output above for Subskribe structure details.');
