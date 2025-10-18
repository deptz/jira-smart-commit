import { PRContext, ValidationResult } from './types';
import { analyzeCommitQuality } from './commitAnalyzer';

/**
 * Scoring weights (total: 100 points)
 */
const SCORING_WEIGHTS = {
  mandatorySections: 50,  // All 5 sections must exist
  jiraContext: 20,        // JIRA issue linked and detailed
  commitQuality: 15,      // Conventional commits, good messages
  testCoverage: 10,       // Test coverage present and sufficient
  technicalDetails: 5     // Good technical documentation
};

/**
 * Calculate quality score for PR description (0-100)
 */
export function calculateScore(
  context: PRContext,
  validation: ValidationResult,
  prDescription: string
): number {
  let score = 0;
  
  // 1. Mandatory sections (50 points)
  score += calculateMandatorySectionsScore(validation);
  
  // 2. JIRA context (20 points)
  score += calculateJiraContextScore(context);
  
  // 3. Commit quality (15 points)
  score += calculateCommitQualityScore(context);
  
  // 4. Test coverage (10 points)
  score += calculateTestCoverageScore(context);
  
  // 5. Technical details (5 points)
  score += calculateTechnicalDetailsScore(context, prDescription);
  
  return Math.round(score);
}

/**
 * Score: Mandatory sections (50 points)
 * All 5 sections must exist and have meaningful content
 */
function calculateMandatorySectionsScore(validation: ValidationResult): number {
  if (!validation.isValid) {
    return 0;
  }
  
  const maxScore = SCORING_WEIGHTS.mandatorySections;
  const sections = [
    validation.summary,
    validation.changes,
    validation.testing,
    validation.impact,
    validation.notes
  ];
  
  // Each section worth equal points
  const pointsPerSection = maxScore / sections.length;
  let score = 0;
  
  for (const section of sections) {
    if (section.isValid) {
      score += pointsPerSection;
      
      // Bonus for detailed sections (good length)
      if (section.content && section.content.length > 200) {
        score += pointsPerSection * 0.2; // 20% bonus
      }
    }
  }
  
  return Math.min(score, maxScore);
}

/**
 * Score: JIRA context (20 points)
 * JIRA issue present with description, acceptance criteria
 */
function calculateJiraContextScore(context: PRContext): number {
  const maxScore = SCORING_WEIGHTS.jiraContext;
  
  if (!context.jiraIssue) {
    return 0;
  }
  
  let score = 0;
  const issue = context.jiraIssue;
  
  // JIRA key extracted (5 points)
  if (context.jiraKey) {
    score += 5;
  }
  
  // Summary exists (3 points)
  if (issue.summary) {
    score += 3;
  }
  
  // Description exists and detailed (5 points)
  if (issue.description) {
    score += issue.description.length > 100 ? 5 : 3;
  }
  
  // Acceptance criteria present (5 points)
  if (issue.acceptance && issue.acceptance.length > 0) {
    score += 5;
  }
  
  // Related issues linked (2 points)
  if (issue.relatedKeys && issue.relatedKeys.length > 0) {
    score += 2;
  }
  
  return Math.min(score, maxScore);
}

/**
 * Score: Commit quality (15 points)
 * Conventional commits, good naming, proper scopes
 */
function calculateCommitQualityScore(context: PRContext): number {
  const maxScore = SCORING_WEIGHTS.commitQuality;
  
  if (context.commits.length === 0) {
    return 0;
  }
  
  const quality = analyzeCommitQuality(context.commits);
  let score = 0;
  
  // Conventional commits percentage (8 points)
  score += (quality.conventionalPercentage / 100) * 8;
  
  // Scope usage (3 points)
  score += (quality.scopeUsage / 100) * 3;
  
  // Average message length (2 points)
  // Optimal length: 50-72 characters
  if (quality.averageMessageLength >= 50 && quality.averageMessageLength <= 72) {
    score += 2;
  } else if (quality.averageMessageLength >= 30 && quality.averageMessageLength <= 100) {
    score += 1;
  }
  
  // Reasonable number of commits (2 points)
  // Too few or too many commits may indicate issues
  const commitCount = context.commits.length;
  if (commitCount >= 2 && commitCount <= 20) {
    score += 2;
  } else if (commitCount === 1 || (commitCount > 20 && commitCount <= 50)) {
    score += 1;
  }
  
  return Math.min(score, maxScore);
}

/**
 * Score: Test coverage (10 points)
 * Coverage present and meets threshold
 */
function calculateTestCoverageScore(context: PRContext): number {
  const maxScore = SCORING_WEIGHTS.testCoverage;
  
  if (!context.coverage) {
    // No coverage data = 0 points
    return 0;
  }
  
  let score = 0;
  const coverage = context.coverage.percentage;
  
  // Coverage exists (3 points)
  score += 3;
  
  // Coverage quality (7 points based on percentage)
  if (coverage >= 90) {
    score += 7;
  } else if (coverage >= 80) {
    score += 6;
  } else if (coverage >= 70) {
    score += 4;
  } else if (coverage >= 60) {
    score += 2;
  } else {
    score += 1;
  }
  
  return Math.min(score, maxScore);
}

/**
 * Score: Technical details (5 points)
 * Good technical documentation
 */
function calculateTechnicalDetailsScore(context: PRContext, prDescription: string): number {
  const maxScore = SCORING_WEIGHTS.technicalDetails;
  let score = 0;
  
  // File changes documented (2 points)
  if (context.fileChanges.length > 0) {
    score += 2;
  }
  
  // Language/framework mentioned (1 point)
  if (context.language) {
    score += 1;
  }
  
  // Contributors mentioned (1 point)
  if (prDescription.includes('Contributors')) {
    score += 1;
  }
  
  // Overall length indicates detail (1 point)
  if (prDescription.length > 1000) {
    score += 1;
  }
  
  return Math.min(score, maxScore);
}

/**
 * Get score grade (A, B, C, D, F)
 */
export function getScoreGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get score emoji
 */
export function getScoreEmoji(score: number): string {
  if (score >= 90) return '🌟';
  if (score >= 80) return '✅';
  if (score >= 70) return '👍';
  if (score >= 60) return '⚠️';
  return '❌';
}

/**
 * Get score description
 */
export function getScoreDescription(score: number): string {
  if (score >= 90) return 'Excellent - Ready for review';
  if (score >= 80) return 'Good - Meets quality standards';
  if (score >= 70) return 'Acceptable - Minor improvements suggested';
  if (score >= 60) return 'Fair - Improvements needed';
  return 'Poor - Significant improvements required';
}

/**
 * Generate scoring breakdown for display
 */
export function getScoringBreakdown(
  context: PRContext,
  validation: ValidationResult,
  prDescription: string
): {
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
}[] {
  return [
    {
      category: 'Mandatory Sections',
      score: calculateMandatorySectionsScore(validation),
      maxScore: SCORING_WEIGHTS.mandatorySections,
      percentage: (calculateMandatorySectionsScore(validation) / SCORING_WEIGHTS.mandatorySections) * 100
    },
    {
      category: 'JIRA Context',
      score: calculateJiraContextScore(context),
      maxScore: SCORING_WEIGHTS.jiraContext,
      percentage: (calculateJiraContextScore(context) / SCORING_WEIGHTS.jiraContext) * 100
    },
    {
      category: 'Commit Quality',
      score: calculateCommitQualityScore(context),
      maxScore: SCORING_WEIGHTS.commitQuality,
      percentage: (calculateCommitQualityScore(context) / SCORING_WEIGHTS.commitQuality) * 100
    },
    {
      category: 'Test Coverage',
      score: calculateTestCoverageScore(context),
      maxScore: SCORING_WEIGHTS.testCoverage,
      percentage: (calculateTestCoverageScore(context) / SCORING_WEIGHTS.testCoverage) * 100
    },
    {
      category: 'Technical Details',
      score: calculateTechnicalDetailsScore(context, prDescription),
      maxScore: SCORING_WEIGHTS.technicalDetails,
      percentage: (calculateTechnicalDetailsScore(context, prDescription) / SCORING_WEIGHTS.technicalDetails) * 100
    }
  ];
}
