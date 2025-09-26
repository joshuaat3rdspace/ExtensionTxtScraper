/**
 * Utility functions for text processing and optimization
 */

class TextProcessor {
  /**
   * Clean and optimize text for LLM consumption
   */
  static optimizeForLLM(text) {
    return text
      // Normalize whitespace
      .replace(/[\r\n]+/g, '\n')
      .replace(/[ \t]+/g, ' ')
      
      // Remove excessive line breaks
      .replace(/\n{4,}/g, '\n\n\n')
      
      // Clean up common formatting issues
      .replace(/\u00A0/g, ' ') // Non-breaking spaces
      .replace(/\u2018|\u2019/g, "'") // Smart quotes
      .replace(/\u201C|\u201D/g, '"') // Smart double quotes
      .replace(/\u2013|\u2014/g, '-') // Em/en dashes
      .replace(/\u2026/g, '...') // Ellipsis
      
      // Trim each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      
      // Final cleanup
      .trim();
  }
  
  /**
   * Extract and format code blocks
   */
  static formatCodeBlocks(content) {
    // Look for code patterns and wrap them properly
    const codePatterns = [
      // Inline code (backticks)
      /`([^`]+)`/g,
      
      // Code blocks (multiple lines with consistent indentation)
      /^([ ]{4,}|\t+)(.+)$/gm,
      
      // Common code indicators
      /^(function|class|const|let|var|if|for|while|def|import|export)\s+.+$/gm
    ];
    
    // This is a simplified implementation
    // In practice, you'd want more sophisticated code detection
    return content;
  }
  
  /**
   * Estimate reading time and complexity
   */
  static analyzeContent(text) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      readingTimeMinutes: Math.ceil(words.length / 200), // ~200 WPM average
      complexity: this.estimateComplexity(words, sentences)
    };
  }
  
  /**
   * Estimate text complexity
   */
  static estimateComplexity(words, sentences) {
    if (sentences.length === 0) return 'low';
    
    const avgWordsPerSentence = words.length / sentences.length;
    const longWords = words.filter(word => word.length > 6).length;
    const longWordRatio = longWords / words.length;
    
    if (avgWordsPerSentence > 20 || longWordRatio > 0.3) {
      return 'high';
    } else if (avgWordsPerSentence > 15 || longWordRatio > 0.2) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Generate a summary of the content
   */
  static generateSummary(text, maxLength = 200) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return '';
    
    let summary = sentences[0].trim();
    
    // Add more sentences until we hit the limit
    for (let i = 1; i < sentences.length && summary.length < maxLength; i++) {
      const nextSentence = sentences[i].trim();
      if (summary.length + nextSentence.length + 2 <= maxLength) {
        summary += '. ' + nextSentence;
      } else {
        break;
      }
    }
    
    return summary + (sentences.length > 1 ? '.' : '');
  }
  
  /**
   * Extract key topics/terms from text
   */
  static extractKeyTerms(text, limit = 10) {
    // Simple keyword extraction based on frequency
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3); // Filter out short words
    
    // Count word frequency
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    // Sort by frequency and return top terms
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  }
}
