/**
 * Lab color space conversion utilities
 * Implements RGB -> XYZ -> Lab conversion for Delta E calculations
 */

/**
 * RGB color (0-255 range)
 */
export interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * XYZ color space
 */
export interface XYZ {
    x: number;
    y: number;
    z: number;
}

/**
 * Lab color space
 */
export interface Lab {
    l: number;
    a: number;
    b: number;
}

/**
 * Converts sRGB to linear RGB (gamma correction)
 * @param value - sRGB component (0-255)
 * @returns Linear RGB component (0-1)
 */
function srgbToLinear(value: number): number {
    const normalized = value / 255.0;
    if (normalized <= 0.04045) {
        return normalized / 12.92;
    }
    return Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Converts linear RGB to sRGB (gamma correction)
 * @param value - Linear RGB component (0-1)
 * @returns sRGB component (0-255)
 */
function linearToSrgb(value: number): number {
    if (value <= 0.0031308) {
        return Math.round(value * 12.92 * 255);
    }
    return Math.round((1.055 * Math.pow(value, 1.0 / 2.4) - 0.055) * 255);
}

/**
 * Converts RGB to XYZ using D65 illuminant
 * @param rgb - RGB color (0-255 range)
 * @returns XYZ color
 */
export function rgbToXyz(rgb: RGB): XYZ {
    // Convert to linear RGB
    const r = srgbToLinear(rgb.r);
    const g = srgbToLinear(rgb.g);
    const b = srgbToLinear(rgb.b);

    // Convert to XYZ using sRGB matrix (D65 white point)
    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

    return { x, y, z };
}

/**
 * Converts XYZ to Lab
 * @param xyz - XYZ color
 * @returns Lab color
 */
export function xyzToLab(xyz: XYZ): Lab {
    // D65 white point
    const xn = 0.95047;
    const yn = 1.0;
    const zn = 1.08883;

    // Normalize by white point
    const fx = xyz.x / xn;
    const fy = xyz.y / yn;
    const fz = xyz.z / zn;

    // Apply f(t) function
    const epsilon = 216.0 / 24389.0; // 6^3/29^3
    const kappa = 24389.0 / 27.0; // 29^3/3^3

    const fx_adj = fx > epsilon ? Math.pow(fx, 1.0 / 3.0) : (kappa * fx + 16.0) / 116.0;
    const fy_adj = fy > epsilon ? Math.pow(fy, 1.0 / 3.0) : (kappa * fy + 16.0) / 116.0;
    const fz_adj = fz > epsilon ? Math.pow(fz, 1.0 / 3.0) : (kappa * fz + 16.0) / 116.0;

    const l = 116.0 * fy_adj - 16.0;
    const a = 500.0 * (fx_adj - fy_adj);
    const b = 200.0 * (fy_adj - fz_adj);

    return { l, a, b };
}

/**
 * Converts RGB to Lab
 * @param rgb - RGB color (0-255 range)
 * @returns Lab color
 */
export function rgbToLab(rgb: RGB): Lab {
    const xyz = rgbToXyz(rgb);
    return xyzToLab(xyz);
}

/**
 * Calculates Delta E (CIE76) between two Lab colors
 * @param lab1 - First Lab color
 * @param lab2 - Second Lab color
 * @returns Delta E value (lower is more similar)
 */
export function deltaE76(lab1: Lab, lab2: Lab): number {
    const dl = lab1.l - lab2.l;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * Calculates Delta E (CIE76) between two RGB colors
 * @param rgb1 - First RGB color (0-255 range)
 * @param rgb2 - Second RGB color (0-255 range)
 * @returns Delta E value (lower is more similar)
 */
export function deltaE76Rgb(rgb1: RGB, rgb2: RGB): number {
    const lab1 = rgbToLab(rgb1);
    const lab2 = rgbToLab(rgb2);
    return deltaE76(lab1, lab2);
}
