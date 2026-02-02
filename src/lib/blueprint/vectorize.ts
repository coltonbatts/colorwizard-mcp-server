/**
 * Vectorization: Contour Extraction and Path Simplification for Blueprint Mode
 */

export interface Point {
    x: number;
    y: number;
}

/**
 * Extracts the outer contour of a region using Marching Squares
 */
export function extractContour(width: number, height: number, regionPixelIndices: number[]): Point[] {
    const pixelSet = new Set(regionPixelIndices);
    if (pixelSet.size === 0) return [];

    // Find a starting point (top-leftmost pixel)
    let startIdx = -1;
    for (const idx of regionPixelIndices) {
        if (startIdx === -1 || idx < startIdx) startIdx = idx;
    }

    const startX = startIdx % width;
    const startY = Math.floor(startIdx / width);

    // Simple Moore Neighborhood tracing for outer contour
    const contour: Point[] = [];
    let currX = startX;
    let currY = startY;
    let prevX = startX - 1;
    let prevY = startY;

    const isInside = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height && pixelSet.has(y * width + x);

    // Initial move: if we start at top-left, we usually move right
    // Tracing strategy: always keep the region on the right
    const directions = [
        [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]
    ];

    let found = false;
    let iter = 0;
    const maxIter = width * height * 2;

    while (iter < maxIter) {
        contour.push({ x: currX, y: currY });

        // Find next neighbor clockwise
        let startDir = 0;
        for (let i = 0; i < 8; i++) {
            if (currX + directions[i][0] === prevX && currY + directions[i][1] === prevY) {
                startDir = (i + 1) % 8;
                break;
            }
        }

        let nextMove = -1;
        for (let i = 0; i < 8; i++) {
            const dirIdx = (startDir + i) % 8;
            const nx = currX + directions[dirIdx][0];
            const ny = currY + directions[dirIdx][1];
            if (isInside(nx, ny)) {
                nextMove = dirIdx;
                break;
            }
        }

        if (nextMove === -1) break; // Should not happen for connected regions

        const nx = currX + directions[nextMove][0];
        const ny = currY + directions[nextMove][1];

        if (nx === startX && ny === startY) break;

        prevX = currX;
        prevY = currY;
        currX = nx;
        currY = ny;
        iter++;
    }

    return contour;
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm for path simplification
 */
export function simplifyPath(points: Point[], epsilon: number): Point[] {
    if (points.length <= 2) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const d = perpendicularDistance(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > epsilon) {
        const res1 = simplifyPath(points.slice(0, index + 1), epsilon);
        const res2 = simplifyPath(points.slice(index), epsilon);
        return [...res1.slice(0, -1), ...res2];
    } else {
        return [points[0], points[end]];
    }
}

function perpendicularDistance(p: Point, p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (dx === 0 && dy === 0) return Math.sqrt(Math.pow(p.x - p1.x, 2) + Math.pow(p.y - p1.y, 2));

    const numerator = Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x);
    const denominator = Math.sqrt(Math.pow(dy, 2) + Math.pow(dx, 2));
    return numerator / denominator;
}
