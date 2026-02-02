# ColorWizard Manual

## Instrument Specifications

### CW-01: Spectral Analysis
**Sensor Data Acquisition Unit**

Extracts precise pixel data from local image files for perceptual color decomposition and analysis.

**Input Parameters:**
- `image_path` (string): Path to the image file
- `x` (number): X coordinate of the region center
- `y` (number): Y coordinate of the region center
- `radius` (number, optional): Radius of the square region (default: 5)

**Output Format:**
- HEX: 6-character hexadecimal color code (e.g., #FFFFFF)
- RGB: Red, Green, Blue values as integers (0-255)

**Error Handling:**
- Returns `ERROR-CW-01: Visual source not found.` if image path is invalid or processing fails

**Usage:**
```
Instrument CW-01 (Spectral Analysis) invoked for image <path> at coordinates (x, y) with radius <radius>. Region analysis complete. HEX: <hex>, RGB: (<r>, <g>, <b>).
```

---

### CW-02: Material Match
**Logical Mapping Unit**

Maps digital color values to physical DMC embroidery thread pigments.

**Input Parameters:**
- `hex` (string): 6-character hex color code (e.g., #FFFFFF or FFFFFF)

**Output Format:**
- Returns nearest DMC thread match based on perceptual color distance

**Usage:**
```
Instrument CW-02 (Material Match) invoked for color <hex>. <result>.
```

---

### CW-03: Aesthetic Offset
**Stylistic Deviation Calculator**

Calculates intentional color deviations for stylistic intent.

*Specification pending.*
