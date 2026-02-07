export interface TemplateValidationResult {
  unknownPlaceholders: string[];
}

export function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{\{[A-Z0-9_]+\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

export function validateTemplatePlaceholders(template: string, allowed: string[]): TemplateValidationResult {
  const allowedSet = new Set(allowed);
  const placeholders = extractPlaceholders(template);
  const unknownPlaceholders = placeholders.filter((key) => !allowedSet.has(key));
  return { unknownPlaceholders };
}
