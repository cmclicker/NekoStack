import React, { useState, useEffect } from 'react';
import { Theme } from '@nekostack/theme'; // Assumes theme context hook exists
import { aggregateHistoricalEvents } from '../../../../utils/ArticleService'; // Assuming path to ArticleService

/**
 * @typedef {object} ReleaseEvent
 * @property {string} id - Unique identifier.
 * @property {string} tag - Version tag.
 * @property {Date|string} date - Date of the release/milestone.
 * @property {string} packageName - Package owning the event.
 * @property {string} summary - User-facing description.
 * @property {'release' | 'milestone'} type - Event category.
 */

interface ReleaseTimelineProps {}

/**
 * A universal component to display structured historical data (Dev Blog/Release History).
 * It consumes the canonical, pre-parsed event list from ArticleService.
 */
export const ReleaseTimeline: React.FC<ReleaseTimelineProps> = () => {
    const [events, setEvents] = useState<ReleaseEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Consume the dedicated service layer to get normalized data
                const aggregatedEvents = await aggregateHistoricalEvents(['docs/STATUS.md', 'docs/REPO_AUDIT.md']);
                setEvents(aggregatedEvents);
            } catch (error) {
                console.error("Failed to load release history:", error);
                // Display an informative fallback message if data loading fails
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) {
        return <div className="p-6 text-center">Loading historical records...</div>;
    }

    if (events.length === 0) {
        return <div className="p-6 border rounded bg-yellow/5 backdrop-filter">No release history found for this project yet.</div>;
    }

    // --- Component Logic: Separation by Type ---
    const packageReleases = events.filter(e => e.type === 'release');
    const developmentMilestones = events.filter(e => e.type === 'milestone');

    return (
        <div className="container mx-auto py-12">
            <h2 className="text-4xl font-bold mb-8 text-brand-primary">Project Evolution & Release History</h2>
            <p className="mb-10 max-w-3xl text-muted-foreground">
                A comprehensive log of all major milestones and package releases, providing deep context on the journey from concept to v1.0+.
            </p>

            {/* 1. PACKAGE RELEASE TIMELINE (Primary Focus) */}
            <section className="mb-20 border p-8 rounded-xl bg-surface shadow-lg">
                <h3 className="text-3xl font-semibold mb-6 text-brand-primary">📦 Package Release Milestones</h3>
                <div className="space-y-10 relative before:content-[''] before:absolute before:top-4 before:left-[2rem] before:w-px before:bg-border before:-translate-x-full before:after:all
                                   before:after:content-[''] before:after:absolute before:bottom-0 before:left-0 before:w-full before:h-px before:bg-border">
                    {packageReleases.map((event) => (
                        <div key={event.id} className="relative pl-[2rem]">
                            <span className="absolute top-1 text-sm font-bold text-center left-[-0.75rem] transform -translate-y-1/2 bg-brand-primary text-white px-3 py-1 rounded-full">{event.tag}</span>
                            <h4 className="text-xl font-bold mb-1 flex items-center">
                                {event.packageName} <span className="ml-3 text-sm text-muted-foreground/70">({event.type === 'release' ? 'Release' : 'Milestone'})</span>
                            </h4>
                            <p className={`text-lg font-mono mb-2 inline-block px-2 py-1 rounded ${Theme.isDark('dark') ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                                {new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p className="text-base mt-1">{event.summary}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 2. DEVELOPMENT MILESTONES (Context/Process) */}
            <section className="border p-8 rounded-xl bg-surface shadow-lg">
                <h3 className="text-3xl font-semibold mb-6 text-brand-secondary">⚙️ Development & Governance Milestones</h3>
                <div className="space-y-6">
                    {developmentMilestones.map((event) => (
                        <article key={event.id} className="border-l-4 border-sky/50 pl-4 py-2 bg-blue-50/50 rounded-sm">
                            <h4 className={`text-xl font-bold mb-1 text-sky-700`}>✨ {event.packageName}: Process Milestone</h4>
                            <p className="flex items-center space-x-3 text-md text-gray-600">
                                <time dateTime={new Date(event.date).toISOString()}>{new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                            </p>
                            <p className="mt-2 text-base">{event.summary}</p>
                        </article>
                    ))}
                </div>
            </section>

        </div>
    );
};