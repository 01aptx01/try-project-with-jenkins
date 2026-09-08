'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  FamilyEdge,
  FamilyGraphResponse,
  FamilyNode,
  RelationshipType,
} from '../lib/api-contracts.js';
import styles from './family-graph.module.css';

export interface FamilyGraphProps {
  data: FamilyGraphResponse;
  primaryClientId: string;
}

/**
 * Normalizes relationship type from primary client's perspective:
 * - If edge source is primary -> relationshipType applies directly.
 * - If edge target is primary -> inverts PARENT <-> CHILD, keeps SPOUSE/SIBLING unchanged.
 */
export function normalizeRelationship(
  edge: FamilyEdge,
  primaryClientId: string
): RelationshipType {
  if (edge.source === primaryClientId) {
    return edge.relationshipType;
  }
  if (edge.target === primaryClientId) {
    if (edge.relationshipType === 'PARENT') return 'CHILD';
    if (edge.relationshipType === 'CHILD') return 'PARENT';
    return edge.relationshipType;
  }
  return edge.relationshipType;
}

/**
 * Sanitizes graph data by deduplicating nodes/edges and discarding dangling edges.
 */
export function sanitizeGraph(
  data: FamilyGraphResponse,
  primaryClientId: string
): {
  primaryNode: FamilyNode;
  relatedNodes: FamilyNode[];
  validEdges: Array<FamilyEdge & { normalizedType: RelationshipType; relativeId: string }>;
} {
  // 1. Deduplicate nodes by ID
  const nodeMap = new Map<string, FamilyNode>();
  for (const node of data.nodes || []) {
    if (node && node.id && !nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    }
  }

  // 2. Locate or synthesize primary node
  let primaryNode = nodeMap.get(primaryClientId);
  if (!primaryNode) {
    primaryNode = Array.from(nodeMap.values()).find((n) => n.type === 'PRIMARY') || {
      id: primaryClientId,
      label: 'Primary Client',
      type: 'PRIMARY',
    };
    nodeMap.set(primaryNode.id, primaryNode);
  }

  // 3. Extract related nodes
  const relatedNodes = Array.from(nodeMap.values()).filter(
    (n) => n.id !== primaryNode.id && n.type === 'RELATED'
  );

  // 4. Deduplicate and filter edges
  const seenEdgeIds = new Set<string>();
  const validEdges: Array<
    FamilyEdge & { normalizedType: RelationshipType; relativeId: string }
  > = [];

  for (const edge of data.edges || []) {
    if (!edge || !edge.id || seenEdgeIds.has(edge.id)) continue;
    seenEdgeIds.add(edge.id);

    // Filter dangling edges: both source and target must exist in nodeMap
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;

    // Filter self-referential edges
    if (edge.source === edge.target) continue;

    // Ensure edge touches primary client
    const isPrimarySource = edge.source === primaryNode.id;
    const isPrimaryTarget = edge.target === primaryNode.id;
    if (!isPrimarySource && !isPrimaryTarget) continue;

    const relativeId = isPrimarySource ? edge.target : edge.source;
    const normalizedType = normalizeRelationship(edge, primaryNode.id);

    validEdges.push({
      ...edge,
      normalizedType,
      relativeId,
    });
  }

  return { primaryNode, relatedNodes, validEdges };
}

export function FamilyGraph({ data, primaryClientId }: FamilyGraphProps) {
  const router = useRouter();

  const { primaryNode, relatedNodes, validEdges } = useMemo(
    () => sanitizeGraph(data, primaryClientId),
    [data, primaryClientId]
  );

  // SVG dimensions and layout geometry
  const width = 500;
  const height = 340;
  const centerX = width / 2;
  const centerY = height / 2;
  const orbitRadius = 120;

  // Calculate layout coordinates for nodes
  const layoutNodes = useMemo(() => {
    const coords = new Map<string, { x: number; y: number }>();
    coords.set(primaryNode.id, { x: centerX, y: centerY });

    const totalRelated = relatedNodes.length;
    relatedNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / totalRelated - Math.PI / 2;
      const x = centerX + orbitRadius * Math.cos(angle);
      const y = centerY + orbitRadius * Math.sin(angle);
      coords.set(node.id, { x, y });
    });

    return coords;
  }, [primaryNode.id, relatedNodes, centerX, centerY]);

  const handleNodeClick = (nodeId: string) => {
    if (nodeId !== primaryNode.id) {
      router.push(`/clients/${nodeId}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nodeId: string) => {
    if ((e.key === 'Enter' || e.key === ' ') && nodeId !== primaryNode.id) {
      e.preventDefault();
      router.push(`/clients/${nodeId}`);
    }
  };

  return (
    <div className={styles.graphContainer} data-testid="family-graph-container">
      {/* SVG Visualization */}
      <div className={styles.svgWrapper} data-testid="family-svg-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.graphSvg}
          role="img"
          aria-label={`Family relationship graph for ${primaryNode.label}`}
          data-testid="family-svg"
        >
          <desc>
            {`Interactive 1-hop family relationship diagram showing ${primaryNode.label} and ${relatedNodes.length} direct relatives.`}
          </desc>

          {/* Render edges */}
          {validEdges.map((edge) => {
            const sourcePos = layoutNodes.get(edge.source) || { x: centerX, y: centerY };
            const targetPos = layoutNodes.get(edge.target) || { x: centerX, y: centerY };
            const midX = (sourcePos.x + targetPos.x) / 2;
            const midY = (sourcePos.y + targetPos.y) / 2;

            return (
              <g key={`svg-edge-${edge.id}`} data-testid={`svg-edge-${edge.id}`}>
                <line
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  className={styles.edgeLine}
                />
                <rect
                  x={midX - 24}
                  y={midY - 8}
                  width={48}
                  height={16}
                  rx={4}
                  fill="var(--bg-surface)"
                  stroke="var(--border-color)"
                  strokeWidth={1}
                />
                <text x={midX} y={midY + 4} className={styles.edgeLabel}>
                  {edge.normalizedType}
                </text>
              </g>
            );
          })}

          {/* Render related nodes */}
          {relatedNodes.map((node) => {
            const pos = layoutNodes.get(node.id) || { x: centerX, y: centerY };
            const truncatedLabel =
              node.label.length > 14 ? `${node.label.slice(0, 12)}…` : node.label;

            return (
              <g
                key={`svg-node-${node.id}`}
                tabIndex={0}
                role="button"
                aria-label={`Relative: ${node.label}, click to view profile`}
                data-testid={`svg-node-${node.id}`}
                onClick={() => handleNodeClick(node.id)}
                onKeyDown={(e) => handleKeyDown(e, node.id)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={26}
                  className={styles.relatedNodeCircle}
                />
                <text x={pos.x} y={pos.y - 2} className={styles.nodeTextPrimary}>
                  {truncatedLabel}
                </text>
                <text x={pos.x} y={pos.y + 11} className={styles.nodeTextSecondary}>
                  RELATED
                </text>
              </g>
            );
          })}

          {/* Render center primary node */}
          <g
            tabIndex={0}
            role="region"
            aria-label={`Primary client: ${primaryNode.label}`}
            data-testid={`svg-node-${primaryNode.id}`}
          >
            <circle
              cx={centerX}
              cy={centerY}
              r={34}
              className={styles.primaryNodeCircle}
            />
            <text
              x={centerX}
              y={centerY - 2}
              className={styles.nodeTextPrimary}
              style={{ fill: 'var(--primary-contrast)' }}
            >
              {primaryNode.label.length > 12
                ? `${primaryNode.label.slice(0, 10)}…`
                : primaryNode.label}
            </text>
            <text
              x={centerX}
              y={centerY + 12}
              className={styles.nodeTextSecondary}
              style={{ fill: 'rgba(255, 255, 255, 0.85)' }}
            >
              PRIMARY
            </text>
          </g>
        </svg>
      </div>

      {/* Accessible HTML Relationship List */}
      <div data-testid="accessible-family-list">
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: '0.75rem',
            color: 'var(--text-primary)',
          }}
        >
          Relationship List ({validEdges.length})
        </h3>

        <ul className={styles.relationshipList} data-testid="family-member-list">
          {validEdges.map((edge) => {
            const relativeNode = relatedNodes.find((n) => n.id === edge.relativeId);
            const relativeName = relativeNode ? relativeNode.label : edge.relativeId;

            return (
              <li
                key={`list-edge-${edge.id}`}
                className={styles.relationshipItem}
                data-testid={`family-edge-${edge.id}`}
              >
                <div>
                  <Link
                    href={`/clients/${edge.relativeId}`}
                    data-testid={`relative-link-${edge.relativeId}`}
                    style={{
                      fontWeight: 600,
                      color: 'var(--primary)',
                      textDecoration: 'none',
                      fontSize: '0.9375rem',
                    }}
                  >
                    {relativeName}
                  </Link>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.125rem',
                    }}
                  >
                    Client ID: {edge.relativeId}
                  </div>
                </div>

                <span
                  data-testid={`relationship-badge-${edge.id}`}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.5rem',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {edge.normalizedType}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
