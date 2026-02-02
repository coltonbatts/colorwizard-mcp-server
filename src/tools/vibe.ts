/**
 * Instrument CW-03: Aesthetic Offset
 * Stylistic Deviation Calculator
 */

/**
 * Color representation in RGB format
 */
export type Color = {
    hex: string;
    rgb: {
        r: number;
        g: number;
        b: number;
    };
};

/**
 * ColorArray type - array of Color objects
 */
export type ColorArray = Color[];

/**
 * Aesthetic profile names
 */
export type ProfileName = "Lynchian" | "Southern Gothic" | "Brutalist";

/**
 * Result of aesthetic offset transformation
 */
export type AestheticOffsetResult = {
    original: ColorArray;
    artisan: ColorArray;
    profile: ProfileName;
    note: string;
};

/**
 * Converts RGB to LAB color space
 * Uses D65 white point reference
 */
function rgbToLAB(r: number, g: number, blue: number): { l: number; a: number; b: number } {
    // Normalize RGB values (0-255 -> 0-1)
    const rNorm = r / 255.0;
    const gNorm = g / 255.0;
    const bNorm = blue / 255.0;

    // Linearize sRGB
    const linearize = (val: number) => {
        return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    };

    const rLin = linearize(rNorm);
    const gLin = linearize(gNorm);
    const bLin = linearize(bNorm);

    // Convert to XYZ (D65)
    const x = rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375;
    const y = rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.072175;
    const z = rLin * 0.0193339 + gLin * 0.119192 + bLin * 0.9503041;

    // D65 white point
    const xn = x / 0.95047;
    const yn = y / 1.0;
    const zn = z / 1.08883;

    // Convert to LAB
    const fx = xn > 0.008856 ? Math.pow(xn, 1 / 3) : (7.787 * xn + 16 / 116);
    const fy = yn > 0.008856 ? Math.pow(yn, 1 / 3) : (7.787 * yn + 16 / 116);
    const fz = zn > 0.008856 ? Math.pow(zn, 1 / 3) : (7.787 * zn + 16 / 116);

    const l = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const b = 200 * (fy - fz);

    return { l, a, b };
}

/**
 * Converts LAB to RGB color space
 */
function labToRGB(l: number, a: number, labB: number): { r: number; g: number; b: number } {
    // D65 white point
    const fy = (l + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - labB / 200;

    const xr = fx > 0.206897 ? Math.pow(fx, 3) : (fx - 16 / 116) / 7.787;
    const yr = fy > 0.206897 ? Math.pow(fy, 3) : (fy - 16 / 116) / 7.787;
    const zr = fz > 0.206897 ? Math.pow(fz, 3) : (fz - 16 / 116) / 7.787;

    // D65 white point
    const x = xr * 0.95047;
    const y = yr * 1.0;
    const z = zr * 1.08883;

    // Convert to linear RGB
    const rLin = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    const gLin = x * -0.969266 + y * 1.8760108 + z * 0.041556;
    const bLin = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

    // Gamma correction (sRGB)
    const gammaCorrect = (val: number) => {
        if (val <= 0.0031308) return 12.92 * val;
        return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    };

    const r = Math.round(Math.max(0, Math.min(255, gammaCorrect(rLin) * 255)));
    const g = Math.round(Math.max(0, Math.min(255, gammaCorrect(gLin) * 255)));
    const b = Math.round(Math.max(0, Math.min(255, gammaCorrect(bLin) * 255)));

    return { r, g, b };
}

/**
 * Converts RGB to hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b]
        .map((val) => Math.round(val).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
}

/**
 * Applies Lynchian aesthetic profile
 * - Reduce saturation by 20%
 * - Increase contrast (L* values below 30 go to 0)
 * - Add tiny +2 shift toward blue in darkest tones
 */
function applyLynchian(color: Color): Color {
    const { r, g, b } = color.rgb;
    const lab = rgbToLAB(r, g, b);

    // Reduce saturation by 20% (reduce chroma)
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    const newChroma = chroma * 0.8;
    const hue = Math.atan2(lab.b, lab.a);

    // Increase contrast: L* values below 30 go to 0
    let newL = lab.l;
    if (newL < 30) {
        newL = 0;
    }

    // Reconstruct a* and b* from chroma and hue
    let newA = newChroma * Math.cos(hue);
    let newB = newChroma * Math.sin(hue);

    // Add tiny +2 shift toward blue in darkest tones (increase b* component)
    if (newL < 50) {
        newB += 2;
    }

    const newRGB = labToRGB(newL, newA, newB);
    return {
        hex: rgbToHex(newRGB.r, newRGB.g, newRGB.b),
        rgb: newRGB,
    };
}

/**
 * Applies Southern Gothic aesthetic profile
 * - Increase warmth (shift hue toward red/yellow)
 * - Add 10% "dusty" overlay (decrease lightness slightly and desaturate)
 */
function applySouthernGothic(color: Color): Color {
    const { r, g, b } = color.rgb;
    const lab = rgbToLAB(r, g, b);

    // Calculate chroma and hue
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let hue = Math.atan2(lab.b, lab.a);

    // Shift hue toward red/yellow (reduce hue angle toward 0 or increase toward yellow)
    // Red is around 0°, yellow is around 90°
    if (hue > Math.PI / 2) {
        // Shift toward yellow
        hue = hue * 0.85;
    } else if (hue < 0) {
        // Shift toward red
        hue = hue * 0.9;
    } else {
        // Shift toward red/yellow
        hue = hue * 0.9;
    }

    // Add 10% "dusty" overlay: decrease lightness slightly and desaturate
    let newL = lab.l * 0.95; // Slight darkening
    const newChroma = chroma * 0.9; // Desaturate

    // Reconstruct a* and b* from chroma and hue
    const newA = newChroma * Math.cos(hue);
    const newB = newChroma * Math.sin(hue);

    const newRGB = labToRGB(newL, newA, newB);
    return {
        hex: rgbToHex(newRGB.r, newRGB.g, newRGB.b),
        rgb: newRGB,
    };
}

/**
 * Quantizes a color to the nearest "industrial" shade
 * Industrial shades: grays, concrete, raw steel
 */
function quantizeToIndustrial(r: number, g: number, b: number): { r: number; g: number; b: number } {
    // Industrial palette: grays, concrete tones, raw steel
    const industrialPalette = [
        { r: 0, g: 0, b: 0 }, // Black
        { r: 51, g: 51, b: 51 }, // Dark gray
        { r: 102, g: 102, b: 102 }, // Medium gray
        { r: 153, g: 153, b: 153 }, // Light gray
        { r: 204, g: 204, b: 204 }, // Very light gray
        { r: 128, g: 128, b: 128 }, // Concrete gray
        { r: 96, g: 96, b: 96 }, // Dark concrete
        { r: 160, g: 160, b: 160 }, // Light concrete
        { r: 70, g: 70, b: 70 }, // Raw steel dark
        { r: 105, g: 105, b: 105 }, // Raw steel medium
        { r: 140, g: 140, b: 140 }, // Raw steel light
    ];

    // Find nearest industrial color using Euclidean distance in RGB space
    let minDist = Infinity;
    let nearest = industrialPalette[0];

    for (const industrial of industrialPalette) {
        const dist =
            Math.pow(r - industrial.r, 2) +
            Math.pow(g - industrial.g, 2) +
            Math.pow(b - industrial.b, 2);
        if (dist < minDist) {
            minDist = dist;
            nearest = industrial;
        }
    }

    return nearest;
}

/**
 * Applies Brutalist aesthetic profile
 * - Quantize palette to nearest "industrial" shades (grays, concrete, raw steel)
 * - High-contrast "warning" red (#ff0000) for any colors that are sufficiently red
 */
function applyBrutalist(color: Color): Color {
    const { r, g, b } = color.rgb;

    // Check if color is sufficiently red (high red component relative to others)
    const redDominance = r / (r + g + b + 1); // Avoid division by zero
    const isRed = r > 200 && redDominance > 0.5 && r > g * 1.5 && r > b * 1.5;

    if (isRed) {
        // High-contrast warning red
        return {
            hex: "#FF0000",
            rgb: { r: 255, g: 0, b: 0 },
        };
    }

    // Quantize to nearest industrial shade
    const quantized = quantizeToIndustrial(r, g, b);
    return {
        hex: rgbToHex(quantized.r, quantized.g, quantized.b),
        rgb: quantized,
    };
}

/**
 * Vibe shifter function - applies aesthetic offset to a color array
 * 
 * @param colors - Array of Color objects to transform
 * @param profileName - Aesthetic profile to apply ("Lynchian", "Southern Gothic", or "Brutalist")
 * @returns AestheticOffsetResult with original and transformed palettes
 */
export function vibeShifter(
    colors: ColorArray,
    profileName: ProfileName
): AestheticOffsetResult {
    let transformed: ColorArray;

    switch (profileName) {
        case "Lynchian":
            transformed = colors.map(applyLynchian);
            break;
        case "Southern Gothic":
            transformed = colors.map(applySouthernGothic);
            break;
        case "Brutalist":
            transformed = colors.map(applyBrutalist);
            break;
        default:
            throw new Error(`ERROR-CW-03: Unknown aesthetic profile: ${profileName}`);
    }

    return {
        original: colors,
        artisan: transformed,
        profile: profileName,
        note: `CW-03: Palette rectified for ${profileName} narrative alignment.`,
    };
}
