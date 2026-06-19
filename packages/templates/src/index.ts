import fs from 'node:fs';
import path from 'node:path';

export interface TemplateOptions {
  sourceDir: string;
  destDir: string;
  variables: Record<string, string>;
}

/**
 * Recursively copies a directory and interpolates variables in files.
 */
export async function applyTemplate(options: TemplateOptions): Promise<void> {
  const { sourceDir, destDir, variables } = options;

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await applyTemplate({
        sourceDir: srcPath,
        destDir: destPath,
        variables
      });
    } else {
      let content = fs.readFileSync(srcPath, 'utf8');

      // Interpolate variables
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(placeholder, value);
      }

      fs.writeFileSync(destPath, content);
    }
  }
}
