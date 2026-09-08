import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  FamilyGraph,
  normalizeRelationship,
  sanitizeGraph,
} from '../components/family-graph.js';
import type { FamilyGraphResponse } from '../lib/api-contracts.js';

// Mock useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('FamilyGraph (M4-014: One-Hop Graph Visualization & Accessibility)', () => {
  const primaryId = 'c0000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeRelationship (Direction and Inversion)', () => {
    it('preserves relationship type when primary is source', () => {
      expect(
        normalizeRelationship(
          { id: '1', source: primaryId, target: 'other', relationshipType: 'PARENT' },
          primaryId
        )
      ).toBe('PARENT');

      expect(
        normalizeRelationship(
          { id: '2', source: primaryId, target: 'other', relationshipType: 'CHILD' },
          primaryId
        )
      ).toBe('CHILD');

      expect(
        normalizeRelationship(
          { id: '3', source: primaryId, target: 'other', relationshipType: 'SPOUSE' },
          primaryId
        )
      ).toBe('SPOUSE');

      expect(
        normalizeRelationship(
          { id: '4', source: primaryId, target: 'other', relationshipType: 'SIBLING' },
          primaryId
        )
      ).toBe('SIBLING');
    });

    it('inverts PARENT <-> CHILD when primary is target, preserving SPOUSE and SIBLING', () => {
      // Primary is target, source is PARENT -> inverts to CHILD
      expect(
        normalizeRelationship(
          { id: '1', source: 'other', target: primaryId, relationshipType: 'PARENT' },
          primaryId
        )
      ).toBe('CHILD');

      // Primary is target, source is CHILD -> inverts to PARENT
      expect(
        normalizeRelationship(
          { id: '2', source: 'other', target: primaryId, relationshipType: 'CHILD' },
          primaryId
        )
      ).toBe('PARENT');

      // SPOUSE remains unchanged
      expect(
        normalizeRelationship(
          { id: '3', source: 'other', target: primaryId, relationshipType: 'SPOUSE' },
          primaryId
        )
      ).toBe('SPOUSE');

      // SIBLING remains unchanged
      expect(
        normalizeRelationship(
          { id: '4', source: 'other', target: primaryId, relationshipType: 'SIBLING' },
          primaryId
        )
      ).toBe('SIBLING');
    });
  });

  describe('sanitizeGraph (Deduplication and Dangling Edge Safety)', () => {
    it('deduplicates duplicate nodes and edges, and filters out dangling edges', () => {
      const rawData: FamilyGraphResponse = {
        nodes: [
          { id: primaryId, label: 'Somchai Prasert', type: 'PRIMARY' },
          { id: primaryId, label: 'Somchai Prasert (Duplicate)', type: 'PRIMARY' },
          { id: 'rel-1', label: 'Suda Prasert', type: 'RELATED' },
          { id: 'rel-1', label: 'Suda Prasert (Duplicate)', type: 'RELATED' },
        ],
        edges: [
          { id: 'e1', source: primaryId, target: 'rel-1', relationshipType: 'SPOUSE' },
          { id: 'e1', source: primaryId, target: 'rel-1', relationshipType: 'SPOUSE' }, // Duplicate edge
          { id: 'e-dangling', source: primaryId, target: 'ghost-client', relationshipType: 'CHILD' }, // Dangling
          { id: 'e-self', source: primaryId, target: primaryId, relationshipType: 'SIBLING' }, // Self loop
        ],
      };

      const result = sanitizeGraph(rawData, primaryId);

      expect(result.primaryNode.id).toBe(primaryId);
      expect(result.relatedNodes).toHaveLength(1);
      expect(result.relatedNodes[0]?.id).toBe('rel-1');

      // Only e1 survives; e-dangling and e-self are excluded
      expect(result.validEdges).toHaveLength(1);
      expect(result.validEdges[0]?.id).toBe('e1');
    });
  });

  describe('Component Rendering & Interactive Features', () => {
    const completeGraphData: FamilyGraphResponse = {
      nodes: [
        { id: primaryId, label: 'Somchai Prasert', type: 'PRIMARY' },
        { id: 'rel-spouse', label: 'Malee Prasert', type: 'RELATED' },
        { id: 'rel-child', label: 'Somying Prasert', type: 'RELATED' },
        { id: 'rel-parent', label: 'Boonmee Prasert', type: 'RELATED' },
      ],
      edges: [
        { id: 'e-sp', source: primaryId, target: 'rel-spouse', relationshipType: 'SPOUSE' },
        { id: 'e-ch', source: primaryId, target: 'rel-child', relationshipType: 'PARENT' },
        { id: 'e-pa', source: 'rel-parent', target: primaryId, relationshipType: 'PARENT' },
      ],
    };

    it('renders SVG graphic with accessible labels, center primary node, and surrounding nodes', () => {
      render(<FamilyGraph data={completeGraphData} primaryClientId={primaryId} />);

      const svg = screen.getByTestId('family-svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('role', 'img');
      expect(svg).toHaveAttribute(
        'aria-label',
        'Family relationship graph for Somchai Prasert'
      );

      // Primary node in SVG
      expect(screen.getByTestId(`svg-node-${primaryId}`)).toBeInTheDocument();

      // Related nodes in SVG
      expect(screen.getByTestId('svg-node-rel-spouse')).toBeInTheDocument();
      expect(screen.getByTestId('svg-node-rel-child')).toBeInTheDocument();
      expect(screen.getByTestId('svg-node-rel-parent')).toBeInTheDocument();

      // Edges rendered in SVG
      expect(screen.getByTestId('svg-edge-e-sp')).toBeInTheDocument();
      expect(screen.getByTestId('svg-edge-e-ch')).toBeInTheDocument();
      expect(screen.getByTestId('svg-edge-e-pa')).toBeInTheDocument();
    });

    it('renders accessible HTML list with correct relationships and profile links', () => {
      render(<FamilyGraph data={completeGraphData} primaryClientId={primaryId} />);

      expect(screen.getByTestId('accessible-family-list')).toBeInTheDocument();
      expect(screen.getByText('Relationship List (3)')).toBeInTheDocument();

      // Link to spouse
      const spouseLink = screen.getByTestId('relative-link-rel-spouse');
      expect(spouseLink).toHaveTextContent('Malee Prasert');
      expect(spouseLink).toHaveAttribute('href', '/clients/rel-spouse');
      expect(screen.getByTestId('relationship-badge-e-sp')).toHaveTextContent('SPOUSE');

      // Primary is source with PARENT -> PARENT
      expect(screen.getByTestId('relationship-badge-e-ch')).toHaveTextContent('PARENT');

      // Primary is target with PARENT -> inverts to CHILD
      expect(screen.getByTestId('relationship-badge-e-pa')).toHaveTextContent('CHILD');
    });

    it('supports keyboard navigation on SVG nodes (Enter/Space opens profile)', () => {
      render(<FamilyGraph data={completeGraphData} primaryClientId={primaryId} />);

      const relatedNode = screen.getByTestId('svg-node-rel-child');

      // Press Enter
      fireEvent.keyDown(relatedNode, { key: 'Enter' });
      expect(mockPush).toHaveBeenCalledWith('/clients/rel-child');

      // Click node
      fireEvent.click(relatedNode);
      expect(mockPush).toHaveBeenCalledWith('/clients/rel-child');
    });

    it('handles primary-only data gracefully without errors', () => {
      const primaryOnlyData: FamilyGraphResponse = {
        nodes: [{ id: primaryId, label: 'Solo Client', type: 'PRIMARY' }],
        edges: [],
      };

      render(<FamilyGraph data={primaryOnlyData} primaryClientId={primaryId} />);

      expect(screen.getByTestId('family-svg')).toBeInTheDocument();
      expect(screen.getByTestId(`svg-node-${primaryId}`)).toBeInTheDocument();
      expect(screen.getByText('Relationship List (0)')).toBeInTheDocument();
    });
  });
});
