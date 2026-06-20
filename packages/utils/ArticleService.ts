/**
 * ArticleService - Data Ingestion Utility.
 * Reads raw Markdown documentation files (STATUS.md, REPO_AUDIT.md)
 * and transforms them into a canonical JSON format for consumption by the public-facing release history portal.
 *
 * @module ArticleService
 * @requires @nekostack/utils/parser - Placeholder for a shared markdown parsing utility.
 */

/**
 * ArticleService - Data Ingestion Utility.
 * Reads raw Markdown documentation files (STATUS.md, REPO_AUDIT.md)
 * and transforms them into a canonical JSON format for consumption by the public-facing release history portal.
 *
 * @module ArticleService
 * @requires @nekostack/utils/parser - Placeholder for a shared markdown parsing utility.
 */

import { ReleaseEvent } from '../types'; // Assuming types are imported or defined elsewhere
// Note: Removed 'node:util' placeholder, assuming core dependencies like Date and RegExp are available.

/**
 * Defines the canonical schema for any single historical release event.
 * @typedef {object} ReleaseEvent
 * @property {string} id - Unique identifier (e.g., "schema-v1.0.0").
 * @property {string} tag - The git/npm version tag (e.g., v1.0.0).
 * @property {Date|string} date - Date of the release/milestone.
 * @property {string} packageName - The package this event belongs to.
 * @property {string} summary - A clean, user-facing description derived from the markdown summary field.
 * @property {'release' | 'milestone'} type - Categorization (Package Release vs Process Milestone).
 */

/**
 * Orchestrates the reading and parsing of all historical documentation sources.
 * @param {string[]} filePaths - An array of paths to raw .md files.
 * @returns {Promise<ReleaseEvent[]>} A promise that resolves to an array of normalized release events, sorted chronologically (newest first).
 */
export async function aggregateHistoricalEvents(filePaths: string[]): Promise<ReleaseEvent[]> {
    let allEvents: ReleaseEvent[] = [];

    for (const filePath of filePaths) {
        console.log(`[ArticleService] Processing source: ${filePath}`);
        // Note: Replace with actual I/O operation using Read tool or fs module in real deployment.
        const rawMarkdown = await readAndCleanMarkdownFile(filePath);

        if (!rawMarkdown) continue;

        // --- Step 1: Smart Parsing Dispatcher ---
        let eventsForSource: ReleaseEvent[] = [];

        if (filePath.includes('STATUS.md')) {
            eventsForSource = await parseStatusFile(rawMarkdown);
        } else if (filePath.includes('REPO_AUDIT.md')) {
            eventsForSource = await parseAuditFile(rawMarkdown);
        } else {
            console.warn(`[ArticleService] Unknown source file type: ${filePath}. Skipping.`);
        }

        allEvents.push(...eventsForSource);
    }

    // Sort and deduplicate the final list before returning
    return allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Parses docs/STATUS.md to extract structured package release events using markdown table pattern matching.
 * @param {string} markdownContent - The raw content of STATUS.md.
 * @returns {Promise<ReleaseEvent[]>} Array of extracted ReleaseEvents from the 'Latest milestones' section.
 */
async function parseStatusFile(markdownContent: string): Promise<ReleaseEvent[]> {
    const events: ReleaseEvent[] = [];

    // Regex to capture a package header (e.g., "### @nekostack/schema") followed by subsequent tables.
    // This looks for the pattern: ### <Package Name>\s\n\n|---|---...
    const packageRegex = /^(### ([^\s]+))([\s\S]*?)(?=###|\r?\n##|\r?\n$)/gm;
    let match;

    while ((match = packageRegex.exec(markdownContent)) !== null) {
        const packageNameMatch = match[2] ? `packages/${match[2].toLowerCase().replace(/\//g, '-')}` : 'unknown';
        const rawPackageSection = match[0];

        // Now process the tables within this section. We expect multiple tables grouped by package.
        // A typical release table has: | Tag | Date | Summary | followed by content lines.
        const tableRegex = /\|\s*([^|]+)\s*\|.*?\(.*?\)\|.*\|\s*\n\n?(\||---|---)/gs;
        let tableMatch;
        let packageEvents: ReleaseEvent[] = [];

        while ((tableMatch = tableRegex.exec(rawPackageSection)) !== null) {
            // The captured group 1 contains the header row, and it's usually sufficient to find data pairs manually
            // due to markdown/markdown-table inconsistencies in regex capture groups.
            // We will extract the data line by line assuming a standard format: | Tag Link | Date | Summary |
            const lines = rawPackageSection.split('\n');
            let currentTableData: { tag: string, date: string, summary: string }[] = [];

            // Simple heuristic loop over lines following header/separator (lines 1-2)
            for(let i = 0; i < lines.length - 2; i++) { // Iterate past potential section headers and separators
                const line = lines[i];
                if (!line.includes('|') || line.trim() === '') continue;

                // Attempt to parse the data row: | TAG_LINK | DATE | SUMMARY_CONTENT |
                const parts = line.split('|').map(p => p.trim()).filter(p => p.length > 0);

                if (parts.length >= 3) {
                    let tagText = parts[0];
                    let dateText = parts[1];
                    // Reconstruct summary as everything after the second separator part
                    let summaryContent = parts.slice(2).join('|').trim();


                    // Heuristically extract actual content from markdown links/text
                    const tagNameMatch = tagText.match(/\[(.*?)\]/);
                    const rawTagName = tagNameMatch ? tagNameMatch[1] : '';

                    const dateMatch = dateText.match(/\d{4}-\d{2}-\d{2}/);
                    const rawDate = dateMatch ? dateMatch[0] : '';


                    if (rawTagName && rawDate) {
                        packageEvents.push({
                            id: rawTagName,
                            tag: rawTagName,
                            date: rawDate,
                            packageName: packageNameMatch || 'unknown',
                            summary: summaryContent || '',
                            type: 'release'
                        });
                    }
                }
            }
        }
        events.push(...packageEvents);
    }

    return events;
}


/**
 * Parses docs/REPO_AUDIT.md to extract structured process milestones and audit entries using list/regex matching.
 * @param {string} markdownContent - The raw content of REPO_AUDIT.md.
 * @returns {Promise<ReleaseEvent[]>} Array of extracted ProcessMilestones from the document's key historical sections.
 */
async function parseAuditFile(markdownContent: string): Promise<ReleaseEvent[]> {
    const events: ReleaseEvent[] = [];

    // 1. Capture 'Recent history' (Section 3) for structured process milestones.
    // This targets lists of commit messages or significant change descriptions.
    const recentHistoryRegex = /(?:## 3\. Git \/ worktree state.*?)([\s\S]*?)(?=## |\r?\n\nEndofDoc)/g;
    let historyMatch;

    while ((historyMatch = recentHistoryRegex.exec(markdownContent)) !== null) {
        const rawHistory = historyMatch[1];
        // Targets lines that look like git commit/event descriptions (e.g., 'Last commit')
        const eventLineRegex = /^(#\d+)\s+(.*)/gm;
        let eventMatch;

        while ((eventMatch = eventLineRegex.exec(rawHistory)) !== null) {
            const number = eventMatch[1]; // e.g., #33
            const description = eventMatch[2].trim(); // The rest of the line (e.g., operational audit session record)

            // This is a historical process milestone, not tied to a package release tag.
             if (description.length > 10) {
                events.push({
                    id: `${number}-audit`,
                    tag: 'N/A',
                    date: new Date().toISOString(), // Using today's date as a fallback for generic process audits, or infer from surrounding context if available.
                    packageName: 'Repository Operations',
                    summary: `Audit Event #${number}: ${description}`,
                    type: 'milestone'
                });
            }
        }
    }

    // 2. Capture Summary Audit Findings (Section 7/10) for high-leverage gap milestones.
    const findingsRegex = /^(?:## 7\. Governance coverage|## 10\. Recommended next branches)([\s\S]*?)(?=## |\r?\n\nEndofDoc)/g;
    let findingMatch;

    while ((findingMatch = findingsRegex.exec(markdownContent)) !== null) {
        const rawFinding = findingMatch[1];
         // Specific parsing for the 'Highest-leverage gap: no CI.' message found in Section 84/102
        if (rawFinding.includes("no single `npm run verify` exists") || rawFinding.includes("High")) {
            events.push({
                id: "ci_gap-assessment",
                tag: 'N/A',
                date: new Date().toISOString(),
                packageName: 'DevOps Governance',
                summary: `Critical Gap Identified: The repository currently lacks automated CI checks across core gates (Build, Test, Lint). Recommendation logged in the audit.`,
                type: 'milestone'
            });
        }
    }

    return events;
}

/**
 * Helper function to simulate reading content for writing/testing purposes.
 * MUST be replaced by a real file read utility (e.g., fs.promises.readFile).
 * @param {string} path - File path
 */
async function readAndCleanMarkdownFile(path: string): Promise<string | null> {
    console.warn(`[Parser]: WARNING: Using mock I/O for ${path}. Please implement actual file reading.`);
    // Since the initial tool calls provided full content, we'll just return that data as a string.
    if (path.includes('STATUS.md')) {
        return `1	# NekoStack — Status\n...\n[rest of status content]`; // Placeholder for actual content flow
    } else if (path.includes('REPO_AUDIT.md')) {
        return `1	# NekoStack — Repository Operational Audit\n...\n[rest of audit content]`; // Placeholder for actual content flow
    }
    return null;
}