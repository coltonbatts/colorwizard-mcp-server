/**
 * Spectral Engine for ColorWizard
 * Perceptual color distance calculation using CIEDE2000
 */

/**
 * DMC Thread representation with RGB values and optional spectral signature
 */
export type DMCThread = {
    id: string;
    name: string;
    r: number;
    g: number;
    b: number;
    spectral_signature?: number[];
};

/**
 * RGB color tuple
 */
type RGB = {
    r: number;
    g: number;
    b: number;
};

/**
 * CIE LAB color space coordinates
 */
type LAB = {
    l: number; // Luminance (lightness)
    a: number; // Green-red opponent channel
    b: number; // Blue-yellow opponent channel
};

/**
 * CIE LCH color space coordinates (polar representation of LAB)
 */
type LCH = {
    l: number; // Luminance
    c: number; // Chroma (saturation)
    h: number; // Hue angle (degrees)
};

/**
 * Match result containing a DMC thread and its perceptual distance
 */
export type MatchResult = {
    thread: DMCThread;
    deltaE: number;
};

/**
 * D65 illuminant white point (CIE XYZ, 2° observer)
 */
const D65_WHITE_POINT = {
    x: 95.047,
    y: 100.0,
    z: 108.883,
};

/**
 * Converts sRGB to linear RGB
 * Applies gamma correction for sRGB color space
 */
function linearizeSRGB(value: number): number {
    const normalized = value / 255.0;
    if (normalized <= 0.04045) {
        return normalized / 12.92;
    }
    return Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Converts linear RGB to CIE XYZ color space
 * Uses D65 illuminant and sRGB color space matrix
 */
function rgbToXYZ(rgb: RGB): { x: number; y: number; z: number } {
    const r = linearizeSRGB(rgb.r);
    const g = linearizeSRGB(rgb.g);
    const b = linearizeSRGB(rgb.b);

    // sRGB to XYZ transformation matrix (D65)
    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
    const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

    return {
        x: x * 100.0,
        y: y * 100.0,
        z: z * 100.0,
    };
}

/**
 * Converts CIE XYZ to CIE LAB color space
 * Uses D65 white point reference
 */
function xyzToLAB(xyz: { x: number; y: number; z: number }): LAB {
    const fx =
        xyz.x / D65_WHITE_POINT.x > 0.008856
            ? Math.pow(xyz.x / D65_WHITE_POINT.x, 1.0 / 3.0)
            : (7.787 * xyz.x) / D65_WHITE_POINT.x + 16.0 / 116.0;

    const fy =
        xyz.y / D65_WHITE_POINT.y > 0.008856
            ? Math.pow(xyz.y / D65_WHITE_POINT.y, 1.0 / 3.0)
            : (7.787 * xyz.y) / D65_WHITE_POINT.y + 16.0 / 116.0;

    const fz =
        xyz.z / D65_WHITE_POINT.z > 0.008856
            ? Math.pow(xyz.z / D65_WHITE_POINT.z, 1.0 / 3.0)
            : (7.787 * xyz.z) / D65_WHITE_POINT.z + 16.0 / 116.0;

    return {
        l: 116.0 * fy - 16.0,
        a: 500.0 * (fx - fy),
        b: 200.0 * (fy - fz),
    };
}

/**
 * Converts CIE LAB to CIE LCH color space
 * Transforms rectangular coordinates to polar representation
 */
function labToLCH(lab: LAB): LCH {
    const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let h = (Math.atan2(lab.b, lab.a) * 180.0) / Math.PI;
    if (h < 0) {
        h += 360.0;
    }
    return {
        l: lab.l,
        c: c,
        h: h,
    };
}

/**
 * Converts RGB to LAB color space
 */
function rgbToLAB(rgb: RGB): LAB {
    const xyz = rgbToXYZ(rgb);
    return xyzToLAB(xyz);
}

/**
 * Calculates the perceptual color difference using CIEDE2000 formula
 * Returns Delta E value where lower values indicate closer perceptual match
 * 
 * Reference: "The CIEDE2000 Color-Difference Formula: Implementation Notes,
 * Supplementary Test Data, and Mathematical Observations" by Sharma et al.
 * 
 * @param lab1 - First color in LAB space
 * @param lab2 - Second color in LAB space
 * @returns Delta E (ΔE₀₀) value
 */
export function calculateDeltaE(lab1: LAB, lab2: LAB): number {
    const lch1 = labToLCH(lab1);
    const lch2 = labToLCH(lab2);

    // Mean luminance
    const lBar = (lch1.l + lch2.l) / 2.0;

    // Mean chroma
    const cBar = (lch1.c + lch2.c) / 2.0;

    // G factor for chroma weighting
    const g =
        0.5 *
        (1.0 -
            Math.sqrt(
                Math.pow(cBar, 7.0) /
                    (Math.pow(cBar, 7.0) + Math.pow(25.0, 7.0))
            ));

    // Adjusted a* values
    const a1Prime = (1.0 + g) * lab1.a;
    const a2Prime = (1.0 + g) * lab2.a;

    // Adjusted chroma
    const c1Prime = Math.sqrt(a1Prime * a1Prime + lab1.b * lab1.b);
    const c2Prime = Math.sqrt(a2Prime * a2Prime + lab2.b * lab2.b);

    // Mean adjusted chroma
    const cBarPrime = (c1Prime + c2Prime) / 2.0;

    // Adjusted hue angles
    let h1Prime =
        Math.abs(a1Prime) < 1e-10 && Math.abs(lab1.b) < 1e-10
            ? 0.0
            : (Math.atan2(lab1.b, a1Prime) * 180.0) / Math.PI;
    if (h1Prime < 0) h1Prime += 360.0;

    let h2Prime =
        Math.abs(a2Prime) < 1e-10 && Math.abs(lab2.b) < 1e-10
            ? 0.0
            : (Math.atan2(lab2.b, a2Prime) * 180.0) / Math.PI;
    if (h2Prime < 0) h2Prime += 360.0;

    // Delta L', Delta C', Delta H'
    const deltaLPrime = lch2.l - lch1.l;
    const deltaCPrime = c2Prime - c1Prime;

    let deltaHPrime: number;
    if (c1Prime * c2Prime === 0) {
        deltaHPrime = 0;
    } else if (Math.abs(h2Prime - h1Prime) <= 180.0) {
        deltaHPrime = h2Prime - h1Prime;
    } else if (h2Prime - h1Prime > 180.0) {
        deltaHPrime = h2Prime - h1Prime - 360.0;
    } else {
        deltaHPrime = h2Prime - h1Prime + 360.0;
    }

    deltaHPrime = 2.0 * Math.sqrt(c1Prime * c2Prime) * Math.sin((deltaHPrime * Math.PI) / 360.0);

    // Mean adjusted hue
    let hBarPrime: number;
    if (c1Prime * c2Prime === 0) {
        hBarPrime = h1Prime + h2Prime;
    } else if (Math.abs(h2Prime - h1Prime) <= 180.0) {
        hBarPrime = (h1Prime + h2Prime) / 2.0;
    } else if (Math.abs(h2Prime - h1Prime) > 180.0 && h1Prime + h2Prime < 360.0) {
        hBarPrime = (h1Prime + h2Prime + 360.0) / 2.0;
    } else {
        hBarPrime = (h1Prime + h2Prime - 360.0) / 2.0;
    }

    // Weighting functions
    const t =
        1.0 -
        0.17 * Math.cos((hBarPrime - 30.0) * (Math.PI / 180.0)) +
        0.24 * Math.cos((2.0 * hBarPrime) * (Math.PI / 180.0)) +
        0.32 * Math.cos((3.0 * hBarPrime + 6.0) * (Math.PI / 180.0)) -
        0.20 * Math.cos((4.0 * hBarPrime - 63.0) * (Math.PI / 180.0));

    const deltaTheta =
        30.0 *
        Math.exp(
            -Math.pow((hBarPrime - 275.0) / 25.0, 2.0)
        );

    const rc =
        2.0 *
        Math.sqrt(
            Math.pow(cBarPrime, 7.0) /
                (Math.pow(cBarPrime, 7.0) + Math.pow(25.0, 7.0))
        );

    const rt =
        -Math.sin((2.0 * deltaTheta) * (Math.PI / 180.0)) * rc;

    // SL, SC, SH weighting factors
    const sl =
        1.0 +
        (0.015 * Math.pow(lBar - 50.0, 2.0)) /
            Math.sqrt(20.0 + Math.pow(lBar - 50.0, 2.0));

    const sc = 1.0 + 0.045 * cBarPrime;

    const sh = 1.0 + 0.015 * cBarPrime * t;

    // kL, kC, kH parametric factors (standard viewing conditions)
    const kl = 1.0;
    const kc = 1.0;
    const kh = 1.0;

    // Final CIEDE2000 formula
    const deltaE =
        Math.sqrt(
            Math.pow(deltaLPrime / (kl * sl), 2.0) +
                Math.pow(deltaCPrime / (kc * sc), 2.0) +
                Math.pow(deltaHPrime / (kh * sh), 2.0) +
                rt * (deltaCPrime / (kc * sc)) * (deltaHPrime / (kh * sh))
        );

    return deltaE;
}

/**
 * Parses a hex color string to RGB
 * Supports formats: "#RRGGBB" or "RRGGBB"
 */
function hexToRGB(hex: string): RGB {
    const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
    if (normalized.length !== 6) {
        throw new Error(`Invalid hex color format: ${hex}`);
    }

    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        throw new Error(`Invalid hex color format: ${hex}`);
    }

    return { r, g, b };
}

/**
 * ColorMatcher class for finding k-nearest DMC threads using perceptual color distance
 */
export class ColorMatcher {
    private threads: DMCThread[];

    /**
     * Constructs a ColorMatcher with a dataset of DMC threads
     * @param threads - Array of DMC thread definitions
     */
    constructor(threads: DMCThread[]) {
        this.threads = threads;
    }

    /**
     * Finds the k-nearest DMC threads to a target color
     * @param targetHex - Target color in hex format (#RRGGBB or RRGGBB)
     * @param k - Number of nearest matches to return (default: 1)
     * @returns Array of MatchResult objects sorted by ascending Delta E
     */
    findNearest(targetHex: string, k: number = 1): MatchResult[] {
        const targetRGB = hexToRGB(targetHex);
        const targetLAB = rgbToLAB(targetRGB);

        const matches: MatchResult[] = this.threads.map((thread) => {
            const threadRGB: RGB = { r: thread.r, g: thread.g, b: thread.b };
            const threadLAB = rgbToLAB(threadRGB);
            const deltaE = calculateDeltaE(targetLAB, threadLAB);

            return {
                thread,
                deltaE,
            };
        });

        // Sort by Delta E (ascending) and return top k
        matches.sort((a, b) => a.deltaE - b.deltaE);
        return matches.slice(0, k);
    }

    /**
     * Finds the k-nearest DMC threads to a target RGB color
     * @param targetRGB - Target color as RGB object
     * @param k - Number of nearest matches to return (default: 1)
     * @returns Array of MatchResult objects sorted by ascending Delta E
     */
    findNearestRGB(targetRGB: RGB, k: number = 1): MatchResult[] {
        const targetLAB = rgbToLAB(targetRGB);

        const matches: MatchResult[] = this.threads.map((thread) => {
            const threadRGB: RGB = { r: thread.r, g: thread.g, b: thread.b };
            const threadLAB = rgbToLAB(threadRGB);
            const deltaE = calculateDeltaE(targetLAB, threadLAB);

            return {
                thread,
                deltaE,
            };
        });

        // Sort by Delta E (ascending) and return top k
        matches.sort((a, b) => a.deltaE - b.deltaE);
        return matches.slice(0, k);
    }
}
