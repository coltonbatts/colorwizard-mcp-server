/**
 * Connected-Components Labeling and Region Merging for Blueprint Mode
 */

export interface Region {
    id: number;
    clusterIndex: number;
    pixelIndices: number[];
    neighborRegions: Set<number>;
}

/**
 * Identifies connected components (regions) in the quantized image
 */
export function extractRegions(width: number, height: number, pixelClusterLabels: number[]): Region[] {
    const regionLabels = new Int32Array(width * height).fill(-1);
    let regionCount = 0;
    const regions: Region[] = [];

    const getPixel = (x: number, y: number) => pixelClusterLabels[y * width + x];
    const getRegion = (x: number, y: number) => regionLabels[y * width + x];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (getRegion(x, y) !== -1) continue;

            const clusterIdx = getPixel(x, y);
            const currentRegionId = regionCount++;
            const pixelIndices: number[] = [];
            const queue: [number, number][] = [[x, y]];

            regionLabels[y * width + x] = currentRegionId;

            while (queue.length > 0) {
                const [cx, cy] = queue.shift()!;
                pixelIndices.push(cy * width + cx);

                // 4-connectivity
                const neighbors: [number, number][] = [
                    [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
                ];

                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        if (getRegion(nx, ny) === -1 && getPixel(nx, ny) === clusterIdx) {
                            regionLabels[ny * width + nx] = currentRegionId;
                            queue.push([nx, ny]);
                        }
                    }
                }
            }

            regions.push({
                id: currentRegionId,
                clusterIndex: clusterIdx,
                pixelIndices,
                neighborRegions: new Set()
            });
        }
    }

    // Identify neighbors
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const r1 = getRegion(x, y);
            // Check right and bottom neighbors
            const checkNeighbors: [number, number][] = [[x + 1, y], [x, y + 1]];
            for (const [nx, ny] of checkNeighbors) {
                if (nx < width && ny < height) {
                    const r2 = getRegion(nx, ny);
                    if (r1 !== r2) {
                        regions[r1].neighborRegions.add(r2);
                        regions[r2].neighborRegions.add(r1);
                    }
                }
            }
        }
    }

    return regions;
}

/**
 * Merges regions smaller than minArea into the most frequent neighbor cluster
 */
export function mergeSmallRegions(
    width: number,
    height: number,
    regions: Region[],
    minArea: number,
    pixelClusterLabels: number[]
): { regions: Region[], updatedLabels: number[] } {
    let changed = true;
    const labels = [...pixelClusterLabels];

    while (changed) {
        changed = false;
        const smallRegionIndex = regions.findIndex(r => r.pixelIndices.length < minArea && r.pixelIndices.length > 0);

        if (smallRegionIndex !== -1) {
            const smallRegion = regions[smallRegionIndex];

            // Find neighbors' cluster indices
            const neighborClusters = new Map<number, number>();
            smallRegion.neighborRegions.forEach(neighborId => {
                const neighbor = regions[neighborId];
                if (neighbor.pixelIndices.length > 0) {
                    const count = neighborClusters.get(neighbor.clusterIndex) || 0;
                    neighborClusters.set(neighbor.clusterIndex, count + neighbor.pixelIndices.length);
                }
            });

            if (neighborClusters.size > 0) {
                // Find most frequent neighbor cluster
                let bestCluster = smallRegion.clusterIndex;
                let maxCount = -1;
                neighborClusters.forEach((count, clusterIdx) => {
                    if (count > maxCount) {
                        maxCount = count;
                        bestCluster = clusterIdx;
                    }
                });

                // Merge into first neighbor that has the bestCluster
                const targetRegionId = Array.from(smallRegion.neighborRegions).find(id => regions[id].clusterIndex === bestCluster);

                if (targetRegionId !== undefined) {
                    const targetRegion = regions[targetRegionId];
                    targetRegion.pixelIndices.push(...smallRegion.pixelIndices);

                    smallRegion.pixelIndices.forEach(idx => {
                        labels[idx] = bestCluster;
                    });

                    // Update neighbors
                    smallRegion.neighborRegions.forEach(neighborId => {
                        if (neighborId !== targetRegionId) {
                            regions[neighborId].neighborRegions.delete(smallRegion.id);
                            regions[neighborId].neighborRegions.add(targetRegionId);
                            targetRegion.neighborRegions.add(neighborId);
                        }
                    });

                    targetRegion.neighborRegions.delete(smallRegion.id);
                    smallRegion.pixelIndices = [];
                    changed = true;
                }
            }
        }
    }

    return {
        regions: regions.filter(r => r.pixelIndices.length > 0),
        updatedLabels: labels
    };
}
