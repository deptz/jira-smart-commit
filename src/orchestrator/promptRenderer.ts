export type PromptRenderContext = Record<string, string | undefined>;

/**
 * Render template placeholders used by the existing prompt templates.
 * Unknown placeholders are left untouched to preserve backward compatibility.
 */
export function renderPromptTemplate(template: string, context: PromptRenderContext): string {
  let rendered = template;

  for (const [key, value] of Object.entries(context)) {
    const placeholder = `{{${key}}}`;
    const safeValue = value ?? '';
    rendered = rendered.split(placeholder).join(safeValue);
  }

  return rendered;
}
