import { ValidationResult, SectionValidation } from './types';

/**
 * Validate PR description and all sections
 */
export function validatePRDescription(prDescription: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    score: 0,
    summary: validateSection(prDescription, '## Summary'),
    changes: validateSection(prDescription, '## What Changed'),
    testing: validateSection(prDescription, '## Testing'),
    impact: validateSection(prDescription, '## Impact & Risks'),
    notes: validateSection(prDescription, '## Additional Notes'),
    warnings: []
  };
  
  // Check if all mandatory sections are valid
  const allSectionsValid = result.summary.isValid &&
    result.changes.isValid &&
    result.testing.isValid &&
    result.impact.isValid &&
    result.notes.isValid;
  
  result.isValid = allSectionsValid;
  
  // Collect warnings
  if (!result.summary.isValid) {
    result.warnings.push(...result.summary.issues);
  }
  if (!result.changes.isValid) {
    result.warnings.push(...result.changes.issues);
  }
  if (!result.testing.isValid) {
    result.warnings.push(...result.testing.issues);
  }
  if (!result.impact.isValid) {
    result.warnings.push(...result.impact.issues);
  }
  if (!result.notes.isValid) {
    result.warnings.push(...result.notes.issues);
  }
  
  return result;
}

/**
 * Validate a specific section in the PR description
 */
function validateSection(prDescription: string, sectionHeader: string): SectionValidation {
  const result: SectionValidation = {
    isValid: false,
    content: undefined,
    length: 0,
    issues: []
  };
  
  // Check if section exists
  const sectionRegex = new RegExp(`${escapeRegex(sectionHeader)}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = prDescription.match(sectionRegex);
  
  if (!match) {
    result.issues.push(`Missing section: ${sectionHeader}`);
    return result;
  }
  
  const content = match[1].trim();
  result.content = content;
  result.length = content.length;
  
  // Check if section has meaningful content
  if (content.length === 0) {
    result.issues.push(`${sectionHeader} is empty`);
    return result;
  }
  
  // Minimum content length (50 characters)
  const minLength = 50;
  if (content.length < minLength) {
    result.issues.push(`${sectionHeader} is too short (min ${minLength} characters)`);
    return result;
  }
  
  // Check for placeholder text
  const placeholders = ['TODO', 'TBD', 'coming soon', 'add later', 'fill this in'];
  for (const placeholder of placeholders) {
    if (content.toLowerCase().includes(placeholder.toLowerCase())) {
      result.issues.push(`${sectionHeader} contains placeholder text: "${placeholder}"`);
    }
  }
  
  // Section-specific validations
  if (sectionHeader === '## What Changed') {
    if (!content.includes('###')) {
      result.issues.push('What Changed section should include subsections (###)');
    }
  }
  
  if (sectionHeader === '## Testing') {
    const hasTestInstructions = content.includes('Test Instructions') || 
                                content.includes('1.') || 
                                content.includes('- ');
    if (!hasTestInstructions) {
      result.issues.push('Testing section should include step-by-step instructions');
    }
  }
  
  // If no critical issues, section is valid
  result.isValid = result.issues.length === 0;
  
  return result;
}

/**
 * Helper: Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if PR description meets minimum quality standards
 */
export function meetsQualityStandards(validation: ValidationResult, minScore: number = 85): boolean {
  return validation.isValid && validation.score >= minScore;
}

/**
 * Get improvement suggestions based on validation
 */
export function getImprovementSuggestions(validation: ValidationResult): string[] {
  const suggestions: string[] = [];
  
  if (!validation.summary.isValid && validation.summary.length < 100) {
    suggestions.push('Add more context to the Summary section');
  }
  
  if (!validation.changes.isValid) {
    suggestions.push('Provide detailed change descriptions in What Changed section');
  }
  
  if (!validation.testing.isValid) {
    suggestions.push('Add clear testing instructions with step-by-step guidance');
  }
  
  if (!validation.impact.isValid) {
    suggestions.push('Document potential impacts and risks');
  }
  
  if (!validation.notes.isValid) {
    suggestions.push('Include technical details and related issues in Additional Notes');
  }
  
  return suggestions;
}
