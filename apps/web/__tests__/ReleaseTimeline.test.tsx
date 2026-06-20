import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ReleaseTimeline from '@/components/ReleaseTimeline'; // Assuming this path is correct
import * as ArticleService from '@/services/ArticleService'; // Mocking the service

// 1. Setup Mocks
jest.mock('@/services/ArticleService', () => ({
  __esModule: true,
  default: {
    fetchData: jest.fn(),
    // Add other methods here if necessary
  },
}));

// Helper constants for mock data
const mockLoadingState = Promise.resolve([]); // Simulating loading by resolving quickly in tests where data fetching is mocked later
const mockArticles = [
  { id: 'a1', type: 'release', title: 'Feature X Release', date: '2026-07-01', details: 'Major release notes.' },
  { id: 'a2', type: 'milestone', title: 'Q3 Planning Milestone', date: '2026-06-15', details: 'Mid-cycle review scheduled.' },
];

// ============================================
// Test Suite: ReleaseTimeline component
// ============================================

describe('ReleaseTimeline', () => {

  // Reset mocks before each test to ensure isolation
  beforeEach(() => {
    (ArticleService.default.fetchData).mockClear();
  });

  it('should display a loading state when data is being fetched', async () => {
    // Arrange: Mock the service call to return pending promise
    ArticleService.default.fetchData.mockResolvedValue(null); // Use null or an indicator that fetching started

    // Act: Render the component, which triggers data fetching
    render(<ReleaseTimeline />);

    // Assert 1: Check for a specific loading indicator element
    expect(screen.getByText(/Loading timeline.../i)).toBeInTheDocument();

    // Wait briefly to ensure initial rendering cycle is processed (optional, but good practice)
    await waitFor(() => {
      // We wait until the loading text *disappears* or content appears based on mock resolution
      expect(screen.queryByText(/Loading timeline.../i)).not.toBeInTheDocument();
    });

    // Since we mocked null, if the component handles this by showing nothing else,
    // we just ensure it doesn't crash and waits for the next test to override the mock.
  });

  it('should display an empty state message when no data is available', async () => {
    // Arrange: Mock service call returning an empty array
    ArticleService.default.fetchData.mockResolvedValue([]);

    // Act: Render the component and wait for potential side effects of fetching
    render(<ReleaseTimeline />);

    // Assert 1: Wait for data to resolve
    await waitFor(() => {
      expect(screen.getByText(/No recent releases or milestones found./i)).toBeInTheDocument();
    });
  });

  it('should display mixed content (releases and milestones) in success state', async () => {
    // Arrange: Mock service call with valid mixed data
    ArticleService.default.fetchData.mockResolvedValue(mockArticles);

    // Act: Render the component
    render(<ReleaseTimeline />);

    await waitFor(() => {
      // Assert 1: Check for the existence of all items
      expect(screen.getByText(/Feature X Release/i)).toBeInTheDocument();
      expect(screen.getByText(/Q3 Planning Milestone/i)).toBeInTheDocument();

      // Assert 2: Basic check for expected structure (e.g., a container element)
      const timelineContainer = screen.queryByRole('section', { name: /Timeline Content/i });
      expect(timelineContainer).toBeInTheDocument();
    });
  });

  it('should gracefully handle only releases data (no milestones)', async () => {
    // Arrange: Only mock release data
    const mockReleasesOnly = [{ id: 'r1', type: 'release', title: 'Beta Release 2.0', date: '2026-08-01', details: 'Stable beta features.' }];
    ArticleService.default.fetchData.mockResolvedValue(mockReleasesOnly);

    // Act: Render the component
    render(<ReleaseTimeline />);

    await waitFor(() => {
      // Assert 1: Check for release specific content
      expect(screen.getByText(/Beta Release 2\.0/i)).toBeInTheDocument();
      // Assert 2: Ensure milestone indicators are NOT present (or handle it gracefully)
      expect(screen.queryByText(/Milestone/i)).not.toBeInTheDocument();
    });
  });

  it('should gracefully handle only milestones data (no releases)', async () => {
    // Arrange: Only mock milestone data
    const mockMilestonesOnly = [{ id: 'm1', type: 'milestone', title: 'Project Alpha Definition', date: '2026-05-01', details: 'Kickoff meeting complete.' }];
    ArticleService.default.fetchData.mockResolvedValue(mockMilestonesOnly);

    // Act: Render the component
    render(<ReleaseTimeline />);

    await waitFor(() => {
      // Assert 1: Check for milestone specific content
      expect(screen.getByText(/Project Alpha Definition/i)).toBeInTheDocument();
      // Assert 2: Ensure release indicators are NOT present
      expect(screen.queryByText(/Release/i)).not.toBeInTheDocument();
    });
  });

  it('should handle partial datasets and render correct content based on filtered data', async () => {
    // Arrange: Simulate a scenario where data arrives with missing fields or bad types (partial)
    const mockPartialData = [
        { id: 'p1', type: 'release', title: 'Valid Release', date: '2026-09-01', details: 'Good data.' },
        // This item is intentionally missing the `title` field to test robustness
        { id: 'p2', type: 'milestone', date: '2026-08-01' },
    ];
    ArticleService.default.fetchData.mockResolvedValue(mockPartialData);

    // Act: Render the component
    render(<ReleaseTimeline />);

    await waitFor(() => {
      // Assert 1: Ensure the valid item is displayed (tests success path)
      expect(screen.getByText(/Valid Release/i)).toBeInTheDocument();

      // Assert 2: Check if the intentionally malformed record doesn't crash and renders a placeholder or nothing
      // We check for text that confirms *some* attempt was made but specifically avoid finding titles, assuming robust rendering handles missing props.
    });
  });

  // Optional clean up test (if required by project spec)
  it('should handle service failure gracefully', async () => {
    // Arrange: Mock service call to throw an error
    const mockError = new Error('Network Failure');
    ArticleService.default.fetchData.mockRejectedValue(mockError);

    // Act: Render the component
    render(<ReleaseTimeline />);

    await waitFor(() => {
      // Assert 1: Check for a specific error boundary message
      expect(screen.getByText(/Failed to load release timeline. Please try again./i)).toBeInTheDocument();
    });
  });
});